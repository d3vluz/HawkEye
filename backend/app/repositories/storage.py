"""
Repository para operações de storage no Supabase.
"""
import hashlib
import cv2
import numpy as np
from fastapi import HTTPException

from app.core.config import settings
from app.core.dependencies import get_supabase


def calculate_sha256(file_content: bytes) -> str:
    """Calcula o hash SHA256 do conteúdo do arquivo."""
    return hashlib.sha256(file_content).hexdigest()


def get_public_url(
    storage_path: str, 
    bucket: str = settings.SUPABASE_BUCKET_TEMP
) -> str:
    """
    Obtém a URL pública de um arquivo no Supabase Storage.
    
    Args:
        storage_path: Caminho do arquivo no bucket
        bucket: Nome do bucket (default: pipeline-temp)
    
    Returns:
        URL pública do arquivo ou string vazia em caso de erro
    """
    if not storage_path:
        return ""
    try:
        supabase = get_supabase()
        url = supabase.storage.from_(bucket).get_public_url(storage_path)
        return url
    except Exception as e:
        print(f"Erro ao obter URL pública para {storage_path}: {e}")
        return ""


def download_image(
    storage_path: str, 
    bucket: str = settings.SUPABASE_BUCKET_TEMP
) -> np.ndarray:
    """
    Baixa uma imagem do Supabase Storage.
    
    Args:
        storage_path: Caminho do arquivo no bucket
        bucket: Nome do bucket (default: pipeline-temp)
    
    Returns:
        Imagem como array numpy (BGR)
    
    Raises:
        HTTPException: Se houver erro no download ou decodificação
    """
    try:
        supabase = get_supabase()
        res = supabase.storage.from_(bucket).download(storage_path)
        nparr = np.frombuffer(res, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError(f"Não foi possível decodificar: {storage_path}")
        return img
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Erro ao baixar imagem: {str(e)}"
        )


def upload_image(
    file_content: bytes,
    storage_path: str,
    content_type: str = "image/png",
    bucket: str = settings.SUPABASE_BUCKET_TEMP
) -> str:
    """
    Faz upload de uma imagem para o Supabase Storage.
    
    Args:
        file_content: Conteúdo do arquivo em bytes
        storage_path: Caminho de destino no bucket
        content_type: Tipo MIME do arquivo
        bucket: Nome do bucket (default: pipeline-temp)
    
    Returns:
        Caminho do arquivo no storage
    
    Raises:
        HTTPException: Se houver erro no upload
    """
    try:
        supabase = get_supabase()
        supabase.storage.from_(bucket).upload(
            path=storage_path,
            file=file_content,
            file_options={"content-type": content_type, "upsert": "true"}
        )
        return storage_path
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Erro no upload: {str(e)}"
        )


def upload_processed_image(
    image: np.ndarray,
    timestamp: str,
    sha256: str,
    image_type: str,
    bucket: str = settings.SUPABASE_BUCKET_TEMP
) -> str:
    """
    Codifica e faz upload de uma imagem processada (numpy array).
    
    Args:
        image: Imagem como array numpy
        timestamp: Timestamp do lote
        sha256: Hash SHA256 da imagem original
        image_type: Tipo da imagem (areas, pins, boxes, shafts)
        bucket: Nome do bucket (default: pipeline-temp)
    
    Returns:
        Caminho do arquivo no storage
    
    Raises:
        HTTPException: Se houver erro na codificação ou upload
    """
    try:
        success, buffer = cv2.imencode('.png', image)
        if not success:
            raise ValueError("Não foi possível codificar a imagem")
        
        image_bytes = buffer.tobytes()
        storage_path = f"{timestamp}/{sha256}/processed_{image_type}.png"
        
        supabase = get_supabase()
        supabase.storage.from_(bucket).upload(
            path=storage_path,
            file=image_bytes,
            file_options={"content-type": "image/png", "upsert": "true"}
        )
        return storage_path
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Erro ao fazer upload: {str(e)}"
        )


def move_file_between_buckets(
    source_path: str,
    dest_path: str,
    source_bucket: str,
    dest_bucket: str
) -> bool:
    """
    Move um arquivo entre buckets (download + upload).
    
    Args:
        source_path: Caminho no bucket de origem
        dest_path: Caminho no bucket de destino
        source_bucket: Nome do bucket de origem
        dest_bucket: Nome do bucket de destino
    
    Returns:
        True se sucesso, False se falha
    """
    try:
        supabase = get_supabase()
        file_data = supabase.storage.from_(source_bucket).download(source_path)
        supabase.storage.from_(dest_bucket).upload(
            path=dest_path,
            file=file_data,
            file_options={"upsert": "true"}
        )
        return True
    except Exception as e:
        print(f"Erro ao mover arquivo {source_path}: {str(e)}")
        return False


def delete_folder(timestamp: str, bucket: str) -> bool:
    """
    Deleta uma pasta (timestamp) e todo seu conteúdo do bucket.
    
    Args:
        timestamp: Nome da pasta (timestamp do lote)
        bucket: Nome do bucket
    
    Returns:
        True se sucesso, False se falha
    """
    try:
        supabase = get_supabase()
        files = supabase.storage.from_(bucket).list(timestamp)
        
        for folder in files:
            sha256_folder = folder['name']
            inner_files = supabase.storage.from_(bucket).list(
                f"{timestamp}/{sha256_folder}"
            )
            files_to_delete = [
                f"{timestamp}/{sha256_folder}/{f['name']}" 
                for f in inner_files
            ]
            if files_to_delete:
                supabase.storage.from_(bucket).remove(files_to_delete)
        
        return True
    except Exception as e:
        print(f"Erro ao deletar pasta {timestamp}: {str(e)}")
        return False


def check_connection() -> bool:
    """
    Verifica se a conexão com o Supabase está funcionando.
    
    Returns:
        True se conectado, False caso contrário
    """
    try:
        supabase = get_supabase()
        supabase.storage.from_(settings.SUPABASE_BUCKET_TEMP).list()
        return True
    except Exception:
        return False