"""Servidor HTTP do worker: recebe da API as imagens de um lote, analisa cada uma e devolve o resultado."""

from fastapi import FastAPI
from pydantic import BaseModel

import armazenamento
from analise import analisar, resumo

app = FastAPI(title="HawkEye Worker")


class Imagem(BaseModel):
    filename: str
    storage_path: str
    sha256: str
    timestamp: str


class Pedido(BaseModel):
    images: list[Imagem]


@app.post("/process")
def processar(pedido: Pedido):
    resultados = []
    for img in pedido.images:
        analise = analisar(armazenamento.baixar_imagem(img.storage_path))
        urls = {
            f"{etapa}_url": armazenamento.url_publica(armazenamento.enviar_imagem_anotada(imagem, img.timestamp, img.sha256, etapa))
            for etapa, imagem in analise.imagens.items()
        }
        resultados.append({
            "filename": img.filename,
            "sha256": img.sha256,
            "timestamp": img.timestamp,
            "original_url": armazenamento.url_publica(img.storage_path),
            **urls,
            **resumo(analise),
        })
    return {"success": True, "processed_count": len(resultados), "results": resultados}


@app.get("/health")
def saude():
    return {"status": "ok"}
