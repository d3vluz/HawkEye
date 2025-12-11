"""
Schemas relacionados a lotes (batches) e capturas.
"""
from pydantic import BaseModel
from typing import List


class CompartmentData(BaseModel):
    """Dados de um compartimento dentro de uma captura."""
    grid_row: int
    grid_col: int
    bbox_x: int
    bbox_y: int
    bbox_width: int
    bbox_height: int
    pins_count: int
    is_valid: bool
    has_defect: bool


class CaptureData(BaseModel):
    """Dados de uma captura (imagem processada)."""
    filename: str
    sha256: str
    original_uri: str
    processed_uri: str
    processed_areas_uri: str
    processed_pins_uri: str
    processed_shaft_uri: str
    is_valid: bool
    areas_detected: int
    pins_detected: int
    defects_count: int
    has_missing_pins: bool
    has_extra_pins: bool
    has_damaged_pins: bool
    has_wrong_color_pins: bool
    has_structure_damage: bool
    has_shaft_defects: bool
    compartments: List[CompartmentData]


class CreateBatchRequest(BaseModel):
    """Request para criar um lote."""
    name: str
    description: str = ""
    captures: List[CaptureData]


class CreateBatchResponse(BaseModel):
    """Response da criação de um lote."""
    success: bool
    message: str
    batch_id: str
    total_captures: int
    valid_captures: int
    invalid_captures: int


class RejectBatchRequest(BaseModel):
    """Request para rejeitar um lote."""
    timestamp: str