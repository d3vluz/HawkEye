"""Etapa 4: mede a agulha de cada pino e aponta as quebradas, curtas ou tortas."""

from dataclasses import dataclass

import cv2
import numpy as np

from etapas.pinos import MedidasTipicas, Pino

# O top-hat realça linhas finas e claras (agulhas) e descarta estruturas largas como as divisórias.
KERNEL_TOPHAT = 9
RESPOSTA_MINIMA = 14
# Plástico e corpos de pinos encobrem a agulha: ali a falta de resposta não conta como falha.
# A margem cobre as bordas finas e brilhantes do plástico, que o top-hat confunde com agulha.
SATURACAO_DO_PLASTICO = 100
BRILHO_DO_PLASTICO = 85
MARGEM_DO_PLASTICO = 13

INICIO_DO_RAIO = 3
FIM_DO_RAIO = 170
PASSO_DO_RAIO = 2
LARGURA_DO_RAIO = (-1.5, 0.0, 1.5)
ABERTURA_ANGULAR = 18
PASSO_ANGULAR = 3
PROFUNDIDADE_DA_PONTA = 12
DESLOCAMENTO_LATERAL = 12
PASSO_LATERAL = 3
COBERTURA_MINIMA = 0.7
# A agulha nasce colada ao disco: fundo visível antes do primeiro acerto indica outra estrutura.
FALHAS_ANTES_DO_INICIO = 3
AMOSTRAS_APOS_O_FIM = 8

# Relativos ao comprimento típico do corpo; a agulha íntegra mede cerca de 0,8 dele.
LIMITE_QUEBRADA = 0.35
LIMITE_CURTA = 0.65

COR_INTEGRA = (0, 255, 0)
COR_DEFEITO = (0, 0, 255)

_ANGULOS = np.radians(np.arange(-ABERTURA_ANGULAR, ABERTURA_ANGULAR + 1, PASSO_ANGULAR))
_DISTANCIAS = np.arange(INICIO_DO_RAIO, FIM_DO_RAIO, PASSO_DO_RAIO, dtype=np.float64)
_DESLOCAMENTOS = np.arange(-DESLOCAMENTO_LATERAL, DESLOCAMENTO_LATERAL + 1, PASSO_LATERAL, dtype=np.float64)


@dataclass
class Haste:
    comprimento: float
    defeito: str | None  # "quebrada", "curta_ou_torta" ou None
    inicio: np.ndarray | None
    direcao: np.ndarray | None


