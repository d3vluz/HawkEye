"""
Serviço de gerenciamento de lotes (batches).
Orquestra criação, salvamento e rejeição de lotes.
"""
from typing import Dict, Any
from fastapi import HTTPException

from app.core.config import settings
from app.core.dependencies import get_supabase
from app.repositories import (
    get_public_url,
    move_file_between_buckets,
    delete_folder,
)
from app.schemas import CreateBatchRequest, CaptureData


def _move_capture_files(capture: CaptureData) -> bool:
    """
    Move todos os arquivos de uma captura do bucket temporário para o permanente.
    
    Args:
        capture: Dados da captura
    
    Returns:
        True se todos os arquivos foram movidos com sucesso
    """
    files_to_move = [
        capture.original_uri,
        capture.processed_uri,
        capture.processed_areas_uri,
        capture.processed_pins_uri,
        capture.processed_shaft_uri,
    ]
    
    for file_path in files_to_move:
        if file_path:
            success = move_file_between_buckets(
                source_path=file_path,
                dest_path=file_path,
                source_bucket=settings.SUPABASE_BUCKET_TEMP,
                dest_bucket=settings.SUPABASE_BUCKET_PERMANENT
            )
            if success:
                print(f"   ✅ Movido: {file_path}")
            else:
                print(f"   ❌ Falha: {file_path}")
                return False
    
    return True


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
    
    Raises:
        HTTPException: Se erro ao criar lote
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
    capture: CaptureData
) -> str:
    """
    Cria o registro de uma captura no banco de dados.
    
    Returns:
        ID da captura criada
    
    Raises:
        HTTPException: Se erro ao criar captura
    """
    supabase = get_supabase()
    
    capture_data = {
        "batch_id": batch_id,
        "filename": capture.filename,
        "sha256": capture.sha256,
        "original_uri": get_public_url(capture.original_uri, settings.SUPABASE_BUCKET_PERMANENT),
        "processed_uri": get_public_url(capture.processed_uri, settings.SUPABASE_BUCKET_PERMANENT) if capture.processed_uri else None,
        "processed_areas_uri": get_public_url(capture.processed_areas_uri, settings.SUPABASE_BUCKET_PERMANENT),
        "processed_pins_uri": get_public_url(capture.processed_pins_uri, settings.SUPABASE_BUCKET_PERMANENT),
        "processed_shaft_uri": get_public_url(capture.processed_shaft_uri, settings.SUPABASE_BUCKET_PERMANENT),
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
    Cria um novo lote com todas as capturas e defeitos.
    
    Args:
        request: Dados do lote a criar
    
    Returns:
        Dicionário com success, message, batch_id, métricas
    
    Raises:
        HTTPException: Se erro na criação
    """
    try:
        print(f"\n{'='*80}\n📦 Criando lote: {request.name}\n{'='*80}")
        
        if not request.captures:
            raise HTTPException(
                status_code=400,
                detail="Lote deve conter ao menos uma captura"
            )
        
        # Extrair timestamp do primeiro arquivo
        timestamp = request.captures[0].original_uri.split('/')[0]
        
        # Mover arquivos do bucket temporário para o permanente
        print(f"\n📁 Movendo arquivos...")
        moved_captures = []
        
        for capture in request.captures:
            if _move_capture_files(capture):
                moved_captures.append(capture)
        
        if len(moved_captures) != len(request.captures):
            raise HTTPException(
                status_code=500,
                detail=f"Erro ao mover arquivos. Movidos: {len(moved_captures)}/{len(request.captures)}"
            )
        
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
            capture_id = _create_capture_record(batch_id, capture)
            print(f"   ✅ Capture: {capture.filename} ({capture_id})")
            
            compartments_map = _create_compartments(capture_id, capture)
            _create_defects(capture_id, capture, compartments_map, defect_types_map)
        
        # Deletar arquivos temporários
        print(f"\n🗑️ Deletando temporários...")
        delete_success = delete_folder(timestamp, settings.SUPABASE_BUCKET_TEMP)
        if delete_success:
            print(f"   ✅ Pasta {timestamp} deletada")
        
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
    
    Raises:
        HTTPException: Se erro ao deletar
    """
    try:
        print(f"\n{'='*80}\n❌ Rejeitando lote: {timestamp}\n{'='*80}")
        print(f"\n🗑️ Deletando arquivos...")
        
        delete_success = delete_folder(timestamp, settings.SUPABASE_BUCKET_TEMP)
        
        if not delete_success:
            raise HTTPException(
                status_code=500,
                detail=f"Erro ao deletar lote {timestamp}"
            )
        
        print(f"   ✅ Pasta {timestamp} deletada")
        print(f"\n{'='*80}\n✅ LOTE REJEITADO!\n{'='*80}\n")
        
        return {
            "success": True,
            "message": f"Lote {timestamp} rejeitado e deletado",
            "timestamp": timestamp
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"\n❌ Erro: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao rejeitar: {str(e)}"
        )