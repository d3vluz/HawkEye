# Arquitetura

O HawkEye é dividido em serviços por responsabilidade, todos orquestrados pelo Docker Compose. A interface conversa só com a API; a API coordena o banco, o armazenamento e o worker de visão computacional.

```mermaid
flowchart LR
    U([Usuário]) --> FE["Frontend<br/>Next.js · :3000"]
    FE -->|HTTP + cookie de sessão| API["API<br/>NestJS · :8000"]
    API -->|POST /process| WK["Worker<br/>FastAPI + OpenCV · interno"]
    API -->|Prisma| DB[("PostgreSQL<br/>:5432")]
    API -->|S3| S3[("MinIO<br/>review · permanent")]
    WK -->|S3| S3
    U -.->|imagens por URL pública| S3
```

## Serviços

| Serviço | Container | Porta | Responsabilidade |
|---------|-----------|-------|------------------|
| Frontend | `hawkeye-frontend` | `3000` | Telas de login, inspeção, revisão e administração |
| API | `hawkeye-api` | `8000` → interno `3001` | Autenticação, regras de negócio, banco, armazenamento e chamada ao worker |
| Worker | `hawkeye-worker` | interno `8000` | Análise das imagens com OpenCV; sem acesso ao banco |
| Banco | `hawkeye-db` | `5432` | PostgreSQL 15 com lotes, capturas, equipe e critérios |
| Armazenamento | `hawkeye-minio` | `9000` / `9001` | MinIO (compatível com S3), com os buckets `review` e `permanent` |
| Inicialização | `hawkeye-minio-init` | — | Cria os buckets e libera a leitura pública; roda uma vez e termina |

A ordem de subida é garantida por `depends_on` com healthcheck: o MinIO sobe, o `minio-init` cria os buckets, o worker fica saudável e só então a API inicia. A API aplica o schema do banco (`prisma db push`) no próprio startup.

## Por que separar assim

- **Orquestração e processamento em serviços diferentes.** A análise de imagens é pesada em CPU e vive no ecossistema natural para isso (Python, OpenCV, NumPy). Se o worker travar ou ficar lento, a API continua respondendo e só a análise falha.
- **O worker não acessa o banco.** Ele lê a imagem original do MinIO, grava as imagens marcadas no mesmo bucket e devolve contagens. Quem decide o veredito e persiste é a API.
- **Sem cache em memória.** O armazenamento temporário de um lote em revisão é o próprio bucket `review`. Nada se perde se um container reiniciar.
- **Revisão humana antes de persistir.** Nenhum lote entra no banco sem que uma pessoa registre. Lote descartado não deixa rastro no PostgreSQL.

## Fluxo de uma inspeção

```mermaid
sequenceDiagram
    actor Op as Operador
    participant FE as Frontend
    participant API
    participant S3 as MinIO
    participant WK as Worker
    participant DB as PostgreSQL

    Op->>FE: escolhe as imagens (PNG)
    FE->>API: POST /upload-batch
    API->>S3: grava originais em review/{timestamp}/{sha256}/
    API-->>FE: lista de arquivos + batch_timestamp
    FE->>API: POST /process-images
    API->>WK: POST /process
    WK->>S3: lê original, grava processed_*.png
    WK-->>API: contagens e URLs por imagem
    API-->>FE: resultados
    Note over FE: revisão: o operador confere e corrige
    alt Registrar
        FE->>API: POST /api/batches/create
        API->>DB: lê critérios e recalcula o veredito
        API->>S3: move review → permanent
        API->>DB: grava lote e capturas
    else Descartar
        FE->>API: POST /api/batches/reject
        API->>S3: apaga a pasta do lote em review
    end
```

Os resultados da análise ficam no `sessionStorage` do navegador até o registro. Se a aba for fechada sem registrar nem descartar, a pasta fica em `review` e passa a ser considerada abandonada após 24 horas. O admin pode limpá-la em **Configurações › Armazenamento**.

### O veredito é sempre do servidor

Na revisão, o frontend mostra o veredito usando a mesma regra da API (`frontend/lib/defeitos.ts` espelha `api/src/configuracoes/criterios.service.ts`). Ao registrar, porém, a API ignora qualquer veredito vindo do navegador: lê os critérios atuais do banco e recalcula `isValid` e `hasStructureDamage` a partir dos defeitos de cada captura. Mudar os critérios não altera lotes já registrados.

## Armazenamento

| Bucket | Conteúdo | Ciclo de vida |
|--------|----------|---------------|
| `review` | Originais e imagens processadas de lotes ainda em revisão | Apagado ao descartar; movido ao registrar; limpável após 24 h |
| `permanent` | Imagens dos lotes registrados | Apagado junto com o lote |

