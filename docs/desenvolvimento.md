# Desenvolvimento

O projeto roda inteiro em Docker. Não é preciso instalar Node, Python ou PostgreSQL na máquina; só o [Docker](https://docs.docker.com/get-docker/) com Docker Compose.

## Primeira execução

```bash
git clone https://github.com/d3vluz/HawkEye.git
cd HawkEye
cp .env.example .env
```

Preencha pelo menos `JWT_SECRET` no `.env`; sem ele a API e o frontend não sobem. Qualquer texto longo e aleatório serve, por exemplo a saída de `openssl rand -hex 32`.

```bash
docker compose up --build
```

| Endereço | O quê |
|----------|-------|
| [http://localhost:3000](http://localhost:3000) | Interface |
| [http://localhost:8000/health](http://localhost:8000/health) | Healthcheck da API |
| [http://localhost:9001](http://localhost:9001) | Console do MinIO (`MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`) |

No primeiro startup a API cria as tabelas, as linhas de produção A, B e C e duas contas locais: `admin` / `admin` e `user` / `user`. Troque essas senhas antes de expor o sistema fora da sua máquina.

## Modo de desenvolvimento

Para editar código com recarga automática, use a sobreposição `docker-compose.dev.yml`:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -V
```

| Serviço | Comando no modo dev | Recarrega ao salvar |
|---------|---------------------|---------------------|
| `frontend` | `next dev` | sim |
| `api` | `nest start --watch` | sim |
| `worker` | `uvicorn --reload` | sim |

- O `-V` renova os volumes anônimos (`node_modules`, `dist`, `.next`) ao alternar entre o modo dev e o normal.
- Dependência nova num `package.json` ou no `requirements.txt` ainda exige `up --build -V`.
- O polling (`WATCHPACK_POLLING`, `TSC_WATCH*`, `WATCHFILES_FORCE_POLLING`) é necessário porque o Docker Desktop não repassa eventos de arquivo das pastas do Windows.

## Comandos do dia a dia

```bash
# subir sem reconstruir
docker compose up

# derrubar mantendo banco e imagens
docker compose down

# derrubar e apagar tudo (banco e MinIO)
docker compose down -v

# fora do modo dev: aplicar mudança de código da API
docker compose up -d --build --renew-anon-volumes api

# logs de um serviço
docker compose logs -f api
```

## Variáveis de ambiente

Um único `.env` na raiz, copiado de `.env.example`. O `docker-compose.yml` lê esse arquivo e injeta os valores em cada container.

| Variável | Usada por | Uso |
|----------|-----------|-----|
| `POSTGRES_USER` · `POSTGRES_PASSWORD` · `POSTGRES_DB` | db, api | Credenciais e nome do banco |
| `DATABASE_URL` | api | Connection string do PostgreSQL |
| `MINIO_ACCESS_KEY` · `MINIO_SECRET_KEY` | minio, api, worker | Credenciais do MinIO, definidas por você |
| `MINIO_BUCKET_REVIEW` · `MINIO_BUCKET_PERMANENT` | minio-init, api, worker | Nomes dos buckets (padrão `review` e `permanent`) |
| `MINIO_ENDPOINT` | api, worker | Endereço interno (`http://minio:9000`) |
| `MINIO_PUBLIC_URL` | api, worker | Endereço que o navegador usa para abrir as imagens (`http://localhost:9000`) |
| `CV_WORKER_URL` | api | Endereço interno do worker (`http://worker:8000`) |
| `JWT_SECRET` | api, frontend | Assina as sessões; obrigatório |
| `FRONTEND_ORIGIN` | api | Origem liberada no CORS (`http://localhost:3000`) |
| `COOKIE_SECURE` | api | `true` quando servido por HTTPS |
| `NEXT_PUBLIC_API_URL` | frontend | Endereço da API para o navegador (`http://localhost:8000`) |

Nunca coloque valores reais no `.env.example` nem faça commit do `.env`.

## Verificações

```bash
# tipos e lint do frontend
docker compose exec frontend npx tsc --noEmit
docker compose exec frontend npx next lint

# tipos da API
docker compose exec api npx tsc --noEmit

# acurácia do pipeline (fora do Docker, com o dataset rotulado)
cd worker && python scripts/avaliar.py caminho/para/dataset-classificado
```

Não há suíte de testes automatizados. Mudanças no pipeline de visão computacional são medidas com o `avaliar.py` antes e depois; veja [Visão computacional](visao-computacional.md#mudando-o-pipeline).

## Convenções de código

- Código em português: variáveis, funções, componentes e comentários. Rotas, chaves de JSON e nomes do schema ficam em inglês, porque são o contrato entre os serviços.
- Cada arquivo começa com um comentário de uma linha dizendo para que serve.
- Comentários só explicam o porquê, quando não é óbvio. Sem docstrings de várias linhas.
- Nada de credenciais no código, exceto as duas contas locais criadas pela API.

## Problemas comuns

| Sintoma | Causa e solução |
|---------|-----------------|
| `docker compose up` falha com "defina JWT_SECRET no .env" | Falta `JWT_SECRET` no `.env` |
| A API não reflete a mudança no código (fora do modo dev) | O volume anônimo guarda o `dist` antigo. Rode `docker compose up -d --build --renew-anon-volumes api` |
| A API não sobe depois de remover uma coluna do schema | O `prisma db push` recusa perder dados. Rode `docker compose exec api npx prisma db push --accept-data-loss` uma vez |
| Imagens não aparecem na revisão | `MINIO_PUBLIC_URL` precisa ser acessível pelo navegador, não o endereço interno do Docker |
| Login funciona mas toda tela volta para o login | Frontend e API com `JWT_SECRET` diferentes, ou acessados por sites diferentes (o cookie não é enviado) |
| A remoção de uma linha de produção é recusada | A linha tem lotes registrados (`onDelete: Restrict`); renomeie em vez de remover |
| O bucket `review` só cresce | Revisões fechadas sem registrar nem descartar. Limpe em **Configurações › Armazenamento** após 24 h |
| Mudança de arquivo não recarrega no modo dev | Confirme que subiu com o `docker-compose.dev.yml` e o `-V` |
