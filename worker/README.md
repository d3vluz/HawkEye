# HawkEye Worker

Worker de **visão computacional** (FastAPI + OpenCV). Recebe imagens via HTTP,
roda o pipeline OpenCV e grava os resultados no bucket `review` do MinIO.
Não acessa o banco — apenas o storage.

## Estrutura

```
src/
  main.py         FastAPI: POST /process, GET /health
  pipeline.py     PipelineContext + PIPELINE_STEPS (registro ordenado de steps)
  config.py       env vars do MinIO
  storage.py      download/upload via boto3 (cliente em cache)
  processing/
    areas.py      grade da caixa e trechos de divisória ausentes (perfil de cristas)
    pins.py       pinos de qualquer cor, cor errada e corpo danificado
    boxes.py      pinos por compartimento (compartimentos unidos contam juntos)
    shafts.py     comprimento e fim das agulhas (top-hat + leque de raios)
scripts/          execução local e avaliação no dataset (ver scripts/README.md)
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

## Adicionar um novo step

Tudo passa pelo registro em `pipeline.py` — ver `scripts/README.md`.
O endpoint HTTP e o runner local usam `PIPELINE_STEPS` automaticamente.

## Desenvolvimento local

Roda o pipeline numa imagem do disco, sem Docker/MinIO:

```bash
pip install -r requirements.txt
python scripts/run_local.py caminho/para/imagem.png
```

## Como cada etapa decide

- **Grade:** a divisória é uma faixa mais clara que os dois lados a 24 px. A soma
  dessas faixas por coluna e por linha dá as posições; cada trecho entre duas
  células é conferido à parte, e um trecho sem divisória une os compartimentos
  (`missing_dividers`, `areas_count` menor que linhas × colunas).
- **Pinos:** todo objeto saturado sobre o fundo escuro é candidato. Reflexos na
  parede transparente (cerca de 10% da área de um pino) são descartados. Cor
  errada é mancha vermelha ou predominância de outra cor; dano é área ou
  comprimento bem abaixo da mediana dos pinos da mesma imagem.
- **Hastes:** a agulha é procurada como linha fina e clara saindo dos discos do
  pino. Plástico e corpos de pinos contam como região encoberta, não como falha.
  É defeito a agulha quebrada (menos de 0,35 do corpo) ou curta/torta (menos de
  0,65 com o fim visível sobre o fundo).

## Avaliação

Os limiares foram calibrados no dataset rotulado por pasta. Para medir de novo
depois de qualquer mudança:

```bash
python scripts/evaluate.py caminho/para/dataset-classificado --workers 8
```

O script mostra, por classe, a taxa de veredito certo, a taxa em que a flag
esperada foi levantada e os falsos alarmes.
