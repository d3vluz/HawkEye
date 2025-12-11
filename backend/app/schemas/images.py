"""
Schemas relacionados a imagens e processamento.
"""
from pydantic import BaseModel
from typing import List, Dict, Any


class ImageProcessRequest(BaseModel):
    """Request para processar uma imagem."""
    filename: str
    storage_path: str
    sha256: str
    timestamp: str


class ProcessImagesRequest(BaseModel):
    """Request para processar múltiplas imagens."""
    images: List[ImageProcessRequest]


class UploadResponse(BaseModel):
    """Response de upload de imagem."""
    filename: str
    storage_path: str
    sha256: str
    timestamp: str


class BoxInfo(BaseModel):
    """Informações de um compartimento/box."""
    x: int
    y: int
    width: int
    height: int
    pins_count: int
    status: str


class PinClassification(BaseModel):
    """Classificação de pins detectados."""
    total_pins: int
    valid_pins: int
    invalid_pins: int
    critical_pins: int
    damaged_threshold: float
    average_area: float


class ImageProcessResult(BaseModel):
    """Resultado do processamento de uma imagem."""
    filename: str
    sha256: str
    timestamp: str
    original_url: str
    areas_url: str
    pins_url: str
    boxes_url: str
    shafts_url: str
    areas_count: int
    pins_count: int
    boxes_info: Dict[str, Any]
    pin_classification: Dict[str, Any]
    shaft_classification: Dict[str, Any]


class ProcessImagesResponse(BaseModel):
    """Response do processamento de imagens."""
    success: bool
    message: str
    processed_count: int
    results: List[ImageProcessResult]