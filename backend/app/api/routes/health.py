"""
Rotas de health check e informações da API.
"""
from fastapi import APIRouter

from app.core.config import settings
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
    
    return {
        "status": "healthy",
        "supabase_connected": supabase_status,
        "version": settings.APP_VERSION
    }