import io
from functools import lru_cache

import cv2
import numpy as np
import boto3

import config


@lru_cache(maxsize=1)
def _client():
    return boto3.client(
        "s3",
        endpoint_url=config.MINIO_ENDPOINT,
        aws_access_key_id=config.MINIO_ACCESS_KEY,
        aws_secret_access_key=config.MINIO_SECRET_KEY,
        region_name="us-east-1",
    )


def get_public_url(storage_path: str) -> str:
    return f"{config.MINIO_PUBLIC_URL}/{config.MINIO_BUCKET_REVIEW}/{storage_path}"


def download_image(storage_path: str) -> np.ndarray:
    response = _client().get_object(Bucket=config.MINIO_BUCKET_REVIEW, Key=storage_path)
    data = response["Body"].read()
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Não foi possível decodificar: {storage_path}")
    return img


def upload_processed_image(image: np.ndarray, timestamp: str, sha256: str, label: str) -> str:
    key = f"{timestamp}/{sha256}/processed_{label}.png"
    _, buf = cv2.imencode(".png", image)
    body = buf.tobytes()
    _client().put_object(
        Bucket=config.MINIO_BUCKET_REVIEW,
        Key=key,
        Body=io.BytesIO(body),
        ContentType="image/png",
        ContentLength=len(body),
    )
    return key
