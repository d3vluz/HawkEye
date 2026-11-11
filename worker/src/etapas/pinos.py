"""Etapa 2: encontra os pinos e classifica cada um por cor errada e corpo danificado."""

from dataclasses import dataclass

import cv2
import numpy as np

# Qualquer objeto saturado sobre o fundo escuro é candidato a pino, de qualquer cor;
# o pino verde-escuro tem brilho próximo ao do fundo e só se separa pela saturação.
SATURACAO_MINIMA = 90
BRILHO_MINIMO = 30
MATIZ_AMARELO = (9, 35)
MATIZ_VERMELHO_MAX = 8
MATIZ_VERMELHO_VOLTA = 170
SATURACAO_VERMELHO = 120
BRILHO_VERMELHO = 60
PIXELS_VERMELHOS_MINIMOS = 25
FRACAO_OUTRA_COR = 0.4

# Reflexos amarelados na parede transparente têm cerca de 10% da área de um pino.
AREA_RELATIVA_MINIMA = 0.3
AREA_RELATIVA_DE_PINOS_JUNTOS = 1.6
AREA_RELATIVA_DE_DANO = 0.8
COMPRIMENTO_RELATIVO_DE_DANO = 0.88

# Medidas de um pino no dataset, usadas quando há poucos pinos para tirar a mediana da imagem.
AREA_DE_REFERENCIA = 5280.0
COMPRIMENTO_DE_REFERENCIA = 121.0
PINOS_PARA_MEDIANA = 5
KERNEL_DE_CONTORNO = 11
# Folga do recorte de cada pino: maior que o raio dos kernels, para o resultado ser igual ao da imagem inteira.
FOLGA_DO_RECORTE = 8

COR_CONFORME = (0, 255, 0)
COR_UM_DEFEITO = (0, 165, 255)
COR_DOIS_DEFEITOS = (0, 0, 255)


@dataclass
class Pino:
    contorno: np.ndarray
    area: float
    comprimento: float
    centro: np.ndarray
    eixo: np.ndarray
    extensao: tuple[float, float]  # projeções mínima e máxima sobre o eixo, a partir do centro
    pixels_vermelhos: int
    fracao_outra_cor: float
    agrupado: bool = False  # veio da separação de pinos encostados
    cor_errada: bool = False
    danificado: bool = False


@dataclass
class MedidasTipicas:
    area: float
    comprimento: float


