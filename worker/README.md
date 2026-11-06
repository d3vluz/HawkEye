# HawkEye Worker

Serviço de **visão computacional** (FastAPI + OpenCV). A API envia as imagens de um lote,
o worker analisa cada uma, grava as imagens anotadas no bucket `review` do MinIO e devolve
as contagens. Não acessa o banco e só é chamado pela API, pela rede interna do Docker.

## Estrutura

```
src/
  main.py             rotas HTTP: POST /process e GET /health
  analise.py          roda as quatro etapas e monta o resultado no formato da API
  armazenamento.py    leitura e gravação de imagens no MinIO
  etapas/
    grade.py          divisórias da caixa e trechos de divisória ausentes
    pinos.py          pinos de qualquer cor; cor errada e corpo danificado
    compartimentos.py pinos por compartimento (vazio, certo ou com pino a mais)
    hastes.py         agulhas quebradas, curtas ou tortas
scripts/
  executar_local.py   analisa uma imagem do disco, sem Docker nem MinIO
  avaliar.py          mede a análise contra o dataset rotulado
```

## Como cada etapa decide

- **Grade:** a divisória é uma faixa mais clara que os dois lados a 24 px. A soma dessas
  faixas por coluna e por linha dá as posições; cada trecho entre duas células é conferido
  à parte, e um trecho sem divisória une os compartimentos (`areas_count` menor que
  linhas × colunas).
- **Pinos:** todo objeto saturado sobre o fundo escuro é candidato. Reflexos na parede
  transparente (cerca de 10% da área de um pino) são descartados. Cor errada é mancha
  vermelha ou predominância de outra cor; dano é área ou comprimento bem abaixo da mediana
  dos pinos da mesma imagem.
- **Hastes:** a agulha é procurada como linha fina e clara saindo dos discos do pino.
  Plástico e corpos de pinos contam como região encoberta, não como falha. É defeito a
  agulha quebrada (menos de 0,35 do corpo) ou curta/torta (menos de 0,65 com o fim visível).

## Contrato com a API

`POST /process` recebe `{ "images": [{ filename, storage_path, sha256, timestamp }] }` e
devolve, por imagem, as URLs das quatro imagens anotadas (`areas_url`, `pins_url`,
`boxes_url`, `shafts_url`) e as contagens montadas em `analise.resumo`. As chaves do JSON
ficam em inglês porque são compartilhadas com a API e o frontend.

## Variáveis de ambiente

| Variável | Padrão | Uso |
|----------|--------|-----|
| `MINIO_ENDPOINT` | `http://minio:9000` | Endereço interno do MinIO |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | `minioadmin` | Credenciais |
| `MINIO_BUCKET_REVIEW` | `review` | Bucket de leitura e gravação |
| `MINIO_PUBLIC_URL` | `http://localhost:9000` | Base das URLs públicas |

## Desenvolvimento

No modo dev do Docker (`docker-compose.dev.yml`) o código de `src/` é montado no container
e o uvicorn recarrega ao salvar. Fora do Docker:

```bash
pip install -r requirements.txt
python scripts/executar_local.py caminho/para/imagem.png
python scripts/avaliar.py caminho/para/dataset-classificado --processos 8
```

Depois de mudar qualquer limiar ou lógica de uma etapa, rode `avaliar.py` antes e depois e
compare. O script mostra, por classe, a taxa de veredito certo, a taxa em que o defeito
esperado foi apontado e os falsos alarmes.
