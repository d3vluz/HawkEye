"""Contagem de pinos por compartimento."""

from typing import Any

import cv2
import numpy as np

from processing.areas import Grid
from processing.pins import Pin

COLOR_EMPTY = (0, 0, 255)
COLOR_SINGLE = (0, 255, 0)
COLOR_MULTIPLE = (0, 165, 255)


def _cell_of(grid: Grid, point: np.ndarray) -> tuple[int, int] | None:
    col = int(np.searchsorted(grid.x_positions, point[0])) - 1
    row = int(np.searchsorted(grid.y_positions, point[1])) - 1
    if 0 <= row < grid.rows and 0 <= col < grid.cols:
        return row, col
    return None


def process_boxes(image: np.ndarray, pins: list[Pin], grid: Grid) -> tuple[np.ndarray, dict[str, Any]]:
    result = image.copy()
    empty_info = {"total_boxes": 0, "empty_boxes": 0, "single_pin_boxes": 0, "multiple_pins_boxes": 0, "boxes": []}
    if grid.rows == 0 or grid.cols == 0:
        return result, empty_info

    per_cell: dict[tuple[int, int], int] = {}
    for pin in pins:
        cell = _cell_of(grid, pin.centroid)
        if cell is not None:
            per_cell[cell] = per_cell.get(cell, 0) + 1

    boxes = []
    counts = {"empty": 0, "single": 0, "multiple": 0}
    xs, ys = grid.x_positions, grid.y_positions
    # Um compartimento sem divisória ocupa várias células e comporta um pino por célula.
    for cells in grid.compartments:
        pins_inside = sum(per_cell.get(c, 0) for c in cells)
        if pins_inside == 0:
            status, color = "empty", COLOR_EMPTY
        elif pins_inside <= len(cells):
            status, color = "single", COLOR_SINGLE
        else:
            status, color = "multiple", COLOR_MULTIPLE
        counts[status] += 1

        x1 = min(xs[c] for _, c in cells)
        x2 = max(xs[c + 1] for _, c in cells)
        y1 = min(ys[r] for r, _ in cells)
        y2 = max(ys[r + 1] for r, _ in cells)
        cv2.rectangle(result, (x1 + 4, y1 + 4), (x2 - 4, y2 - 4), color, 2)
        cv2.putText(result, str(pins_inside), ((x1 + x2) // 2 - 10, (y1 + y2) // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)
        boxes.append({
            "x": int(x1), "y": int(y1), "width": int(x2 - x1), "height": int(y2 - y1),
            "pins_count": int(pins_inside), "cells": len(cells), "status": status,
        })

    return result, {
        "total_boxes": len(boxes),
        "empty_boxes": counts["empty"],
        "single_pin_boxes": counts["single"],
        "multiple_pins_boxes": counts["multiple"],
        "boxes": boxes,
    }