def _mascaras_de_cor(hsv: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    matiz, saturacao, brilho = cv2.split(hsv)
    colorido = ((saturacao >= SATURACAO_MINIMA) & (brilho >= BRILHO_MINIMO)).astype(np.uint8) * 255
    colorido = cv2.morphologyEx(colorido, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    colorido = cv2.morphologyEx(colorido, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    vermelho = (((matiz <= MATIZ_VERMELHO_MAX) | (matiz >= MATIZ_VERMELHO_VOLTA))
                & (saturacao >= SATURACAO_VERMELHO) & (brilho >= BRILHO_VERMELHO)).astype(np.uint8)
    vermelho = cv2.morphologyEx(vermelho, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    amarelo = (matiz >= MATIZ_AMARELO[0]) & (matiz <= MATIZ_AMARELO[1])
    return colorido, vermelho, amarelo


def _criar_pino(mascara: np.ndarray, origem: tuple[int, int], vermelho: np.ndarray, amarelo: np.ndarray) -> Pino | None:
    # Reflexos do pino no plástico vizinho grudam no corpo como apêndices finos e entortam o eixo.
    corpo = cv2.morphologyEx(mascara, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (KERNEL_DE_CONTORNO,) * 2))
    if cv2.countNonZero(corpo) < cv2.countNonZero(mascara) * 0.5:
        corpo = mascara
    contornos, _ = cv2.findContours(corpo, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE, offset=origem)
    if not contornos:
        return None
    contorno = max(contornos, key=cv2.contourArea)

    ys, xs = np.nonzero(corpo)
    pontos = np.column_stack([xs + origem[0], ys + origem[1]]).astype(np.float64)
    centro = pontos.mean(axis=0)
    _, _, vt = np.linalg.svd(pontos - centro, full_matrices=False)
    eixo = vt[0]
    projecao = (pontos - centro) @ eixo
    (_, _), (largura, altura), _ = cv2.minAreaRect(contorno)

    dentro = mascara > 0
    pixels_vermelhos = int(vermelho[cv2.dilate(mascara, np.ones((5, 5), np.uint8)) > 0].sum())
    fora_do_amarelo = ~amarelo[dentro] & (vermelho[dentro] == 0)
    return Pino(
        contorno=contorno, area=float(dentro.sum()), comprimento=float(max(largura, altura)),
        centro=centro, eixo=eixo, extensao=(float(projecao.min()), float(projecao.max())),
        pixels_vermelhos=pixels_vermelhos,
        fracao_outra_cor=float(fora_do_amarelo.mean()) if dentro.any() else 0.0,
    )


def _separar_pinos_juntos(mascara: np.ndarray, quantidade: int) -> list[np.ndarray]:
    ys, xs = np.nonzero(mascara)
    pontos = np.column_stack([xs, ys]).astype(np.float32)
    criterio = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.5)
    _, grupos, _ = cv2.kmeans(pontos, quantidade, None, criterio, 3, cv2.KMEANS_PP_CENTERS)
    partes = []
    for k in range(quantidade):
        parte = np.zeros_like(mascara)
        escolhidos = grupos.ravel() == k
        parte[ys[escolhidos], xs[escolhidos]] = 255
        partes.append(parte)
    return partes


def medidas_tipicas(pinos: list[Pino]) -> MedidasTipicas:
    isolados = [p for p in pinos if not p.agrupado]
    if len(isolados) < PINOS_PARA_MEDIANA:
        return MedidasTipicas(AREA_DE_REFERENCIA, COMPRIMENTO_DE_REFERENCIA)
    return MedidasTipicas(
        area=float(np.median([p.area for p in isolados])),
        comprimento=float(np.median([p.comprimento for p in isolados])),
    )


def detectar_pinos(imagem: np.ndarray) -> list[Pino]:
    hsv = cv2.cvtColor(imagem, cv2.COLOR_BGR2HSV)
    colorido, vermelho, amarelo = _mascaras_de_cor(hsv)
    total, rotulos, estatisticas, _ = cv2.connectedComponentsWithStats(colorido)
    areas = estatisticas[1:, cv2.CC_STAT_AREA].astype(float)
    grandes = areas[areas > AREA_DE_REFERENCIA * AREA_RELATIVA_MINIMA]
    area_tipica = float(np.median(grandes)) if len(grandes) >= PINOS_PARA_MEDIANA else AREA_DE_REFERENCIA
    altura_img, largura_img = rotulos.shape

    pinos: list[Pino] = []
    for i in range(1, total):
        x, y, largura, altura, area = estatisticas[i]
        if area < area_tipica * AREA_RELATIVA_MINIMA:
            continue
        x0, y0 = max(x - FOLGA_DO_RECORTE, 0), max(y - FOLGA_DO_RECORTE, 0)
        x1, y1 = min(x + largura + FOLGA_DO_RECORTE, largura_img), min(y + altura + FOLGA_DO_RECORTE, altura_img)
        recorte = (slice(y0, y1), slice(x0, x1))
        mascara = (rotulos[recorte] == i).astype(np.uint8) * 255
        args = ((x0, y0), vermelho[recorte], amarelo[recorte])

        quantidade = int(round(area / area_tipica))
        if area >= area_tipica * AREA_RELATIVA_DE_PINOS_JUNTOS and quantidade >= 2:
            for parte in _separar_pinos_juntos(mascara, quantidade):
                pino = _criar_pino(parte, *args)
                if pino:
                    pino.agrupado = True
                    pinos.append(pino)
        else:
            pino = _criar_pino(mascara, *args)
            if pino:
                pinos.append(pino)

    tipicas = medidas_tipicas(pinos)
    for pino in pinos:
        pino.cor_errada = pino.pixels_vermelhos >= PIXELS_VERMELHOS_MINIMOS or pino.fracao_outra_cor >= FRACAO_OUTRA_COR
        if not pino.agrupado:
            pino.danificado = (pino.area < tipicas.area * AREA_RELATIVA_DE_DANO
                               or pino.comprimento < tipicas.comprimento * COMPRIMENTO_RELATIVO_DE_DANO)
    return pinos


def desenhar_pinos(imagem: np.ndarray, pinos: list[Pino]) -> np.ndarray:
    resultado = imagem.copy()
    for pino in pinos:
        defeitos = int(pino.cor_errada) + int(pino.danificado)
        cor = (COR_CONFORME, COR_UM_DEFEITO, COR_DOIS_DEFEITOS)[defeitos]
        cv2.drawContours(resultado, [pino.contorno], -1, cor, 3)
    return resultado
