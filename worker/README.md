# HawkEye Worker

Worker de **visão computacional** (FastAPI + OpenCV). Recebe imagens via HTTP,
roda o pipeline OpenCV e grava os resultados no bucket `review` do MinIO.
Não acessa o banco — apenas o storage.

## Estrutura

```
src/
  main.py         FastAPI: POST /process, GET /health
  pipeline.py     PipelineContext + PIPELINE_STEPS (registro ordenado de steps)
  config.py       env vars do MinIO + caminho da máscara de borda
  storage.py      download/upload via boto3 (cliente em cache)
  border_mask.png máscara estática usada pelo step de hastes
  processing/
    areas.py      detecta a grade de compartimentos (Hough)
    pins.py       detecta e classifica pinos (HSV + watershed)
    boxes.py      conta pinos por compartimento
    shafts.py     analisa hastes (centralização, máscara, segmentação, PCA)
scripts/          execução local sem Docker (ver scripts/README.md)
```

## Endpoints

| Método | Rota | Função |
|--------|------|--------|
| `POST` | `/process` | Processa uma lista de imagens e devolve URLs + contagens |
| `GET`  | `/health`  | Healthcheck |

`POST /process` recebe `{ "images": [{ filename, storage_path, sha256, timestamp }] }`.
Para cada imagem: baixa do `review`, roda o pipeline, sobe as 4 imagens
processadas (areas/pins/boxes/shafts) e retorna as URLs públicas e métricas.

## Variáveis de ambiente

Injetadas pelo `docker-compose.yml` (defaults em `config.py`):

| Variável | Default | Uso |
|----------|---------|-----|
| `MINIO_ENDPOINT` | `http://minio:9000` | Endpoint interno do MinIO |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | `minioadmin` | Credenciais |
| `MINIO_BUCKET_REVIEW` | `review` | Bucket de leitura/escrita |
| `MINIO_PUBLIC_URL` | `http://localhost:9000` | Base das URLs públicas |
| `BORDER_MASK_PATH` | `border_mask.png` | Máscara de borda do step de hastes |

## Adicionar um novo step

Tudo passa pelo registro em `pipeline.py` — ver `scripts/README.md`.
O endpoint HTTP e o runner local usam `PIPELINE_STEPS` automaticamente.

## Desenvolvimento local

Roda o pipeline numa imagem do disco, sem Docker/MinIO:

```bash
pip install -r requirements.txt
python scripts/run_local.py caminho/para/imagem.png
```
