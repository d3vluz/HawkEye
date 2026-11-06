from dataclasses import dataclass, field
from typing import Callable

import numpy as np

from processing import process_areas, process_boxes, process_pins, process_shafts
from processing.areas import Grid
from processing.pins import Pin


@dataclass
class PipelineContext:
    original: np.ndarray

    areas_img: np.ndarray | None = None
    grid: Grid = field(default_factory=Grid)

    pins_img: np.ndarray | None = None
    pins: list[Pin] = field(default_factory=list)
    pin_classification: dict = field(default_factory=dict)

    boxes_img: np.ndarray | None = None
    boxes_info: dict = field(default_factory=dict)

    shafts_img: np.ndarray | None = None
    shaft_classification: dict = field(default_factory=dict)

    @property
    def areas_count(self) -> int:
        return len(self.grid.compartments)

    @property
    def pins_count(self) -> int:
        return len(self.pins)


def _step_areas(ctx: PipelineContext) -> None:
    ctx.areas_img, ctx.grid = process_areas(ctx.original)


def _step_pins(ctx: PipelineContext) -> None:
    ctx.pins_img, ctx.pins, ctx.pin_classification = process_pins(ctx.original)


def _step_boxes(ctx: PipelineContext) -> None:
    ctx.boxes_img, ctx.boxes_info = process_boxes(ctx.original, ctx.pins, ctx.grid)


def _step_shafts(ctx: PipelineContext) -> None:
    ctx.shafts_img, ctx.shaft_classification = process_shafts(ctx.original, ctx.pins)


# Ordem importa: boxes usa a grade e os pinos; shafts usa os pinos.
PIPELINE_STEPS: list[Callable[[PipelineContext], None]] = [
    _step_areas,
    _step_pins,
    _step_boxes,
    _step_shafts,
]


def run_pipeline(original: np.ndarray) -> PipelineContext:
    ctx = PipelineContext(original=original)
    for step in PIPELINE_STEPS:
        step(ctx)
    return ctx
