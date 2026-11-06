"""Medição das hastes (agulhas): procura agulhas quebradas, curtas ou tortas."""

import math
from typing import Any

import cv2
import numpy as np

from processing.pins import MIN_PINS_FOR_MEDIAN, REFERENCE_LENGTH, Pin

# O top-hat realça linhas finas e claras (agulhas) e descarta estruturas largas como as divisórias.
TOPHAT_KERNEL = 9
NEEDLE_MIN_RESPONSE = 14
# Plástico e corpos de pinos encobrem a agulha: ali a falta de resposta não conta como falha.
# A margem cobre as bordas finas e brilhantes do plástico, que o top-hat confunde com agulha.
PLASTIC_SATURATION = 100
PLASTIC_VALUE = 85
PLASTIC_MARGIN = 13

RAY_START = 3
RAY_END = 170
RAY_STEP = 2
RAY_OFFSETS = (-1.5, 0.0, 1.5)
ANGLE_SPREAD_DEG = 18
ANGLE_STEP_DEG = 3
END_CAP_DEPTH = 12
LATERAL_SPREAD = 12
LATERAL_STEP = 3
MIN_HIT_RATE = 0.7
# A agulha nasce colada ao disco: fundo visível antes do primeiro acerto indica outra estrutura.
MAX_LEADING_MISSES = 3
END_CHECK_SAMPLES = 8

# Relativos ao comprimento típico do corpo; a agulha íntegra mede cerca de 0,8 dele.
BROKEN_RELATIVE = 0.35
SHORT_RELATIVE = 0.65

COLOR_OK = (0, 255, 0)
COLOR_DEFECT = (0, 0, 255)

_ANGLES = np.radians(np.arange(-ANGLE_SPREAD_DEG, ANGLE_SPREAD_DEG + 1, ANGLE_STEP_DEG))
_DISTANCES = np.arange(RAY_START, RAY_END, RAY_STEP, dtype=np.float64)
_LATERAL_OFFSETS = np.arange(-LATERAL_SPREAD, LATERAL_SPREAD + 1, LATERAL_STEP, dtype=np.float64)


