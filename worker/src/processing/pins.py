"""Detecção e classificação dos pinos: cor e integridade do corpo."""

from dataclasses import dataclass

import cv2
import numpy as np

# Qualquer objeto saturado sobre o fundo escuro é candidato a pino, de qualquer cor;
# o pino verde-escuro tem brilho próximo ao do fundo e só se separa pela saturação.
CHROMA_SATURATION = 90
CHROMA_VALUE = 30
YELLOW_HUE = (9, 35)
RED_HUE_MAX = 8
RED_HUE_WRAP = 170
RED_SATURATION = 120
RED_VALUE = 60
RED_MIN_PIXELS = 25
OTHER_COLOR_FRACTION = 0.4

# Reflexos amarelados na parede transparente têm cerca de 10% da área de um pino.
MIN_RELATIVE_AREA = 0.3
MERGED_RELATIVE_AREA = 1.6
DAMAGED_RELATIVE_AREA = 0.8
DAMAGED_RELATIVE_LENGTH = 0.88

# Referência medida no dataset, usada quando há poucos pinos para tirar a mediana da imagem.
REFERENCE_AREA = 5280.0
REFERENCE_LENGTH = 121.0
MIN_PINS_FOR_MEDIAN = 5
GEOMETRY_KERNEL = 11

COLOR_VALID = (0, 255, 0)
COLOR_INVALID = (0, 165, 255)
COLOR_CRITICAL = (0, 0, 255)


@dataclass
class Pin:
    contour: np.ndarray
    area: float
    length: float
    centroid: np.ndarray
    axis: np.ndarray
    extent: tuple[float, float]
    red_pixels: int = 0
    other_fraction: float = 0.0
    merged: bool = False
    wrong_color: bool = False
    damaged: bool = False

    @property
    def box(self) -> tuple[int, int, int, int]:
        x, y, w, h = cv2.boundingRect(self.contour)
        return int(x), int(y), int(w), int(h)


