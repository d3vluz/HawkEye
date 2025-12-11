"""
HawkEye Backend API - Ponto de entrada da aplicação.

Sistema de inspeção automatizada de qualidade industrial
usando visão computacional para análise de pins e hastes.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import health_router, images_router, batches_router


def create_app() -> FastAPI:
    """Cria e configura a aplicação FastAPI."""
    
    app = FastAPI(
        title=settings.APP_TITLE,
        version=settings.APP_VERSION,
        description="API para inspeção automatizada de qualidade industrial",
    )
    
    # Configurar CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Registrar rotas
    app.include_router(health_router)
    app.include_router(images_router)
    app.include_router(batches_router)
    
    return app


# Criar instância da aplicação
app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)