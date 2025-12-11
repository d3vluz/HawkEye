"""
Serviço de gerenciamento de lotes (batches).

Lê imagens do cache em memória e faz upload direto para o bucket permanente,
eliminando o bucket temporário completamente.
"""
import cv2
from typing import Dict, Any, List, Tuple
from fastapi import HTTPException

from app.core.config import settings
from app.core.dependencies import get_supabase
from app.core.image_cache import get_image_cache, CachedImage
from app.repositories import get_public_url, upload_processed_image
from app.schemas import CreateBatchRequest, CaptureData


def _encode_image_to_bytes(image) -> bytes:
    """Codifica numpy array para bytes PNG."""
    success, buffer = cv2.imencode('.png', image)
    if not success:
        raise ValueError("Falha ao codificar imagem para PNG")
    return buffer.tobytes()


def _upload_image_to_permanent(
    image_bytes: bytes,
    storage_path: str
) -> str:
    """
    Faz upload de imagem direto para o bucket permanente.
    
    Returns:
        Caminho do arquivo no storage
    """
    supabase = get_supabase()
    supabase.storage.from_(settings.SUPABASE_BUCKET_PERMANENT).upload(
        path=storage_path,
        file=image_bytes,
        file_options={"content-type": "image/png", "upsert": "true"}
    )
    return storage_path


def _upload_cached_image_to_permanent(
    cached_img: CachedImage,
    timestamp: str
) -> Dict[str, str]:
    """
    Faz upload de todas as imagens de uma captura do cache para o bucket permanente.
    
    Returns:
        Dicionário com os caminhos de cada imagem
    """
    sha256 = cached_img.sha256
    paths = {}
    
    # Upload da imagem original
    original_path = f"{timestamp}/{sha256}/original_{cached_img.filename}"
    original_bytes = _encode_image_to_bytes(cached_img.original)
    _upload_image_to_permanent(original_bytes, original_path)
    paths["original"] = original_path
    print(f"   ✅ Upload: original_{cached_img.filename}")
    
    # Upload das imagens processadas
    processed_types = [
        ("areas", cached_img.processed_areas),
        ("pins", cached_img.processed_pins),
        ("boxes", cached_img.processed_boxes),
        ("shafts", cached_img.processed_shafts),
    ]
    
    for img_type, img_data in processed_types:
        if img_data is not None:
            path = f"{timestamp}/{sha256}/processed_{img_type}.png"
            img_bytes = _encode_image_to_bytes(img_data)
            _upload_image_to_permanent(img_bytes, path)
            paths[img_type] = path
            print(f"   ✅ Upload: processed_{img_type}.png")
    
    return paths


def _create_batch_record(
    name: str,
    description: str,
    total_captures: int,
    valid_captures: int,
    invalid_captures: int,
    total_defects: int,
    quality_score: float
) -> str:
    """
    Cria o registro do lote no banco de dados.
    
    Returns:
        ID do lote criado
    """
    supabase = get_supabase()
    
    batch_data = {
        "name": name,
        "description": description,
        "total_captures": total_captures,
        "valid_captures": valid_captures,
        "invalid_captures": invalid_captures,
        "total_defects": total_defects,
        "quality_score": quality_score
    }
    
    batch_result = supabase.table("batches").insert(batch_data).execute()
    
    if not batch_result.data or len(batch_result.data) == 0:
        raise HTTPException(status_code=500, detail="Erro ao criar lote")
    
    return batch_result.data[0]["id"]


def _create_capture_record(
    batch_id: str,
    capture: CaptureData,
    uploaded_paths: Dict[str, str]
) -> str:
    """
    Cria o registro de uma captura no banco de dados.
    
    Returns:
        ID da captura criada
    """
    supabase = get_supabase()
    bucket = settings.SUPABASE_BUCKET_PERMANENT
    
    capture_data = {
        "batch_id": batch_id,
        "filename": capture.filename,
        "sha256": capture.sha256,
        "original_uri": get_public_url(uploaded_paths.get("original", ""), bucket),
        "processed_uri": get_public_url(uploaded_paths.get("boxes", ""), bucket),
        "processed_areas_uri": get_public_url(uploaded_paths.get("areas", ""), bucket),
        "processed_pins_uri": get_public_url(uploaded_paths.get("pins", ""), bucket),
        "processed_shaft_uri": get_public_url(uploaded_paths.get("shafts", ""), bucket),
        "is_valid": capture.is_valid,
        "areas_detected": capture.areas_detected,
        "pins_detected": capture.pins_detected,
        "defects_count": capture.defects_count,
        "has_missing_pins": capture.has_missing_pins,
        "has_extra_pins": capture.has_extra_pins,
        "has_damaged_pins": capture.has_damaged_pins,
        "has_wrong_color_pins": capture.has_wrong_color_pins,
        "has_structure_damage": capture.has_structure_damage,
        "has_shaft_defects": capture.has_shaft_defects
    }
    
    capture_result = supabase.table("captures").insert(capture_data).execute()
    
    if not capture_result.data or len(capture_result.data) == 0:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao criar capture {capture.filename}"
        )
    
    return capture_result.data[0]["id"]


