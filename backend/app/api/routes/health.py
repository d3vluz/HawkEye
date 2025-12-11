"""
Rotas de health check e informações da API.
"""
from fastapi import APIRouter

from app.core.config import settings
from app.core.image_cache import get_image_cache
from app.repositories import check_connection

router = APIRouter(tags=["Health"])


@router.get("/")
def read_root():
    """Endpoint raiz com informações da API."""
    return {
        "message": "HawkEye Backend API",
        "version": settings.APP_VERSION,
        "status": "online"
    }


@router.get("/health")
def health_check():
    """Verifica o status de saúde da aplicação."""
    supabase_status = check_connection()
    cache = get_image_cache()
    cache_stats = cache.get_stats()
    
    return {
        "status": "healthy",
        "supabase_connected": supabase_status,
        "version": settings.APP_VERSION,
        "cache": {
            "batches": cache_stats["total_batches"],
            "images": cache_stats["total_images"],
            "memory_mb": cache_stats["memory_mb"]
        }
    }


@router.get("/cache/stats")
def cache_stats():
    """Retorna estatísticas detalhadas do cache de imagens."""
    cache = get_image_cache()
    return cache.get_stats()


@router.post("/cache/cleanup")
def cache_cleanup(ttl_hours: float = 1.0):
    """
    Limpa lotes expirados do cache.
    
    - **ttl_hours**: Tempo de vida em horas (default: 1)
    """
    cache = get_image_cache()
    removed = cache.cleanup_expired(ttl_hours)
    return {
        "success": True,
        "removed_batches": removed,
        "message": f"{removed} lote(s) expirado(s) removido(s)"
    }