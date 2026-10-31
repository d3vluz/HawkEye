<div align="center">
  
  ![Mockup do Projeto](assets/logo_project.png)
  <h3>HawkEye</h3>
  <p><strong>Sistema Avançado de Inspeção Visual</strong></p>

  [![Status](https://img.shields.io/badge/status-active-success.svg)]()
  [![License](https://img.shields.io/badge/license-MIT-blue.svg)]()
  [![Version](https://img.shields.io/badge/version-0.7-blue.svg)]()
</div>

---

HawkEye é um sistema de visão computacional projetado para inspeção de qualidade automatizada. Ele analisa imagens de lotes de produtos, detectando defeitos estruturais, ausência ou excesso de componentes (como pinos e hastes), avaliando a conformidade de cada compartimento, e fornecendo métricas de qualidade detalhadas.

## Funcionalidades Principais

*   **Inspeção Automatizada:** Processamento rápido de imagens e identificação de anomalias (pinos ausentes, extras, danificados, ou com cores incorretas).
*   **Pipeline de Processamento Visual:** Aplicação de múltiplas camadas de análise (Caixas delimitadoras, Áreas de interesse, Pins, Hastes).
*   **Dashboard Executivo:** Visualização de métricas globais, *Quality Score*, taxa de sucesso e distribuição de erros.
*   **Gerenciamento de Lotes:** Controle completo de cada lote inspecionado, desde o upload temporário (cache em memória) até a persistência no storage e banco de dados.
*   **Análise Detalhada:** Visualização individualizada de cada imagem do lote com possibilidade de alternar dinamicamente entre os filtros de visão computacional aplicados.

---

## Capturas de Tela

### 1. Dashboard Principal
> Em Desenvolvimento
<!-- dashboard mostrando as métricas globais e distribuição de erro -->

### 2. Visão Detalhada do Lote
> Em Desenvolvimento
<!-- print da tela de detalhes de um batch, exibindo o Quality Score e a lista de capturas -->

### 3. Galeria e Filtros de Visão Computacional
> Em Desenvolvimento
<!-- print demonstrando a troca entre a imagem original e as análises -->

---

## Tecnologias Utilizadas

Este projeto utiliza uma separação de arquitetura baseada em microsserviços rodando sobre **Docker**.

**Frontend:**
*   **[Next.js](https://nextjs.org/) (React):** Interface de usuário rápida, reativa e fortemente tipada.
*   **[Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/):** Componentes maravilhosos, responsivos e fáceis de customizar.
*   **[Recharts](https://recharts.org/):** Geração dinâmica de gráficos estatísticos do controle de qualidade.

**Backend:**
*   **[FastAPI](https://fastapi.tiangolo.com/) (Python 3.11):** API REST assíncrona, robusta e escalável.
*   **[OpenCV](https://opencv.org/):** (cv2/Numpy) Motor primário responsável pelas manipulações de imagem e identificação de defeitos por contraste, bordas, etc.

**Infraestrutura & Persistência:**
*   **[Docker](https://www.docker.com/) & Docker Compose:** Orquestração flexível isolando o Frontend, Backend e Banco de Dados.
*   **[Prisma ORM](https://www.prisma.io/):** Controle da modelagem relacional orientada a objetos (assíncrono em Python).
*   **[PostgreSQL](https://www.postgresql.org/):** Banco de dados relacional sólido para armazenar todo histórico de lotes e estatísticas da telemetria.
*   **Local Storage Volumizado:** Sistema de cache de arquivos nativo isolando pastas temporárias e persistentes.

---

## Instalação e Execução

A maneira mais prática de subir todo o ecossistema do HawkEye é através do Docker Compose. 

### Pré-requisitos
*   [Docker](https://docs.docker.com/get-docker/)
*   [Docker Compose](https://docs.docker.com/compose/install/)

### Passos

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/SeuUsuario/HawkEye.git
   cd HawkEye
   ```

2. **Inicie os Containers:**
   Execute o orquestrador para baixar as imagens e construir o ecossistema (banco, api e frontend).
   ```bash
   docker compose up -d --build
   ```

3. **Gere a tipagem do Prisma (Opcional, em caso de erro):**
   ```bash
   docker exec hawkeye-backend prisma generate
   ```

4. **Acesse as aplicações:**
   *   **Frontend (Interface do Usuário):** [http://localhost:3000](http://localhost:3000)
   *   **Backend (Swagger/Docs API):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Variáveis de Ambiente

O sistema possui configuração nativa configurada no `docker-compose.yml`, porém caso deseje rodar localmente fora de containers, você deve criar arquivos `.env`.

**Exemplo Backend:**
```ini
DATABASE_URL="postgresql://hawkeye_user:hawkeye_pass@localhost:5432/hawkeye_db?schema=public"
```

**Exemplo Frontend:**
```ini
NEXT_PUBLIC_API_URL="http://localhost:8000"
```

---

## Fluxo de Dados

1. Imagens são tiradas do equipamento de vistoria e enviadas via API para `/upload-batch/`.
2. O Backend coloca temporariamente essas imagens em Cache de Memória e processa o modelo matemático de OpenCV.
3. O Backend retorna um *Preview* dos dados extraídos para o Frontend aprovar ou rejeitar.
4. Se rejeitado, o Cache é deletado permanentemente sem sujar o PostgreSQL.
5. Se aprovado, as imagens (Originais e Mascaradas) sobem fisicamente para o disco rígido, enquanto o Schema Prisma cadastra as conexões unindo os Defeitos e o *Score* daquele Batch de Inspeção finalizado.

---

## Licença

Este projeto é desenvolvido para fins corporativos/estudos. Licenciado sob a [MIT License](LICENSE).