def _evidence_maps(image: np.ndarray, pins: list[Pin]) -> tuple[np.ndarray, np.ndarray]:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (TOPHAT_KERNEL, TOPHAT_KERNEL))
    tophat = cv2.morphologyEx(hsv[..., 2], cv2.MORPH_TOPHAT, kernel)
    plastic = ((hsv[..., 1] < PLASTIC_SATURATION) & (hsv[..., 2] > PLASTIC_VALUE)).astype(np.uint8)
    plastic = cv2.morphologyEx(plastic, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    plastic = cv2.dilate(plastic, np.ones((PLASTIC_MARGIN, PLASTIC_MARGIN), np.uint8))
    bodies = np.zeros_like(plastic)
    cv2.drawContours(bodies, [p.contour for p in pins], -1, 1, -1)
    bodies = cv2.dilate(bodies, np.ones((5, 5), np.uint8))
    unknown = (plastic | bodies) > 0
    needle = (tophat >= NEEDLE_MIN_RESPONSE) & ~unknown
    return needle, unknown


def _rays(needle: np.ndarray, unknown: np.ndarray, starts: np.ndarray, directions: np.ndarray) -> dict[str, np.ndarray]:
    """Mede cada raio (starts e directions com forma (R, 2)): comprimento, cobertura e se o fim é visível."""
    h, w = needle.shape
    normals = np.stack([-directions[:, 1], directions[:, 0]], axis=1)
    centers = starts[:, None, :] + _DISTANCES[None, :, None] * directions[:, None, :]
    samples = centers[:, :, None, :] + np.array(RAY_OFFSETS)[None, None, :, None] * normals[:, None, None, :]
    xs = np.rint(samples[..., 0]).astype(int)
    ys = np.rint(samples[..., 1]).astype(int)
    inside = ((xs >= 0) & (xs < w) & (ys >= 0) & (ys < h)).all(axis=2)
    xs, ys = np.clip(xs, 0, w - 1), np.clip(ys, 0, h - 1)
    hit = needle[ys, xs].any(axis=2) & inside
    hidden = (unknown[ys, xs].any(axis=2) & ~hit) | ~inside
    miss = ~hit & ~hidden

    hits = np.cumsum(hit, axis=1)
    misses = np.cumsum(miss, axis=1)
    rate = hits / np.maximum(hits + misses, 1)
    count = hit.shape[1]
    index = np.arange(count)[None, :]

    first_hit = np.where(hit.any(axis=1), hit.argmax(axis=1), count)
    leading = misses[np.arange(len(first_hit)), np.minimum(first_hit, count - 1)]
    stop = (miss & (misses > 6) & (rate < 0.4)) | ~inside
    stop_at = np.where(stop.any(axis=1), stop.argmax(axis=1), count)
    stop_at = np.where(leading > MAX_LEADING_MISSES, 0, stop_at)

    eligible = hit & (rate >= MIN_HIT_RATE) & (index < stop_at[:, None])
    found = eligible.any(axis=1)
    last = np.where(found, count - 1 - eligible[:, ::-1].argmax(axis=1), 0)
    rows = np.arange(len(last))

    after = np.minimum(last[:, None] + 1 + np.arange(END_CHECK_SAMPLES)[None, :], count - 1)
    clean_end = ~hidden[rows[:, None], after].any(axis=1)
    return {
        "length": np.where(found, _DISTANCES[last], 0.0),
        "rate": np.where(found, rate[rows, last], 0.0),
        "clean_end": clean_end & found,
    }


def _end_centers(pin: Pin) -> list[tuple[float, np.ndarray]]:
    # A agulha sai do centro do disco da ponta; usar o eixo pelo centróide desloca o raio
    # quando a máscara do pino inclui um reflexo ou fica parcialmente encoberta.
    points = pin.contour.reshape(-1, 2).astype(np.float64)
    proj = (points - pin.centroid) @ pin.axis
    ends = []
    for sign, t in ((1.0, pin.extent[1]), (-1.0, pin.extent[0])):
        near = points[np.abs(proj - t) <= END_CAP_DEPTH]
        center = near.mean(axis=0) if len(near) else pin.centroid + pin.axis * t
        ends.append((sign, center))
    return ends


def _measure(pin: Pin, needle: np.ndarray, unknown: np.ndarray) -> dict[str, Any]:
    u = pin.axis
    normal = np.array([-u[1], u[0]])
    cos, sin = np.cos(_ANGLES), np.sin(_ANGLES)
    rotated = np.stack([cos * u[0] - sin * u[1], sin * u[0] + cos * u[1]], axis=1)
    starts, directions = [], []
    # Com o pino inclinado, a agulha sai alguns pixels fora do centro do disco.
    for sign, center in _end_centers(pin):
        for offset in _LATERAL_OFFSETS:
            starts.append(np.repeat((center + normal * offset)[None, :], len(rotated), axis=0))
            directions.append(rotated * sign)
    starts_arr, directions_arr = np.concatenate(starts), np.concatenate(directions)
    rays = _rays(needle, unknown, starts_arr, directions_arr)
    i = int(np.argmax(rays["length"]))
    if rays["length"][i] <= 0:
        return {"length": 0.0, "rate": 0.0, "clean_end": True, "start": None, "direction": None}
    return {
        "length": float(rays["length"][i]),
        "rate": float(rays["rate"][i]),
        "clean_end": bool(rays["clean_end"][i]),
        "start": starts_arr[i],
        "direction": directions_arr[i],
    }


def _verdict(m: dict[str, Any], typical_length: float) -> str | None:
    if m["length"] < typical_length * BROKEN_RELATIVE:
        return "broken"
    # Se o trecho reto termina encoberto pelo plástico, o comprimento real não é conhecido.
    if m["clean_end"] and m["length"] < typical_length * SHORT_RELATIVE:
        return "short_or_bent"
    return None


def process_shafts(image: np.ndarray, pins: list[Pin]) -> tuple[np.ndarray, dict[str, Any]]:
    result = image.copy()
    if not pins:
        return result, {"total_shafts": 0, "approved_shafts": 0, "rejected_shafts": 0, "shafts": []}

    singles = [p.length for p in pins if not p.merged]
    typical_length = float(np.median(singles)) if len(singles) >= MIN_PINS_FOR_MEDIAN else REFERENCE_LENGTH
    needle, unknown = _evidence_maps(image, pins)

    shafts = []
    for pin in pins:
        m = _measure(pin, needle, unknown)
        defect = _verdict(m, typical_length)
        color = COLOR_DEFECT if defect else COLOR_OK
        inclination = 0.0
        if m["start"] is not None:
            p0 = m["start"]
            p1 = p0 + m["direction"] * m["length"]
            cv2.line(result, tuple(np.rint(p0).astype(int)), tuple(np.rint(p1).astype(int)), color, 3)
            inclination = math.atan2(m["direction"][1], m["direction"][0])
        if defect:
            cx, cy = np.rint(pin.centroid).astype(int)
            cv2.circle(result, (int(cx), int(cy)), int(typical_length * 0.6), COLOR_DEFECT, 3)
        shafts.append({
            "length": round(m["length"], 1),
            "straightness": round(m["rate"], 3),
            "inclination_rad": round(inclination, 4),
            "approved": defect is None,
            "defect": defect,
            "rejected_secondary": False,
        })

    approved = sum(1 for s in shafts if s["approved"])
    return result, {
        "total_shafts": len(shafts),
        "approved_shafts": approved,
        "rejected_shafts": len(shafts) - approved,
        "shafts": shafts,
    }
