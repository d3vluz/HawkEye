"""Grade da caixa: posição das divisórias e trechos de divisória ausentes."""

from dataclasses import dataclass, field

import cv2
import numpy as np

# Divisória = faixa mais clara que os dois lados a RIDGE_OFFSET px; amarelo saturado não conta.
RIDGE_OFFSET = 24
RIDGE_MIN_CONTRAST = 30
CHROMA_SATURATION = 120
LINE_KERNEL = 41
PEAK_MIN_FRACTION = 0.2
WALL_MARGIN_X = 0.04
WALL_MARGIN_Y = 0.06
SEGMENT_BAND = 18
# Nas caixas íntegras o pior trecho fica acima de 0,4; trechos ausentes medem perto de 0.
SEGMENT_MIN_COVERAGE = 0.3

COLOR_VERTICAL = (255, 0, 255)
COLOR_HORIZONTAL = (0, 255, 0)
COLOR_MISSING = (0, 0, 255)


@dataclass
class Grid:
    x_positions: list[int] = field(default_factory=list)
    y_positions: list[int] = field(default_factory=list)
    missing_segments: list[dict] = field(default_factory=list)
    compartments: list[list[tuple[int, int]]] = field(default_factory=list)

    @property
    def rows(self) -> int:
        return max(len(self.y_positions) - 1, 0)

    @property
    def cols(self) -> int:
        return max(len(self.x_positions) - 1, 0)


def _box_bounds(hsv: np.ndarray) -> tuple[int, int, int, int] | None:
    plastic = ((hsv[..., 1] < 70) & (hsv[..., 2] > 110)).astype(np.uint8)
    plastic = cv2.morphologyEx(plastic, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    ys, xs = np.nonzero(plastic)
    if len(xs) < 1000:
        return None
    x0, x1 = np.percentile(xs, [0.5, 99.5]).astype(int)
    y0, y1 = np.percentile(ys, [0.5, 99.5]).astype(int)
    return int(x0), int(y0), int(x1), int(y1)


def _ridge_masks(image: np.ndarray, hsv: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    gray = cv2.GaussianBlur(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY), (5, 5), 0).astype(np.int16)
    chroma = hsv[..., 1] > CHROMA_SATURATION
    side_x = np.maximum(np.roll(gray, RIDGE_OFFSET, 1), np.roll(gray, -RIDGE_OFFSET, 1))
    side_y = np.maximum(np.roll(gray, RIDGE_OFFSET, 0), np.roll(gray, -RIDGE_OFFSET, 0))
    vertical = (((gray - side_x) > RIDGE_MIN_CONTRAST) & ~chroma).astype(np.uint8) * 255
    horizontal = (((gray - side_y) > RIDGE_MIN_CONTRAST) & ~chroma).astype(np.uint8) * 255
    vertical = cv2.morphologyEx(vertical, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, LINE_KERNEL)))
    horizontal = cv2.morphologyEx(horizontal, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (LINE_KERNEL, 1)))
    return vertical, horizontal


def _peaks(profile: np.ndarray, min_value: float, min_gap: int) -> list[int]:
    smooth = cv2.GaussianBlur(profile.reshape(1, -1).astype(np.float32), (0, 0), 3).ravel()
    found: list[int] = []
    for i in np.argsort(smooth)[::-1]:
        if smooth[i] < min_value:
            break
        if all(abs(int(i) - j) >= min_gap for j in found):
            found.append(int(i))
    return sorted(found)


def _coverage(mask: np.ndarray, band: tuple[slice, slice], axis: int) -> float:
    region = mask[band]
    if region.size == 0:
        return 1.0
    return float((region.max(axis=axis) > 0).mean())


def _find_missing(grid: Grid, vertical: np.ndarray, horizontal: np.ndarray) -> None:
    xs, ys = grid.x_positions, grid.y_positions
    for col, x in enumerate(xs[1:-1]):
        for row, (ya, yb) in enumerate(zip(ys, ys[1:])):
            margin = (yb - ya) // 5
            band = (slice(ya + margin, yb - margin), slice(max(x - SEGMENT_BAND, 0), x + SEGMENT_BAND))
            cov = _coverage(vertical, band, axis=1)
            if cov < SEGMENT_MIN_COVERAGE:
                grid.missing_segments.append({
                    "orientation": "vertical", "row": row, "col": col,
                    "x1": x, "y1": ya, "x2": x, "y2": yb, "coverage": round(cov, 2),
                })
    for row, y in enumerate(ys[1:-1]):
        for col, (xa, xb) in enumerate(zip(xs, xs[1:])):
            margin = (xb - xa) // 5
            band = (slice(max(y - SEGMENT_BAND, 0), y + SEGMENT_BAND), slice(xa + margin, xb - margin))
            cov = _coverage(horizontal, band, axis=0)
            if cov < SEGMENT_MIN_COVERAGE:
                grid.missing_segments.append({
                    "orientation": "horizontal", "row": row, "col": col,
                    "x1": xa, "y1": y, "x2": xb, "y2": y, "coverage": round(cov, 2),
                })


def _merge_compartments(grid: Grid) -> None:
    parent = {(r, c): (r, c) for r in range(grid.rows) for c in range(grid.cols)}

    def find(cell):
        while parent[cell] != cell:
            parent[cell] = parent[parent[cell]]
            cell = parent[cell]
        return cell

    for seg in grid.missing_segments:
        r, c = seg["row"], seg["col"]
        a, b = ((r, c), (r, c + 1)) if seg["orientation"] == "vertical" else ((r, c), (r + 1, c))
        parent[find(a)] = find(b)

    groups: dict = {}
    for cell in parent:
        groups.setdefault(find(cell), []).append(cell)
    grid.compartments = sorted(groups.values())


def detect_grid(image: np.ndarray) -> Grid:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    bounds = _box_bounds(hsv)
    if bounds is None:
        return Grid()
    x0, y0, x1, y1 = bounds
    width, height = x1 - x0, y1 - y0

    vertical, horizontal = _ridge_masks(image, hsv)
    v_profile = (vertical[y0:y1, :] > 0).sum(axis=0) / height
    h_profile = (horizontal[:, x0:x1] > 0).sum(axis=1) / width
    inner_x = [x for x in _peaks(v_profile, PEAK_MIN_FRACTION, width // 9)
               if x0 + width * WALL_MARGIN_X < x < x1 - width * WALL_MARGIN_X]
    inner_y = [y for y in _peaks(h_profile, PEAK_MIN_FRACTION, height // 6)
               if y0 + height * WALL_MARGIN_Y < y < y1 - height * WALL_MARGIN_Y]

    grid = Grid(x_positions=[x0, *inner_x, x1], y_positions=[y0, *inner_y, y1])
    _find_missing(grid, vertical, horizontal)
    _merge_compartments(grid)
    return grid


def draw_grid(image: np.ndarray, grid: Grid) -> np.ndarray:
    result = image.copy()
    h, w = result.shape[:2]
    for x in grid.x_positions:
        cv2.line(result, (x, 0), (x, h), COLOR_VERTICAL, 2)
    for y in grid.y_positions:
        cv2.line(result, (0, y), (w, y), COLOR_HORIZONTAL, 2)
    for seg in grid.missing_segments:
        cv2.line(result, (seg["x1"], seg["y1"]), (seg["x2"], seg["y2"]), COLOR_MISSING, 8)
    return result


def process_areas(image: np.ndarray) -> tuple[np.ndarray, Grid]:
    if image is None:
        return np.zeros((100, 100, 3), dtype=np.uint8), Grid()
    grid = detect_grid(image)
    return draw_grid(image, grid), grid
