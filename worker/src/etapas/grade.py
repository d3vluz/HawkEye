"""Etapa 1: encontra as divisórias da caixa, monta a grade e aponta trechos de divisória ausentes."""

from dataclasses import dataclass, field

import cv2
import numpy as np

# Divisória é uma faixa mais clara que os dois lados a DISTANCIA_LATERAL px; amarelo saturado não conta.
DISTANCIA_LATERAL = 24
CONTRASTE_MINIMO = 30
SATURACAO_DE_PINO = 120
KERNEL_DE_LINHA = 41
PICO_MINIMO = 0.2
MARGEM_PAREDE_X = 0.04
MARGEM_PAREDE_Y = 0.06
FAIXA_DO_TRECHO = 18
# Em caixas íntegras o pior trecho fica acima de 0,4; trechos ausentes medem perto de 0.
COBERTURA_MINIMA = 0.3

COR_VERTICAL = (255, 0, 255)
COR_HORIZONTAL = (0, 255, 0)
COR_AUSENTE = (0, 0, 255)


@dataclass
class TrechoAusente:
    orientacao: str  # "vertical" separa colunas; "horizontal" separa linhas
    linha: int
    coluna: int
    inicio: tuple[int, int]
    fim: tuple[int, int]
    cobertura: float


@dataclass
class Grade:
    posicoes_x: list[int] = field(default_factory=list)
    posicoes_y: list[int] = field(default_factory=list)
    trechos_ausentes: list[TrechoAusente] = field(default_factory=list)
    compartimentos: list[list[tuple[int, int]]] = field(default_factory=list)

    @property
    def linhas(self) -> int:
        return max(len(self.posicoes_y) - 1, 0)

    @property
    def colunas(self) -> int:
        return max(len(self.posicoes_x) - 1, 0)

    def celula_do_ponto(self, ponto: np.ndarray) -> tuple[int, int] | None:
        coluna = int(np.searchsorted(self.posicoes_x, ponto[0])) - 1
        linha = int(np.searchsorted(self.posicoes_y, ponto[1])) - 1
        if 0 <= linha < self.linhas and 0 <= coluna < self.colunas:
            return linha, coluna
        return None


def _limites_da_caixa(hsv: np.ndarray) -> tuple[int, int, int, int] | None:
    plastico = ((hsv[..., 1] < 70) & (hsv[..., 2] > 110)).astype(np.uint8)
    plastico = cv2.morphologyEx(plastico, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    ys, xs = np.nonzero(plastico)
    if len(xs) < 1000:
        return None
    x0, x1 = np.percentile(xs, [0.5, 99.5]).astype(int)
    y0, y1 = np.percentile(ys, [0.5, 99.5]).astype(int)
    return int(x0), int(y0), int(x1), int(y1)


def _mascaras_de_divisoria(imagem: np.ndarray, hsv: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    cinza = cv2.GaussianBlur(cv2.cvtColor(imagem, cv2.COLOR_BGR2GRAY), (5, 5), 0).astype(np.int16)
    e_pino = hsv[..., 1] > SATURACAO_DE_PINO
    lados_x = np.maximum(np.roll(cinza, DISTANCIA_LATERAL, 1), np.roll(cinza, -DISTANCIA_LATERAL, 1))
    lados_y = np.maximum(np.roll(cinza, DISTANCIA_LATERAL, 0), np.roll(cinza, -DISTANCIA_LATERAL, 0))
    verticais = (((cinza - lados_x) > CONTRASTE_MINIMO) & ~e_pino).astype(np.uint8) * 255
    horizontais = (((cinza - lados_y) > CONTRASTE_MINIMO) & ~e_pino).astype(np.uint8) * 255
    verticais = cv2.morphologyEx(verticais, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, KERNEL_DE_LINHA)))
    horizontais = cv2.morphologyEx(horizontais, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (KERNEL_DE_LINHA, 1)))
    return verticais, horizontais


def _picos(perfil: np.ndarray, valor_minimo: float, distancia_minima: int) -> list[int]:
    suave = cv2.GaussianBlur(perfil.reshape(1, -1).astype(np.float32), (0, 0), 3).ravel()
    encontrados: list[int] = []
    for i in np.argsort(suave)[::-1]:
        if suave[i] < valor_minimo:
            break
        if all(abs(int(i) - j) >= distancia_minima for j in encontrados):
            encontrados.append(int(i))
    return sorted(encontrados)