def _mapas(imagem: np.ndarray, pinos: list[Pino]) -> tuple[np.ndarray, np.ndarray]:
    """Devolve onde há agulha visível e onde a imagem está encoberta (plástico ou corpo de pino)."""
    hsv = cv2.cvtColor(imagem, cv2.COLOR_BGR2HSV)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (KERNEL_TOPHAT, KERNEL_TOPHAT))
    tophat = cv2.morphologyEx(hsv[..., 2], cv2.MORPH_TOPHAT, kernel)
    plastico = ((hsv[..., 1] < SATURACAO_DO_PLASTICO) & (hsv[..., 2] > BRILHO_DO_PLASTICO)).astype(np.uint8)
    plastico = cv2.morphologyEx(plastico, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    plastico = cv2.dilate(plastico, np.ones((MARGEM_DO_PLASTICO, MARGEM_DO_PLASTICO), np.uint8))
    corpos = np.zeros_like(plastico)
    cv2.drawContours(corpos, [p.contorno for p in pinos], -1, 1, -1)
    corpos = cv2.dilate(corpos, np.ones((5, 5), np.uint8))
    encoberto = (plastico | corpos) > 0
    agulha = (tophat >= RESPOSTA_MINIMA) & ~encoberto
    return agulha, encoberto


def _medir_raios(agulha: np.ndarray, encoberto: np.ndarray, inicios: np.ndarray, direcoes: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Mede todos os raios de uma vez: comprimento coberto por agulha e se o fim do trecho é visível."""
    altura, largura = agulha.shape
    normais = np.stack([-direcoes[:, 1], direcoes[:, 0]], axis=1)
    centros = inicios[:, None, :] + _DISTANCIAS[None, :, None] * direcoes[:, None, :]
    amostras = centros[:, :, None, :] + np.array(LARGURA_DO_RAIO)[None, None, :, None] * normais[:, None, None, :]
    xs = np.rint(amostras[..., 0]).astype(int)
    ys = np.rint(amostras[..., 1]).astype(int)
    dentro = ((xs >= 0) & (xs < largura) & (ys >= 0) & (ys < altura)).all(axis=2)
    xs, ys = np.clip(xs, 0, largura - 1), np.clip(ys, 0, altura - 1)
    acerto = agulha[ys, xs].any(axis=2) & dentro
    oculto = (encoberto[ys, xs].any(axis=2) & ~acerto) | ~dentro
    falha = ~acerto & ~oculto

    acertos = np.cumsum(acerto, axis=1)
    falhas = np.cumsum(falha, axis=1)
    cobertura = acertos / np.maximum(acertos + falhas, 1)
    total = acerto.shape[1]
    indice = np.arange(total)[None, :]

    primeiro = np.where(acerto.any(axis=1), acerto.argmax(axis=1), total)
    falhas_iniciais = falhas[np.arange(len(primeiro)), np.minimum(primeiro, total - 1)]
    parada = (falha & (falhas > 6) & (cobertura < 0.4)) | ~dentro
    para_em = np.where(parada.any(axis=1), parada.argmax(axis=1), total)
    para_em = np.where(falhas_iniciais > FALHAS_ANTES_DO_INICIO, 0, para_em)

    valido = acerto & (cobertura >= COBERTURA_MINIMA) & (indice < para_em[:, None])
    encontrou = valido.any(axis=1)
    ultimo = np.where(encontrou, total - 1 - valido[:, ::-1].argmax(axis=1), 0)

    seguintes = np.minimum(ultimo[:, None] + 1 + np.arange(AMOSTRAS_APOS_O_FIM)[None, :], total - 1)
    fim_visivel = ~oculto[np.arange(len(ultimo))[:, None], seguintes].any(axis=1) & encontrou
    return np.where(encontrou, _DISTANCIAS[ultimo], 0.0), fim_visivel


def _centros_das_pontas(pino: Pino) -> list[tuple[float, np.ndarray]]:
    # A agulha sai do centro do disco da ponta; usar o eixo pelo centro do pino desloca o raio
    # quando a máscara inclui um reflexo ou fica parcialmente encoberta.
    pontos = pino.contorno.reshape(-1, 2).astype(np.float64)
    projecao = (pontos - pino.centro) @ pino.eixo
    pontas = []
    for sentido, t in ((1.0, pino.extensao[1]), (-1.0, pino.extensao[0])):
        perto = pontos[np.abs(projecao - t) <= PROFUNDIDADE_DA_PONTA]
        pontas.append((sentido, perto.mean(axis=0) if len(perto) else pino.centro + pino.eixo * t))
    return pontas


def _medir_haste(pino: Pino, agulha: np.ndarray, encoberto: np.ndarray, tipicas: MedidasTipicas) -> Haste:
    u = pino.eixo
    normal = np.array([-u[1], u[0]])
    cos, sen = np.cos(_ANGULOS), np.sin(_ANGULOS)
    girados = np.stack([cos * u[0] - sen * u[1], sen * u[0] + cos * u[1]], axis=1)
    inicios, direcoes = [], []
    # Com o pino inclinado, a agulha sai alguns pixels fora do centro do disco.
    for sentido, centro in _centros_das_pontas(pino):
        for deslocamento in _DESLOCAMENTOS:
            inicios.append(np.repeat((centro + normal * deslocamento)[None, :], len(girados), axis=0))
            direcoes.append(girados * sentido)
    inicios_arr, direcoes_arr = np.concatenate(inicios), np.concatenate(direcoes)
    comprimentos, fins_visiveis = _medir_raios(agulha, encoberto, inicios_arr, direcoes_arr)

    i = int(np.argmax(comprimentos))
    comprimento = float(comprimentos[i])
    if comprimento < tipicas.comprimento * LIMITE_QUEBRADA:
        defeito = "quebrada"
    # Se o trecho reto termina encoberto pelo plástico, o comprimento real não é conhecido.
    elif fins_visiveis[i] and comprimento < tipicas.comprimento * LIMITE_CURTA:
        defeito = "curta_ou_torta"
    else:
        defeito = None
    if comprimento <= 0:
        return Haste(0.0, defeito, None, None)
    return Haste(comprimento, defeito, inicios_arr[i], direcoes_arr[i])


def medir_hastes(imagem: np.ndarray, pinos: list[Pino], tipicas: MedidasTipicas) -> list[Haste]:
    if not pinos:
        return []
    agulha, encoberto = _mapas(imagem, pinos)
    return [_medir_haste(p, agulha, encoberto, tipicas) for p in pinos]


def desenhar_hastes(imagem: np.ndarray, pinos: list[Pino], hastes: list[Haste], tipicas: MedidasTipicas) -> np.ndarray:
    resultado = imagem.copy()
    for pino, haste in zip(pinos, hastes):
        cor = COR_DEFEITO if haste.defeito else COR_INTEGRA
        if haste.inicio is not None:
            fim = haste.inicio + haste.direcao * haste.comprimento
            cv2.line(resultado, tuple(np.rint(haste.inicio).astype(int)), tuple(np.rint(fim).astype(int)), cor, 3)
        if haste.defeito:
            cx, cy = np.rint(pino.centro).astype(int)
            cv2.circle(resultado, (int(cx), int(cy)), int(tipicas.comprimento * 0.6), COR_DEFEITO, 3)
    return resultado
