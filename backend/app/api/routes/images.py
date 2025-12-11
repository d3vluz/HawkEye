"""
Rotas de upload e processamento de imagens.
"""
from typing import List
from fastapi import APIRouter, File, UploadFile

from app.schemas import (
    UploadResponse,
    ProcessImagesRequest,
    ProcessImagesResponse,
)
from app.services import (
    upload_single_image,
    upload_batch_images,
    process_multiple_images,
)

router = APIRouter(tags=["Images"])


@router.post("/upload-image/", response_model=UploadResponse)
async def upload_image(
    file: UploadFile = File(...),
    batch_timestamp: str = None
):
    """
    Faz upload de uma única imagem.
    
    - **file**: Arquivo de imagem (PNG, JPEG, WEBP)
    - **batch_timestamp**: Timestamp do lote (opcional, gera automaticamente se não informado)
    """
    result = await upload_single_image(file, batch_timestamp)
    return UploadResponse(**result)


@router.post("/upload-batch/")
async def upload_batch(files: List[UploadFile] = File(...)):
    """
    Faz upload de múltiplas imagens como um lote.
    
    - **files**: Lista de arquivos de imagem
    
    Retorna o timestamp do lote e informações dos arquivos enviados.
    """
    return await upload_batch_images(files)


@router.post("/process-images/", response_model=ProcessImagesResponse)
async def process_images(request: ProcessImagesRequest):
    """
    Processa múltiplas imagens através do pipeline de visão computacional.
    
    Executa:
    - Detecção de áreas/compartimentos
    - Detecção e classificação de pins
    - Análise de boxes
    - Processamento de hastes (shafts)
    
    Retorna URLs das imagens processadas e métricas de cada etapa.
    """
    processed_count, results = process_multiple_images(request.images)
    
    return ProcessImagesResponse(
        success=True,
        message=f"Todas as {processed_count} imagens foram processadas",
        processed_count=processed_count,
        results=results
    )