def _create_compartments(
    capture_id: str,
    capture: CaptureData
) -> Dict[tuple, str]:
    """
    Cria os registros de compartimentos no banco de dados.
    
    Returns:
        Mapeamento de (grid_row, grid_col) -> compartment_id
    """
    if not capture.compartments:
        return {}
    
    supabase = get_supabase()
    
    print(f"      📦 Criando {len(capture.compartments)} compartimentos...")
    
    compartments_data = [
        {
            "capture_id": capture_id,
            "grid_row": comp.grid_row,
            "grid_col": comp.grid_col,
            "bbox_x": comp.bbox_x,
            "bbox_y": comp.bbox_y,
            "bbox_width": comp.bbox_width,
            "bbox_height": comp.bbox_height,
            "pins_count": comp.pins_count,
            "is_valid": comp.is_valid,
            "has_defect": comp.has_defect
        }
        for comp in capture.compartments
    ]
    
    comp_result = supabase.table("compartments").insert(compartments_data).execute()
    
    compartments_map = {}
    if comp_result.data:
        print(f"      ✅ {len(comp_result.data)} compartimentos criados")
        for comp in comp_result.data:
            key = (comp["grid_row"], comp["grid_col"])
            compartments_map[key] = comp["id"]
    
    return compartments_map


def _create_defects(
    capture_id: str,
    capture: CaptureData,
    compartments_map: Dict[tuple, str],
    defect_types_map: Dict[str, str]
) -> None:
    """
    Cria os registros de defeitos no banco de dados.
    """
    supabase = get_supabase()
    defects_to_insert = []
    
    # Defeito: Pin faltando
    if capture.has_missing_pins and "MISSING_PIN" in defect_types_map:
        for comp in capture.compartments:
            if comp.pins_count == 0:
                key = (comp.grid_row, comp.grid_col)
                compartment_id = compartments_map.get(key)
                defects_to_insert.append({
                    "capture_id": capture_id,
                    "defect_type_id": defect_types_map["MISSING_PIN"],
                    "compartment_id": compartment_id
                })
    
    # Defeito: Pin extra
    if capture.has_extra_pins and "EXTRA_PIN" in defect_types_map:
        for comp in capture.compartments:
            if comp.pins_count > 1:
                key = (comp.grid_row, comp.grid_col)
                compartment_id = compartments_map.get(key)
                defects_to_insert.append({
                    "capture_id": capture_id,
                    "defect_type_id": defect_types_map["EXTRA_PIN"],
                    "compartment_id": compartment_id
                })
    
    # Defeito: Pin danificado
    if capture.has_damaged_pins and "DAMAGED_PIN" in defect_types_map:
        defects_to_insert.append({
            "capture_id": capture_id,
            "defect_type_id": defect_types_map["DAMAGED_PIN"],
            "compartment_id": None
        })
    
    # Defeito: Cor errada
    if capture.has_wrong_color_pins and "WRONG_COLOR" in defect_types_map:
        defects_to_insert.append({
            "capture_id": capture_id,
            "defect_type_id": defect_types_map["WRONG_COLOR"],
            "compartment_id": None
        })
    
    # Defeito: Haste com defeito
    if capture.has_shaft_defects and "SHAFT_DEFECT" in defect_types_map:
        defects_to_insert.append({
            "capture_id": capture_id,
            "defect_type_id": defect_types_map["SHAFT_DEFECT"],
            "compartment_id": None
        })
    
    # Defeito: Dano estrutural
    if capture.has_structure_damage and "STRUCTURE_DAMAGE" in defect_types_map:
        defects_to_insert.append({
            "capture_id": capture_id,
            "defect_type_id": defect_types_map["STRUCTURE_DAMAGE"],
            "compartment_id": None
        })
    
    # Inserir defeitos
    if defects_to_insert:
        print(f"      🔴 Criando {len(defects_to_insert)} defeitos...")
        defects_result = supabase.table("defects").insert(defects_to_insert).execute()
        if defects_result.data:
            print(f"      ✅ {len(defects_result.data)} defeitos criados")


