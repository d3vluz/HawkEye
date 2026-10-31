"""
Módulo de processamento de imagens (Visão Computacional).
"""
from processing.areas import process_areas
from processing.pins import process_pins
from processing.boxes import process_boxes
from processing.shafts import process_shafts

__all__ = [
    "process_areas",
    "process_pins",
    "process_boxes",
    "process_shafts",
]