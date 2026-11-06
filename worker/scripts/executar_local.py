"""Analisa uma imagem do disco sem Docker nem MinIO e salva as imagens anotadas e o resumo em JSON.

Uso:
    python scripts/executar_local.py <imagem> [--saida pasta]
"""

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from analise import analisar, resumo  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("imagem")
    parser.add_argument("--saida", default=str(Path(__file__).parent / "saida"))
    args = parser.parse_args()

    caminho = Path(args.imagem)
    imagem = cv2.imdecode(np.fromfile(str(caminho), dtype=np.uint8), cv2.IMREAD_COLOR) if caminho.exists() else None
    if imagem is None:
        sys.exit(f"Não foi possível abrir a imagem: {caminho}")

    analise = analisar(imagem)
    saida = Path(args.saida)
    saida.mkdir(parents=True, exist_ok=True)
    for etapa, anotada in analise.imagens.items():
        cv2.imwrite(str(saida / f"{caminho.stem}_{etapa}.png"), anotada)
    dados = resumo(analise)
    (saida / f"{caminho.stem}_resumo.json").write_text(json.dumps(dados, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Grade {dados['grid_rows']}x{dados['grid_cols']}, {dados['areas_count']} compartimentos, "
          f"{dados['pins_count']} pinos, {dados['shaft_classification']['rejected_shafts']} hastes com defeito")
    print(f"Arquivos em {saida}")


if __name__ == "__main__":
    main()