Cada captura ocupa uma pasta `{timestamp}/{sha256}/` com os arquivos:

```
original_<nome>.png      captura enviada
processed_areas.png      grade e divisórias
processed_pins.png       contorno dos pinos
processed_boxes.png      contagem por compartimento
processed_shafts.png     hastes
```

As URLs públicas seguem o formato `MINIO_PUBLIC_URL/{bucket}/{caminho}`. Os dois buckets têm leitura anônima: quem tiver a URL de uma imagem consegue abri-la sem login. Torná-los privados exigiria URLs assinadas.

## Autenticação e perfis

- Login por matrícula ou e-mail e senha. A senha é guardada com hash Argon2 e o login aceita até 5 tentativas por minuto.
- A sessão é um JWT de 8 horas no cookie `hawkeye_session` (`httpOnly`, `SameSite=Lax`, `Secure` quando `COOKIE_SECURE=true`).
- A cada requisição, a API busca o membro no banco. Se a conta foi removida, rebaixada ou teve a senha redefinida (`tokenVersion` incrementado), a sessão aberta deixa de valer na hora.
- Todas as rotas exigem sessão por padrão. `@Publica()` libera uma rota e `@Perfis()` restringe por perfil (`api/src/autenticacao/`).
- Quem tem senha temporária (`mustChangePassword`) só consegue acessar `me`, `change-password` e `logout` até trocá-la.

| Perfil | Área no frontend | O que faz |
|--------|------------------|-----------|
| `EMPLOYEE` (funcionário) | `/inspecao`, `/results`, `/coletas` | Envia, analisa, revisa e registra lotes nas linhas a que tem acesso; vê as próprias coletas |
| `ADMIN` | `/admin/*` | Dashboard, todos os lotes, equipe, linhas de produção e configurações |

As áreas são separadas: o admin não inspeciona e o funcionário não acessa o painel. O `middleware.ts` do Next.js redireciona cada perfil para a sua área, mas é só navegação; a permissão real é sempre conferida pela API.

O startup da API cria, se não existirem, as contas `admin` / `admin` e `user` / `user` para uso local. Novos cadastros feitos pelo admin entram como funcionário com senha temporária.

## Organização do código

```
frontend/   Next.js 15 + React 19 + Tailwind 4 + shadcn/ui        → frontend.md
api/        NestJS 10 + Prisma                                    → api.md, banco-de-dados.md
  src/
    autenticacao/   login, sessão, guardas (@Publica, @Perfis)
    equipe/         membros, linhas de produção e visão geral da equipe
    imagens/        upload para o MinIO e envio ao worker
    lotes/          registro, consulta e exclusão de lotes
    configuracoes/  critérios de inspeção, armazenamento e status dos serviços
    metricas/       dashboard
    comum/          formato único de lote e nomes dos autores
    armazenamento/  cliente MinIO (@aws-sdk/client-s3)
    worker/         cliente HTTP do worker
    banco/          BancoService (Prisma)
  prisma/schema.prisma
worker/     FastAPI + OpenCV                                      → visao-computacional.md
  src/
    main.py         POST /process e GET /health
    analise.py      roda as etapas e monta o resultado
    armazenamento.py
    etapas/         grade, pinos, compartimentos, hastes
  scripts/          executar_local.py e avaliar.py
docker-compose.yml          produção local
docker-compose.dev.yml      sobreposição para desenvolvimento com recarga automática
```

## Convenções

- **Código em português, contrato em inglês.** Nomes de variáveis, funções, componentes e comentários estão em português. Rotas, chaves de JSON e nomes do schema ficam em inglês, porque são o contrato entre os serviços e com os dados.
- **Comentários só para o porquê.** Cada arquivo abre com uma linha dizendo para que serve; dentro do código, comentários aparecem apenas quando a razão de algo não é óbvia.
- **Um formato de lote.** A API devolve o mesmo formato de lote em listas, coletas, detalhe e dashboard (`api/src/comum/lotes.ts`), e o frontend tem um único tipo `Lote` (`frontend/types/index.ts`).

## Limitações conhecidas

- Os buckets do MinIO são públicos para leitura.
- Frontend e API precisam estar no mesmo site para o cookie de sessão funcionar (`localhost` atende).
- Não há envio de e-mail: recuperar acesso é sempre pelo admin, que define uma senha temporária.
- Pensado para rodar localmente com Docker; não há configuração de deploy em nuvem.