def _cobertura(mascara: np.ndarray, regiao: tuple[slice, slice], eixo: int) -> float:
    recorte = mascara[regiao]
    if recorte.size == 0:
        return 1.0
    return float((recorte.max(axis=eixo) > 0).mean())


def _procurar_trechos_ausentes(grade: Grade, verticais: np.ndarray, horizontais: np.ndarray) -> None:
    xs, ys = grade.posicoes_x, grade.posicoes_y
    for coluna, x in enumerate(xs[1:-1]):
        for linha, (ya, yb) in enumerate(zip(ys, ys[1:])):
            margem = (yb - ya) // 5
            regiao = (slice(ya + margem, yb - margem), slice(max(x - FAIXA_DO_TRECHO, 0), x + FAIXA_DO_TRECHO))
            cobertura = _cobertura(verticais, regiao, eixo=1)
            if cobertura < COBERTURA_MINIMA:
                grade.trechos_ausentes.append(TrechoAusente("vertical", linha, coluna, (x, ya), (x, yb), round(cobertura, 2)))
    for linha, y in enumerate(ys[1:-1]):
        for coluna, (xa, xb) in enumerate(zip(xs, xs[1:])):
            margem = (xb - xa) // 5
            regiao = (slice(max(y - FAIXA_DO_TRECHO, 0), y + FAIXA_DO_TRECHO), slice(xa + margem, xb - margem))
            cobertura = _cobertura(horizontais, regiao, eixo=0)
            if cobertura < COBERTURA_MINIMA:
                grade.trechos_ausentes.append(TrechoAusente("horizontal", linha, coluna, (xa, y), (xb, y), round(cobertura, 2)))


def _unir_compartimentos(grade: Grade) -> None:
    # Cada trecho ausente une as duas células vizinhas num único compartimento.
    raiz = {(l, c): (l, c) for l in range(grade.linhas) for c in range(grade.colunas)}

    def encontrar(celula):
        while raiz[celula] != celula:
            raiz[celula] = raiz[raiz[celula]]
            celula = raiz[celula]
        return celula

    for trecho in grade.trechos_ausentes:
        l, c = trecho.linha, trecho.coluna
        vizinha = (l, c + 1) if trecho.orientacao == "vertical" else (l + 1, c)
        raiz[encontrar((l, c))] = encontrar(vizinha)

    grupos: dict = {}
    for celula in raiz:
        grupos.setdefault(encontrar(celula), []).append(celula)
    grade.compartimentos = sorted(grupos.values())


def detectar_grade(imagem: np.ndarray) -> Grade:
    hsv = cv2.cvtColor(imagem, cv2.COLOR_BGR2HSV)
    limites = _limites_da_caixa(hsv)
    if limites is None:
        return Grade()
    x0, y0, x1, y1 = limites
    largura, altura = x1 - x0, y1 - y0

    verticais, horizontais = _mascaras_de_divisoria(imagem, hsv)
    perfil_x = (verticais[y0:y1, :] > 0).sum(axis=0) / altura
    perfil_y = (horizontais[:, x0:x1] > 0).sum(axis=1) / largura
    internas_x = [x for x in _picos(perfil_x, PICO_MINIMO, largura // 9)
                  if x0 + largura * MARGEM_PAREDE_X < x < x1 - largura * MARGEM_PAREDE_X]
    internas_y = [y for y in _picos(perfil_y, PICO_MINIMO, altura // 6)
                  if y0 + altura * MARGEM_PAREDE_Y < y < y1 - altura * MARGEM_PAREDE_Y]

    grade = Grade(posicoes_x=[x0, *internas_x, x1], posicoes_y=[y0, *internas_y, y1])
    _procurar_trechos_ausentes(grade, verticais, horizontais)
    _unir_compartimentos(grade)
    return grade


def desenhar_grade(imagem: np.ndarray, grade: Grade) -> np.ndarray:
    resultado = imagem.copy()
    altura, largura = resultado.shape[:2]
    for x in grade.posicoes_x:
        cv2.line(resultado, (x, 0), (x, altura), COR_VERTICAL, 2)
    for y in grade.posicoes_y:
        cv2.line(resultado, (0, y), (largura, y), COR_HORIZONTAL, 2)
    for trecho in grade.trechos_ausentes:
        cv2.line(resultado, trecho.inicio, trecho.fim, COR_AUSENTE, 8)
    return resultado
