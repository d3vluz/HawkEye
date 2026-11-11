"""Leitura das imagens originais e gravação das imagens anotadas no bucket de revisão do MinIO."""

import os
from functools import lru_cache

import boto3
import cv2
import numpy as np

ENDERECO = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
USUARIO = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
SENHA = os.getenv("MINIO_SECRET_KEY", "minioadmin")
BUCKET = os.getenv("MINIO_BUCKET_REVIEW", "review")
ENDERECO_PUBLICO = os.getenv("MINIO_PUBLIC_URL", "http://localhost:9000")


@lru_cache(maxsize=1)
def _cliente():
    return boto3.client("s3", endpoint_url=ENDERECO, aws_access_key_id=USUARIO,
                        aws_secret_access_key=SENHA, region_name="us-east-1")


def url_publica(caminho: str) -> str:
    return f"{ENDERECO_PUBLICO}/{BUCKET}/{caminho}"


def baixar_imagem(caminho: str) -> np.ndarray:
    dados = _cliente().get_object(Bucket=BUCKET, Key=caminho)["Body"].read()
    imagem = cv2.imdecode(np.frombuffer(dados, np.uint8), cv2.IMREAD_COLOR)
    if imagem is None:
        raise ValueError(f"Não foi possível decodificar a imagem: {caminho}")
    return imagem


def enviar_imagem_anotada(imagem: np.ndarray, lote: str, sha256: str, etapa: str) -> str:
    # O caminho "{lote}/{sha256}/processed_{etapa}.png" é o mesmo que a API move para o bucket permanente.
    caminho = f"{lote}/{sha256}/processed_{etapa}.png"
    _, png = cv2.imencode(".png", imagem)
    _cliente().put_object(Bucket=BUCKET, Key=caminho, Body=png.tobytes(), ContentType="image/png")
    return caminho
