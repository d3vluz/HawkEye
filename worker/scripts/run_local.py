"""
Roda o pipeline de analise localmente.
Não precisa de Docker, MinIO ou frontend.

Uso:
    python scripts/run_local.py <imagem>
    python scripts/run_local.py <imagem> --output ./saida
    python scripts/run_local.py <imagem> --steps areas pins

Saída padrão: worker/scripts/output/
"""
import argparse
import json
import sys
from pathlib import Path

import cv2

# Permite importar de worker/src/ sem instalar o pacote
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from pipeline import PIPELINE_STEPS, PipelineContext


def parse_args():
    parser = argparse.ArgumentParser(description="HawkEye — pipeline local")
    parser.add_argument("image", help="Caminho para a imagem de entrada")
    parser.add_argument("--output", default=str(Path(__file__).parent / "output"), help="Pasta de saída")
    parser.add_argument(
        "--steps",
        nargs="+",
        choices=[s.__name__.removeprefix("_step_") for s in PIPELINE_STEPS],
        default=None,
        help="Rodar apenas steps específicos (ex: --steps areas pins)",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    image_path = Path(args.image)
    if not image_path.exists():
        print(f"Erro: imagem não encontrada — {image_path}")
        sys.exit(1)

    original = cv2.imread(str(image_path))
    if original is None:
        print(f"Erro: não foi possível carregar a imagem — {image_path}")
        sys.exit(1)

    # Filtra steps se --steps foi passado
    if args.steps:
        step_names = {f"_step_{name}" for name in args.steps}
        steps = [s for s in PIPELINE_STEPS if s.__name__ in step_names]
    else:
        steps = PIPELINE_STEPS

    print(f"Imagem : {image_path.name} ({original.shape[1]}x{original.shape[0]})")
    print(f"Steps  : {[s.__name__.removeprefix('_step_') for s in steps]}")
    print(f"Saída  : {args.output}\n")

    ctx = PipelineContext(original=original)
    for step in steps:
        name = step.__name__.removeprefix("_step_")
        print(f"  → {name}...", end=" ", flush=True)
        step(ctx)
        print("ok")

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    outputs = {
        "areas": ctx.areas_img,
        "pins": ctx.pins_img,
        "boxes": ctx.boxes_img,
        "shafts": ctx.shafts_img,
    }

    print()
    for name, img in outputs.items():
        if img is not None:
            out_path = output_dir / f"{image_path.stem}_{name}.png"
            cv2.imwrite(str(out_path), img)
            print(f"  Salvo: {out_path}")

    summary = {
        "areas_count": ctx.areas_count,
        "grid": [ctx.grid.rows, ctx.grid.cols],
        "missing_dividers": ctx.grid.missing_segments,
        "pins_count": ctx.pins_count,
        "boxes_info": ctx.boxes_info,
        "pin_classification": ctx.pin_classification,
        "shaft_classification": ctx.shaft_classification,
    }
    summary_path = output_dir / f"{image_path.stem}_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"  Salvo: {summary_path}")

    print(f"\nÁreas detectadas : {ctx.areas_count}")
    print(f"Pins detectados  : {ctx.pins_count}")


if __name__ == "__main__":
    main()
