# API

API em NestJS 10, exposta em `http://localhost:8000` (porta interna `3001`). É o único serviço que o frontend chama: cuida da sessão, das regras de negócio, do banco, do armazenamento e da chamada ao worker.

## Sessão

Toda rota exige sessão, exceto as marcadas como públicas. A sessão vai no cookie `hawkeye_session`, criado pelo login; o navegador precisa enviar `credentials: "include"`. O CORS aceita apenas a origem definida em `FRONTEND_ORIGIN`.

| Resposta | Quando |
|----------|--------|
| `401` | Sem sessão, sessão expirada ou invalidada (conta inativa, senha trocada ou redefinida) |
| `403` | Perfil sem acesso à rota, ou senha temporária ainda não trocada |
| `429` | Mais de 5 tentativas de login no mesmo minuto |

## Rotas

**Perfis:** público = sem sessão | sessão = qualquer perfil logado | func. = `EMPLOYEE` | admin = `ADMIN`.

### Autenticação — `api/src/autenticacao/`

| Método | Rota | Perfil | Descrição |
|--------|------|--------|-----------|
| `POST` | `/api/auth/login` | público | `{ identifier, password }`; `identifier` é matrícula ou e-mail |
| `POST` | `/api/auth/logout` | público | Apaga o cookie |
| `GET` | `/api/auth/me` | sessão | Dados de quem está logado |
| `POST` | `/api/auth/change-password` | sessão | `{ currentPassword, newPassword }` (mínimo de 8 caracteres); emite uma nova sessão |

### Inspeção — `api/src/imagens/` e `api/src/lotes/`

| Método | Rota | Perfil | Descrição |
|--------|------|--------|-----------|
| `POST` | `/upload-batch` | func. | Multipart com o campo `files` (até 10 imagens). Grava no bucket `review` |
| `POST` | `/process-images` | func. | `{ images }` com a lista devolvida pelo upload. Repassa ao worker |
| `POST` | `/api/batches/create` | func. | Registra o lote revisado (veja abaixo) |
| `POST` | `/api/batches/reject` | func. | `{ timestamp }`. Apaga a pasta do lote no bucket `review` |
| `GET` | `/api/batches/mine` | func. | Lotes registrados por quem está logado |
| `GET` | `/api/batches/mine/:id` | func. | Detalhe de um lote próprio |

### Administração

| Método | Rota | Perfil | Descrição |
|--------|------|--------|-----------|
| `GET` | `/api/batches` | admin | Todos os lotes; `?unitId=` filtra por linha |
| `GET` | `/api/batches/:id` | admin | Detalhe do lote com as capturas |
| `DELETE` | `/api/batches/:id` | admin | Apaga as imagens do bucket `permanent` e depois o lote |
| `GET` | `/api/metrics/dashboard` | admin | Métricas dos últimos 30 dias contra os 30 anteriores; `?unitId=` filtra |
| `GET` | `/api/members` | admin | Lista a equipe |
| `POST` | `/api/members` | admin | Cadastra funcionário com senha temporária |
| `PATCH` | `/api/members/:id` | admin | Altera nome, contato, linhas, status ou perfil |
| `POST` | `/api/members/:id/reset-password` | admin | Define nova senha temporária e derruba as sessões do membro |
| `DELETE` | `/api/members/:id` | admin | Remove o membro; os lotes dele mantêm a matrícula |
| `GET` | `/api/team/overview` | admin | Totais de membros, linhas e acessos do dia |
| `GET` | `/api/units` | admin | Linhas de produção com totais de membros e lotes |
| `GET` | `/api/units/mine` | func. | Linhas em que o funcionário pode registrar lotes |
| `POST` · `PATCH` · `DELETE` | `/api/units[/:id]` | admin | Cria, renomeia ou remove linha (só sem lotes) |
| `GET` | `/api/settings/inspection` | sessão | Critérios de inspeção vigentes |
| `PUT` | `/api/settings/inspection` | admin | Salva os critérios |
| `GET` | `/api/settings/storage` | admin | Uso dos buckets e revisões abandonadas (mais de 24 h) |
| `POST` | `/api/settings/storage/cleanup` | admin | Apaga as revisões abandonadas |
| `GET` | `/api/settings/status` | admin | Situação e latência do banco, do MinIO e do worker |
| `GET` | `/health` | público | Healthcheck usado pelo Docker |

O admin não pode alterar o próprio perfil ou status nem remover a própria conta, o que garante que sempre reste ao menos um admin.

