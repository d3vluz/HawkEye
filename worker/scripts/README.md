# Scripts — Execução local do pipeline

Permite rodar e testar o pipeline de visão computacional diretamente no disco,
sem precisar de Docker, MinIO ou frontend.

## Pré-requisitos

```bash
cd worker
pip install -r requirements.txt
```

## run_local.py

Processa uma imagem e salva os resultados em `scripts/output/`.

```bash
# Pipeline completo
python scripts/run_local.py caminho/para/imagem.png

# Pasta de saída customizada
python scripts/run_local.py imagem.png --output ./minha-saida

# Com máscara de borda explícita
python scripts/run_local.py imagem.png --mask src/border_mask.png

# Apenas steps específicos
python scripts/run_local.py imagem.png --steps areas pins
```

### Saídas geradas

| Arquivo | Conteúdo |
|---------|----------|
| `<nome>_areas.png` | Grade de compartimentos detectada |
| `<nome>_pins.png` | Pins detectados e classificados |
| `<nome>_boxes.png` | Bounding boxes por compartimento |
| `<nome>_shafts.png` | Análise de hastes |
| `<nome>_summary.json` | Contagens e classificações em JSON |

## Adicionando um novo step

1. Implemente a função em `src/pipeline.py`:

```python
def _step_meu_algoritmo(ctx: PipelineContext) -> None:
    ctx.meu_resultado = meu_algoritmo(ctx.original)
```

2. Adicione ao campo correspondente em `PipelineContext` (se necessário):

```python
@dataclass
class PipelineContext:
    ...
    meu_resultado: dict = field(default_factory=dict)
```

3. Registre no final de `PIPELINE_STEPS`:

```python
PIPELINE_STEPS = [
    _step_areas,
    _step_pins,
    _step_boxes,
    _step_shafts,
    _step_meu_algoritmo,  # ← aqui
]
```

Pronto — o script local e o endpoint HTTP usarão o novo step automaticamente.