def create_batch(request: CreateBatchRequest) -> Dict[str, Any]:
    """
    Cria um novo lote a partir das imagens no cache.
    
    - Lê imagens do cache em memória
    - Faz upload direto para o bucket permanente
    - Cria registros no banco de dados
    - Limpa o cache após conclusão
    
    Args:
        request: Dados do lote a criar
    
    Returns:
        Dicionário com success, message, batch_id, métricas
    """
    cache = get_image_cache()
    
    try:
        print(f"\n{'='*80}\n📦 Criando lote: {request.name}\n{'='*80}")
        
        if not request.captures:
            raise HTTPException(
                status_code=400,
                detail="Lote deve conter ao menos uma captura"
            )
        
        # Extrair timestamp do primeiro arquivo
        timestamp = request.captures[0].original_uri.split('/')[0]
        
        batch = cache.get_batch(timestamp)
        if not batch:
            raise HTTPException(
                status_code=404,
                detail=f"Lote não encontrado no cache: {timestamp}"
            )
        
        print(f"\n📤 Fazendo upload para storage permanente...")
        uploaded_paths_map: Dict[str, Dict[str, str]] = {}
        
        for capture in request.captures:
            cached_img = cache.get_image(timestamp, capture.sha256)
            if not cached_img:
                raise HTTPException(
                    status_code=404,
                    detail=f"Imagem não encontrada no cache: {capture.sha256}"
                )
            
            print(f"\n   📷 {capture.filename}")
            paths = _upload_cached_image_to_permanent(cached_img, timestamp)
            uploaded_paths_map[capture.sha256] = paths
        
        # Calcular métricas
        total_captures = len(request.captures)
        valid_captures = sum(1 for c in request.captures if c.is_valid)
        invalid_captures = total_captures - valid_captures
        total_defects = sum(c.defects_count for c in request.captures)
        quality_score = (valid_captures / total_captures * 100) if total_captures > 0 else 0
        
        print(f"\n📊 Métricas: Total:{total_captures} | Válidas:{valid_captures} | Inválidas:{invalid_captures} | Defeitos:{total_defects} | Score:{quality_score:.2f}%")
        
        # Criar registro do lote
        print(f"\n💾 Criando lote no banco...")
        batch_id = _create_batch_record(
            name=request.name,
            description=request.description,
            total_captures=total_captures,
            valid_captures=valid_captures,
            invalid_captures=invalid_captures,
            total_defects=total_defects,
            quality_score=quality_score
        )
        
        # Obter tipos de defeito
        supabase = get_supabase()
        defect_types_result = supabase.table("defect_types").select("id, code").execute()
        defect_types_map = {
            dt["code"]: dt["id"]
            for dt in defect_types_result.data
        } if defect_types_result.data else {}
        
        # Criar capturas, compartimentos e defeitos
        for capture in request.captures:
            uploaded_paths = uploaded_paths_map[capture.sha256]
            capture_id = _create_capture_record(batch_id, capture, uploaded_paths)
            print(f"   ✅ Capture: {capture.filename} ({capture_id})")
            
            compartments_map = _create_compartments(capture_id, capture)
            _create_defects(capture_id, capture, compartments_map, defect_types_map)
        
        print(f"\n🧹 Limpando cache...")
        cache.clear_batch(timestamp)
        print(f"   ✅ Cache do lote {timestamp} liberado")
        
        print(f"\n{'='*80}\n✅ LOTE CRIADO COM SUCESSO!\n{'='*80}\n")
        
        return {
            "success": True,
            "message": f"Lote '{request.name}' criado com sucesso",
            "batch_id": batch_id,
            "total_captures": total_captures,
            "valid_captures": valid_captures,
            "invalid_captures": invalid_captures
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"\n❌ Erro: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao criar lote: {str(e)}"
        )


def reject_batch(timestamp: str) -> Dict[str, Any]:
    """
    Rejeita um lote, deletando todos os arquivos temporários.
    
    Args:
        timestamp: Timestamp do lote a rejeitar
    
    Returns:
        Dicionário com success, message, timestamp
    """
    cache = get_image_cache()
    
    try:
        print(f"\n{'='*80}\n❌ Rejeitando lote: {timestamp}\n{'='*80}")
        
        batch = cache.get_batch(timestamp)
        if not batch:
            print(f"   ⚠️ Lote não encontrado no cache (pode já ter sido limpo)")
        else:
            memory_mb = batch.memory_estimate_mb
            print(f"\n🧹 Limpando cache ({memory_mb:.2f} MB)...")
            cache.clear_batch(timestamp)
            print(f"   ✅ Cache do lote {timestamp} liberado")
        
        print(f"\n{'='*80}\n✅ LOTE REJEITADO!\n{'='*80}\n")
        
        return {
            "success": True,
            "message": f"Lote {timestamp} rejeitado",
            "timestamp": timestamp
        }
    
    except Exception as e:
        print(f"\n❌ Erro: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao rejeitar: {str(e)}"
        )