## Formatos

### Upload e análise

`POST /upload-batch` devolve:

```json
{
  "success": true,
  "batch_timestamp": "2026-11-08T21-15-02",
  "total_uploaded": 1,
  "files": [
    {
      "filename": "caixa_07.png",
      "storage_path": "2026-11-08T21-15-02/<sha256>/original_caixa_07.png",
      "sha256": "<sha256>",
      "timestamp": "2026-11-08T21-15-02"
    }
  ]
}
```

`POST /process-images` recebe `{ "images": files }` e devolve `{ "results": [...] }`, um item por imagem com as URLs das camadas e as contagens:

```json
{
  "filename": "caixa_07.png",
  "sha256": "<sha256>",
  "timestamp": "2026-11-08T21-15-02",
  "original_url": "http://localhost:9000/review/.../original_caixa_07.png",
  "areas_url": "...processed_areas.png",
  "pins_url": "...processed_pins.png",
  "boxes_url": "...processed_boxes.png",
  "shafts_url": "...processed_shafts.png",
  "areas_count": 15,
  "grid_rows": 3,
  "grid_cols": 5,
  "missing_dividers": [],
  "pins_count": 14,
  "pin_classification": {
    "total_pins": 14,
    "details": { "pins_ok": 13, "pins_wrong_color": 1, "pins_damaged_yellow": 0, "pins_double_defect": 0 }
  },
  "boxes_info": { "total_boxes": 15, "empty_boxes": 1, "single_pin_boxes": 14, "multiple_pins_boxes": 0, "boxes": [] },
  "shaft_classification": { "rejected_shafts": 0 }
}
```

### Registro do lote

`POST /api/batches/create`:

```json
{
  "name": "Turno A · caixa 12",
  "unit_id": "<id da linha>",
  "description": "opcional",
  "batch_timestamp": "2026-11-08T21-15-02",
  "captures": [
    {
      "filename": "caixa_07.png",
      "sha256": "<sha256>",
      "areas_detected": 15,
      "grid_rows": 3,
      "grid_cols": 5,
      "detected_counts": { "missing": 1, "extra": 0, "wrongColor": 0, "damaged": 0, "shaft": 0 },
      "has_missing_pins": true,
      "has_extra_pins": false,
      "has_damaged_pins": false,
      "has_wrong_color_pins": true,
      "has_shaft_defects": false,
      "structure_override": false
    }
  ]
}
```

- `detected_counts` é o que o sistema detectou, antes da revisão. Os campos `has_*` são os defeitos finais, já com as correções do operador. `structure_override` só vai quando o operador corrigiu a estrutura; o dano estrutural detectado é calculado pela API a partir da grade.
- No exemplo, o operador marcou cor errada (`has_wrong_color_pins: true`) que o sistema não tinha detectado (`wrongColor: 0`). A correção é derivada dessa diferença; o navegador não envia lista de correções nem total de defeitos.
- O navegador não envia veredito: a API grava os defeitos e a versão dos critérios usada, e calcula o veredito a cada leitura.
- Registrar duas vezes o mesmo `batch_timestamp` devolve `409`.
- O autor é sempre o da sessão, e o funcionário precisa ter acesso à linha informada.

### Lote

Listas, coletas, detalhe e dashboard usam o mesmo formato de lote:

```json
{
  "id": "<uuid>",
  "name": "Turno A · caixa 12",
  "description": null,
  "created_at": "2026-11-08T21:15:40.000Z",
  "author": { "matricula": "user", "name": "Funcionário" },
  "unit": { "id": "<uuid>", "name": "Linha A" },
  "total_captures": 5,
  "valid_captures": 4,
  "invalid_captures": 1,
  "total_defects": 2,
  "quality_score": 80
}
```

O detalhe devolve `{ batch, captures }`. Cada captura traz as URLs no bucket `permanent`, `is_valid`, `defects_count`, `corrections` e os defeitos agrupados em `defects: { missing, extra, wrongColor, damaged, shaft, structure }`. Nenhum desses campos é gravado: todos são calculados a partir das tabelas `capture_defects` e `inspection_criteria` (veja [Banco de dados › Normalização](banco-de-dados.md#normalização)).

Ids de lotes, membros e linhas são UUID; um id em formato inválido na URL devolve `400`.

Os tipos correspondentes no frontend estão em [`frontend/types/index.ts`](../frontend/types/index.ts).
