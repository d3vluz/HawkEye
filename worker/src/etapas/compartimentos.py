"""Etapa 3: conta os pinos de cada compartimento e marca os vazios e os com pino a mais."""

from dataclasses import dataclass

import cv2
import numpy as np

from etapas.grade import Grade
from etapas.pinos import Pino

COR_VAZIO = (0, 0, 255)
COR_CERTO = (0, 255, 0)
COR_PINO_A_MAIS = (0, 165, 255)


@dataclass
class Compartimento:
    x: int
    y: int
    largura: int
    altura: int
    pinos: int
    situacao: str  # "vazio", "certo" ou "pino_a_mais"


def contar_por_compartimento(pinos: list[Pino], grade: Grade) -> list[Compartimento]:
    por_celula: dict[tuple[int, int], int] = {}
    for pino in pinos:
        celula = grade.celula_do_ponto(pino.centro)
        if celula is not None:
            por_celula[celula] = por_celula.get(celula, 0) + 1

    xs, ys = grade.posicoes_x, grade.posicoes_y
    compartimentos = []
    # Um compartimento sem divisória ocupa várias células e comporta um pino por célula.
    for celulas in grade.compartimentos:
        quantidade = sum(por_celula.get(c, 0) for c in celulas)
        if quantidade == 0:
            situacao = "vazio"
        elif quantidade <= len(celulas):
            situacao = "certo"
        else:
            situacao = "pino_a_mais"
        x0 = min(xs[c] for _, c in celulas)
        x1 = max(xs[c + 1] for _, c in celulas)
        y0 = min(ys[l] for l, _ in celulas)
        y1 = max(ys[l + 1] for l, _ in celulas)
        compartimentos.append(Compartimento(int(x0), int(y0), int(x1 - x0), int(y1 - y0), quantidade, situacao))
    return compartimentos


def desenhar_compartimentos(imagem: np.ndarray, compartimentos: list[Compartimento]) -> np.ndarray:
    resultado = imagem.copy()
    cores = {"vazio": COR_VAZIO, "certo": COR_CERTO, "pino_a_mais": COR_PINO_A_MAIS}
    for c in compartimentos:
        cor = cores[c.situacao]
        cv2.rectangle(resultado, (c.x + 4, c.y + 4), (c.x + c.largura - 4, c.y + c.altura - 4), cor, 2)
        cv2.putText(resultado, str(c.pinos), (c.x + c.largura // 2 - 10, c.y + c.altura // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, cor, 2)
    return resultado
