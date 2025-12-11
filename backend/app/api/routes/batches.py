"""
Rotas de gerenciamento de lotes (batches).
"""
from fastapi import APIRouter

from app.schemas import (
    CreateBatchRequest,
    CreateBatchResponse,
    RejectBatchRequest,
)
from app.services import create_batch, reject_batch

router = APIRouter(prefix="/api/batches", tags=["Batches"])


@router.post("/create", response_model=CreateBatchResponse)
async def create_batch_endpoint(request: CreateBatchRequest):
    """
    Cria um novo lote com as capturas processadas.
    
    - Move arquivos do bucket temporário para o permanente
    - Cria registros no banco de dados (batch, captures, compartments, defects)
    - Calcula métricas de qualidade
    - Limpa arquivos temporários
    
    **Campos obrigatórios:**
    - **name**: Nome do lote
    - **captures**: Lista de capturas processadas
    """
    result = create_batch(request)
    return CreateBatchResponse(**result)


@router.post("/reject")
async def reject_batch_endpoint(request: RejectBatchRequest):
    """
    Rejeita um lote, deletando todos os arquivos temporários.
    
    - **timestamp**: Timestamp do lote a rejeitar
    
    Útil quando o usuário decide não salvar as imagens processadas.
    """
    return reject_batch(request.timestamp)