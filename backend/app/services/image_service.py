"""
Serviço de processamento de imagens.
Orquestra upload, processamento e armazenamento de imagens.
"""
from datetime import datetime
from typing import List, Dict, Any
from fastapi import UploadFile, HTTPException

from app.core.config import settings
from app.core.dependencies import get_border_mask
from app.repositories import (
    calculate_sha256,
    get_public_url,
    download_image,
    upload_image,
    upload_processed_image,
)
from app.schemas import ImageProcessRequest, ImageProcessResult
from processing import process_areas, process_pins, process_boxes, process_shafts


async def upload_single_image(
    file: UploadFile,
    batch_timestamp: str | None = None
) -> Dict[str, str]:
    """
    Faz upload de uma única imagem.
    
    Args:
        file: Arquivo de imagem
        batch_timestamp: Timestamp do lote (opcional)
    
    Returns:
        Dicionário com filename, storage_path, sha256, timestamp
    
    Raises:
        HTTPException: Se tipo de arquivo não suportado ou erro no upload
    """
    if file.content_type not in settings.VALID_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de arquivo não suportado: {file.content_type}"
        )
    
    try:
        file_content = await file.read()
        sha256 = calculate_sha256(file_content)
        
        timestamp = batch_timestamp or datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
        storage_path = f"{timestamp}/{sha256}/original_{file.filename}"
        
        upload_image(
            file_content=file_content,
            storage_path=storage_path,
            content_type=file.content_type,
            bucket=settings.SUPABASE_BUCKET_TEMP
        )
        
        return {
            "filename": file.filename,
            "storage_path": storage_path,
            "sha256": sha256,
            "timestamp": timestamp
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro no upload: {str(e)}"
        )


async def upload_batch_images(files: List[UploadFile]) -> Dict[str, Any]:
    """
    Faz upload de múltiplas imagens como um lote.
    
    Args:
        files: Lista de arquivos de imagem
    
    Returns:
        Dicionário com success, batch_timestamp, total_uploaded, files
    
    Raises:
        HTTPException: Se nenhum arquivo enviado ou erro no upload
    """
    if not files:
        raise HTTPException(
            status_code=400,
            detail="Nenhum arquivo enviado"
        )
    
    batch_timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    uploaded_files = []
    
    for file in files:
        if file.content_type not in settings.VALID_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Tipo não suportado: {file.content_type}"
            )
        
        try:
            file_content = await file.read()
            sha256 = calculate_sha256(file_content)
            storage_path = f"{batch_timestamp}/{sha256}/original_{file.filename}"
            
            upload_image(
                file_content=file_content,
                storage_path=storage_path,
                content_type=file.content_type,
                bucket=settings.SUPABASE_BUCKET_TEMP
            )
            
            uploaded_files.append({
                "filename": file.filename,
                "storage_path": storage_path,
                "sha256": sha256,
                "timestamp": batch_timestamp
            })
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Erro no upload de {file.filename}: {str(e)}"
            )
    
    return {
        "success": True,
        "batch_timestamp": batch_timestamp,
        "total_uploaded": len(uploaded_files),
        "files": uploaded_files
    }


def process_single_image(img_info: ImageProcessRequest) -> ImageProcessResult:
    """
    Processa uma única imagem através de todo o pipeline.
    
    Args:
        img_info: Informações da imagem a processar
    
    Returns:
        Resultado do processamento com URLs e métricas
    """
    # Download da imagem original
    original_image = download_image(img_info.storage_path)
    
    # Processamento de áreas
    areas_image, areas_count, x_positions, y_positions = process_areas(original_image)
    
    # Processamento de pins
    pins_image, pins_count, pin_boxes, pin_classification = process_pins(original_image)
    
    # Processamento de boxes
    boxes_image, boxes_info = process_boxes(
        original_image, pin_boxes, x_positions, y_positions
    )
    
    # Processamento de hastes
    border_mask = get_border_mask()
    shafts_image, shaft_classification = process_shafts(
        original_image,
        border_mask=border_mask,
        apply_border_centralization=True,
        apply_border_removal=True
    )
    
    # Upload de imagens processadas
    areas_path = upload_processed_image(
        areas_image, img_info.timestamp, img_info.sha256, "areas"
    )
    pins_path = upload_processed_image(
        pins_image, img_info.timestamp, img_info.sha256, "pins"
    )
    boxes_path = upload_processed_image(
        boxes_image, img_info.timestamp, img_info.sha256, "boxes"
    )
    shafts_path = upload_processed_image(
        shafts_image, img_info.timestamp, img_info.sha256, "shafts"
    )
    
    # Obter URLs públicas
    original_url = get_public_url(img_info.storage_path)
    areas_url = get_public_url(areas_path)
    pins_url = get_public_url(pins_path)
    boxes_url = get_public_url(boxes_path)
    shafts_url = get_public_url(shafts_path)
    
    return ImageProcessResult(
        filename=img_info.filename,
        sha256=img_info.sha256,
        timestamp=img_info.timestamp,
        original_url=original_url,
        areas_url=areas_url,
        pins_url=pins_url,
        boxes_url=boxes_url,
        shafts_url=shafts_url,
        areas_count=areas_count,
        pins_count=pins_count,
        boxes_info=boxes_info,
        pin_classification=pin_classification,
        shaft_classification=shaft_classification
    )


def process_multiple_images(
    images: List[ImageProcessRequest]
) -> tuple[int, List[ImageProcessResult]]:
    """
    Processa múltiplas imagens.
    
    Args:
        images: Lista de informações das imagens
    
    Returns:
        Tuple com contagem de processadas e lista de resultados
    
    Raises:
        HTTPException: Se nenhuma imagem para processar ou erro no processamento
    """
    if not images:
        raise HTTPException(
            status_code=400,
            detail="Nenhuma imagem para processar"
        )
    
    processed_count = 0
    results = []
    
    try:
        for img_info in images:
            result = process_single_image(img_info)
            results.append(result)
            processed_count += 1
        
        return processed_count, results
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar: {str(e)}"
        )