"""Mede a análise contra um dataset rotulado: cada subpasta é uma classe de defeito.

Uso:
    python scripts/avaliar.py <pasta-do-dataset> [--processos 8] [--saida resultados.json] [--classes Estado_OK ...]
"""

import argparse
import io
import json
import sys
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from analise import analisar, resumo  # noqa: E402

LINHAS_ESPERADAS, COLUNAS_ESPERADAS = 3, 5
DEFEITOS = ["faltando", "a_mais", "danificado", "cor_errada", "haste", "estrutura"]

ESPERADO_POR_CLASSE = {
    "Estado_OK": set(),
    "Ausencia_de_Pins": {"faltando"},
    "Excesso_de_Pins": {"a_mais"},
    "Excesso∩Ausencia_de_Pins": {"faltando", "a_mais"},
    "Deformidade_Pins": {"danificado"},
    "Deformidade_Hastes": {"haste"},
    "Pins_Incorretos": {"cor_errada"},
    "Problemas_Estrutura_Caixa": {"estrutura"},
}


def defeitos_da_imagem(caminho: str) -> dict:
    # imdecode em vez de imread: o imread do Windows não abre caminhos com caracteres como "∩".
    imagem = cv2.imdecode(np.fromfile(caminho, dtype=np.uint8), cv2.IMREAD_COLOR)
    r = resumo(analisar(imagem))
    detalhes = r["pin_classification"]["details"]
    duplo = detalhes["pins_double_defect"]
    return {
        "caminho": caminho,
        "faltando": r["boxes_info"]["empty_boxes"] > 0,
        "a_mais": r["boxes_info"]["multiple_pins_boxes"] > 0,
        "danificado": detalhes["pins_damaged_yellow"] + duplo > 0,
        "cor_errada": detalhes["pins_wrong_color"] + duplo > 0,
        "haste": r["shaft_classification"]["rejected_shafts"] > 0,
        # Mesma regra da API: grade diferente da esperada ou divisória ausente (menos áreas que células).
        "estrutura": (r["grid_rows"], r["grid_cols"]) != (LINHAS_ESPERADAS, COLUNAS_ESPERADAS)
                     or r["areas_count"] != LINHAS_ESPERADAS * COLUNAS_ESPERADAS,
    }


def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset")
    parser.add_argument("--processos", type=int, default=8)
    parser.add_argument("--saida", default=None)
    parser.add_argument("--classes", nargs="+", default=None)
    args = parser.parse_args()

    tarefas = [
        (pasta.name, str(arquivo))
        for pasta in sorted(p for p in Path(args.dataset).iterdir() if p.is_dir())
        if not args.classes or pasta.name in args.classes
        for arquivo in sorted(pasta.glob("*.png"))
    ]
    with ProcessPoolExecutor(max_workers=args.processos) as executor:
        resultados = list(executor.map(defeitos_da_imagem, [c for _, c in tarefas], chunksize=4))

    por_classe = defaultdict(list)
    for (classe, _), resultado in zip(tarefas, resultados):
        resultado["classe"] = classe
        por_classe[classe].append(resultado)

    print(f"{'classe':<28}{'n':>5}{'veredito':>10}{'defeito certo':>15}   falsos alarmes")
    acertos_total = 0
    for classe, itens in por_classe.items():
        esperado = ESPERADO_POR_CLASSE.get(classe, set())
        veredito_certo = defeito_certo = 0
        falsos = Counter()
        for r in itens:
            apontados = {d for d in DEFEITOS if r[d]}
            veredito_certo += bool(apontados) if esperado else not apontados
            defeito_certo += esperado <= apontados if esperado else not apontados
            falsos.update(apontados - esperado)
        n = len(itens)
        acertos_total += veredito_certo
        extras = ", ".join(f"{k} {v}" for k, v in falsos.most_common())
        print(f"{classe:<28}{n:>5}{veredito_certo / n:>10.0%}{defeito_certo / n:>15.0%}   {extras}")
    print(f"\nveredito geral: {acertos_total}/{len(resultados)} = {acertos_total / len(resultados):.1%}")

    if args.saida:
        Path(args.saida).write_text(json.dumps(resultados, indent=1, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
