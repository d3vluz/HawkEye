"""
Schemas da aplicação.
"""
from app.schemas.images import (
    ImageProcessRequest,
    ProcessImagesRequest,
    UploadResponse,
    BoxInfo,
    PinClassification,
    ImageProcessResult,
    ProcessImagesResponse,
)
from app.schemas.batches import (
    CompartmentData,
    CaptureData,
    CreateBatchRequest,
    CreateBatchResponse,
    RejectBatchRequest,
)

__all__ = [
    # Images
    "ImageProcessRequest",
    "ProcessImagesRequest",
    "UploadResponse",
    "BoxInfo",
    "PinClassification",
    "ImageProcessResult",
    "ProcessImagesResponse",
    
    # Batches
    "CompartmentData",
    "CaptureData",
    "CreateBatchRequest",
    "CreateBatchResponse",
    "RejectBatchRequest",
]