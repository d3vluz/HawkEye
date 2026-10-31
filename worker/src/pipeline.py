from dataclasses import dataclass, field
from typing import Callable
import numpy as np

from processing import process_areas, process_pins, process_boxes, process_shafts


@dataclass
class PipelineContext:
    original: np.ndarray
    border_mask: np.ndarray | None = None

    # areas
    areas_img: np.ndarray | None = None
    areas_count: int = 0
    x_positions: list = field(default_factory=list)
    y_positions: list = field(default_factory=list)

    # pins
    pins_img: np.ndarray | None = None
    pins_count: int = 0
    pin_boxes: list = field(default_factory=list)
    pin_classification: dict = field(default_factory=dict)

    # boxes
    boxes_img: np.ndarray | None = None
    boxes_info: dict = field(default_factory=dict)

    # shafts
    shafts_img: np.ndarray | None = None
    shaft_classification: dict = field(default_factory=dict)


def _step_areas(ctx: PipelineContext) -> None:
    ctx.areas_img, ctx.areas_count, ctx.x_positions, ctx.y_positions = process_areas(ctx.original)


def _step_pins(ctx: PipelineContext) -> None:
    ctx.pins_img, ctx.pins_count, ctx.pin_boxes, ctx.pin_classification = process_pins(ctx.original)


def _step_boxes(ctx: PipelineContext) -> None:
    ctx.boxes_img, ctx.boxes_info = process_boxes(
        ctx.original, ctx.pin_boxes, ctx.x_positions, ctx.y_positions
    )


def _step_shafts(ctx: PipelineContext) -> None:
    ctx.shafts_img, ctx.shaft_classification = process_shafts(
        ctx.original,
        border_mask=ctx.border_mask,
        apply_border_centralization=True,
        apply_border_removal=True,
    )


# Registro ordenado de steps — adicionar novos aqui
PIPELINE_STEPS: list[Callable[[PipelineContext], None]] = [
    _step_areas,
    _step_pins,
    _step_boxes,
    _step_shafts,
]


def run_pipeline(original: np.ndarray, border_mask: np.ndarray | None = None) -> PipelineContext:
    ctx = PipelineContext(original=original, border_mask=border_mask)
    for step in PIPELINE_STEPS:
        step(ctx)
    return ctx