def _color_masks(hsv: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    h, s, v = cv2.split(hsv)
    chroma = ((s >= CHROMA_SATURATION) & (v >= CHROMA_VALUE)).astype(np.uint8) * 255
    chroma = cv2.morphologyEx(chroma, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    chroma = cv2.morphologyEx(chroma, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    red = (((h <= RED_HUE_MAX) | (h >= RED_HUE_WRAP)) & (s >= RED_SATURATION) & (v >= RED_VALUE)).astype(np.uint8)
    red = cv2.morphologyEx(red, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    yellow = (h >= YELLOW_HUE[0]) & (h <= YELLOW_HUE[1])
    return chroma, red, yellow


def _geometry(points: np.ndarray) -> tuple[np.ndarray, np.ndarray, tuple[float, float]]:
    centroid = points.mean(axis=0)
    _, _, vt = np.linalg.svd(points - centroid, full_matrices=False)
    axis = vt[0]
    proj = (points - centroid) @ axis
    return centroid, axis, (float(proj.min()), float(proj.max()))


def _make_pin(mask: np.ndarray, red: np.ndarray, yellow: np.ndarray) -> Pin | None:
    # Reflexos do pino no plástico vizinho grudam no corpo como apêndices finos e entortam o eixo.
    body = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (GEOMETRY_KERNEL,) * 2))
    if cv2.countNonZero(body) < cv2.countNonZero(mask) * 0.5:
        body = mask
    contours, _ = cv2.findContours(body, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return None
    contour = max(contours, key=cv2.contourArea)
    ys, xs = np.nonzero(body)
    points = np.column_stack([xs, ys]).astype(np.float64)
    centroid, axis, extent = _geometry(points)
    (_, _), (w, h), _ = cv2.minAreaRect(contour)
    inside = mask > 0
    red_pixels = int(red[cv2.dilate(mask, np.ones((5, 5), np.uint8)) > 0].sum())
    not_yellow = ~yellow[inside]
    not_red = red[inside] == 0
    other_fraction = float((not_yellow & not_red).mean()) if inside.any() else 0.0
    return Pin(
        contour=contour, area=float(inside.sum()), length=float(max(w, h)),
        centroid=centroid, axis=axis, extent=extent,
        red_pixels=red_pixels, other_fraction=other_fraction,
    )


def _split_merged(mask: np.ndarray, count: int) -> list[np.ndarray]:
    ys, xs = np.nonzero(mask)
    data = np.column_stack([xs, ys]).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.5)
    _, labels, _ = cv2.kmeans(data, count, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
    parts = []
    for k in range(count):
        part = np.zeros_like(mask)
        sel = labels.ravel() == k
        part[ys[sel], xs[sel]] = 255
        parts.append(part)
    return parts


def detect_pins(image: np.ndarray) -> list[Pin]:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    chroma, red, yellow = _color_masks(hsv)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(chroma)
    areas = stats[1:, cv2.CC_STAT_AREA].astype(float)
    big = areas[areas > REFERENCE_AREA * MIN_RELATIVE_AREA]
    typical_area = float(np.median(big)) if len(big) >= MIN_PINS_FOR_MEDIAN else REFERENCE_AREA

    pins: list[Pin] = []
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < typical_area * MIN_RELATIVE_AREA:
            continue
        mask = (labels == i).astype(np.uint8) * 255
        count = int(round(area / typical_area))
        if area >= typical_area * MERGED_RELATIVE_AREA and count >= 2:
            for part in _split_merged(mask, count):
                pin = _make_pin(part, red, yellow)
                if pin:
                    pin.merged = True
                    pins.append(pin)
            continue
        pin = _make_pin(mask, red, yellow)
        if pin:
            pins.append(pin)

    _classify(pins)
    return pins


def _classify(pins: list[Pin]) -> None:
    singles = [p for p in pins if not p.merged]
    enough = len(singles) >= MIN_PINS_FOR_MEDIAN
    typical_area = float(np.median([p.area for p in singles])) if enough else REFERENCE_AREA
    typical_length = float(np.median([p.length for p in singles])) if enough else REFERENCE_LENGTH
    for pin in pins:
        pin.wrong_color = pin.red_pixels >= RED_MIN_PIXELS or pin.other_fraction >= OTHER_COLOR_FRACTION
        if not pin.merged:
            pin.damaged = (
                pin.area < typical_area * DAMAGED_RELATIVE_AREA
                or pin.length < typical_length * DAMAGED_RELATIVE_LENGTH
            )


def summarize_pins(pins: list[Pin]) -> dict:
    ok = sum(1 for p in pins if not p.wrong_color and not p.damaged)
    wrong = sum(1 for p in pins if p.wrong_color and not p.damaged)
    damaged = sum(1 for p in pins if p.damaged and not p.wrong_color)
    double = sum(1 for p in pins if p.damaged and p.wrong_color)
    singles = [p.area for p in pins if not p.merged]
    typical = float(np.median(singles)) if singles else 0.0
    return {
        "total_pins": len(pins),
        "valid_pins": ok,
        "invalid_pins": wrong + damaged,
        "critical_pins": double,
        "damaged_threshold": round(typical * DAMAGED_RELATIVE_AREA, 2),
        "average_area": round(typical, 2),
        "details": {
            "pins_ok": ok,
            "pins_wrong_color": wrong,
            "pins_damaged_yellow": damaged,
            "pins_double_defect": double,
        },
    }


def draw_pins(image: np.ndarray, pins: list[Pin]) -> np.ndarray:
    result = image.copy()
    for pin in pins:
        defects = int(pin.wrong_color) + int(pin.damaged)
        color = (COLOR_VALID, COLOR_INVALID, COLOR_CRITICAL)[defects]
        cv2.drawContours(result, [pin.contour], -1, color, 3)
    return result


def process_pins(image: np.ndarray) -> tuple[np.ndarray, list[Pin], dict]:
    pins = detect_pins(image)
    return draw_pins(image, pins), pins, summarize_pins(pins)
