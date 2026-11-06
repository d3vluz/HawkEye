"""Roda as quatro etapas de inspeção numa imagem e monta o resultado no formato esperado pela API."""

from dataclasses import dataclass

import numpy as np

from etapas.compartimentos import Compartimento, contar_por_compartimento, desenhar_compartimentos
from etapas.grade import Grade, desenhar_grade, detectar_grade
from etapas.hastes import Haste, desenhar_hastes, medir_hastes
from etapas.pinos import Pino, desenhar_pinos, detectar_pinos, medidas_tipicas


@dataclass
class Analise:
    grade: Grade
    pinos: list[Pino]
    compartimentos: list[Compartimento]
    hastes: list[Haste]
    # Uma imagem anotada por etapa; as chaves viram o nome do arquivo no storage.
    imagens: dict[str, np.ndarray]


def analisar(imagem: np.ndarray) -> Analise:
    grade = detectar_grade(imagem)
    pinos = detectar_pinos(imagem)
    tipicas = medidas_tipicas(pinos)
    compartimentos = contar_por_compartimento(pinos, grade)
    hastes = medir_hastes(imagem, pinos, tipicas)
    return Analise(
        grade=grade,
        pinos=pinos,
        compartimentos=compartimentos,
        hastes=hastes,
        imagens={
            "areas": desenhar_grade(imagem, grade),
            "pins": desenhar_pinos(imagem, pinos),
            "boxes": desenhar_compartimentos(imagem, compartimentos),
            "shafts": desenhar_hastes(imagem, pinos, hastes, tipicas),
        },
    )


def _contar(itens, condicao) -> int:
    return sum(1 for item in itens if condicao(item))


def resumo(analise: Analise) -> dict:
    """Contagens no formato do contrato com a API (chaves em inglês, compartilhadas com o frontend)."""
    pinos, compartimentos, hastes = analise.pinos, analise.compartimentos, analise.hastes
    situacao_em_ingles = {"vazio": "empty", "certo": "single", "pino_a_mais": "multiple"}
    rejeitadas = _contar(hastes, lambda h: h.defeito is not None)
    return {
        "areas_count": len(analise.grade.compartimentos),
        "grid_rows": analise.grade.linhas,
        "grid_cols": analise.grade.colunas,
        "missing_dividers": [
            {"orientation": t.orientacao, "row": t.linha, "col": t.coluna, "coverage": t.cobertura}
            for t in analise.grade.trechos_ausentes
        ],
        "pins_count": len(pinos),
        "pin_classification": {
            "total_pins": len(pinos),
            "details": {
                "pins_ok": _contar(pinos, lambda p: not p.cor_errada and not p.danificado),
                "pins_wrong_color": _contar(pinos, lambda p: p.cor_errada and not p.danificado),
                "pins_damaged_yellow": _contar(pinos, lambda p: p.danificado and not p.cor_errada),
                "pins_double_defect": _contar(pinos, lambda p: p.cor_errada and p.danificado),
            },
        },
        "boxes_info": {
            "total_boxes": len(compartimentos),
            "empty_boxes": _contar(compartimentos, lambda c: c.situacao == "vazio"),
            "single_pin_boxes": _contar(compartimentos, lambda c: c.situacao == "certo"),
            "multiple_pins_boxes": _contar(compartimentos, lambda c: c.situacao == "pino_a_mais"),
            "boxes": [
                {"x": c.x, "y": c.y, "width": c.largura, "height": c.altura,
                 "pins_count": c.pinos, "status": situacao_em_ingles[c.situacao]}
                for c in compartimentos
            ],
        },
        "shaft_classification": {
            "total_shafts": len(hastes),
            "approved_shafts": len(hastes) - rejeitadas,
            "rejected_shafts": rejeitadas,
        },
    }
