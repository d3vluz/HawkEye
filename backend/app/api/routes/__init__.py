"""
Rotas da API.
"""
from app.api.routes.health import router as health_router
from app.api.routes.images import router as images_router
from app.api.routes.batches import router as batches_router

__all__ = [
    "health_router",
    "images_router",
    "batches_router",
]