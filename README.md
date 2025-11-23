# HawkEye

[![Version](https://img.shields.io/badge/version-2.2.1-blue)](#)
[![Status](https://img.shields.io/badge/status-active-success)](#)
[![Linguagem](https://img.shields.io/badge/python-3.11-3776AB)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](#)

## 📄 Visão Geral

O **HawkEye** é uma solução baseada em visão computacional desenvolvida para **inspeção automatizada de qualidade industrial**. O sistema processa imagens de linhas de produção (de pins) para identificar, classificar e medir componentes com precisão.

Focado atualmente na análise de **hastes e pinos**, o HawkEye utiliza algoritmos de processamento de imagem para detectar deformidades, ausência de componentes e falhas dimensionais, fornecendo métricas detalhadas via dashboard.

## ✨ Funcionalidades Principais

* **Detecção de Pinos:** Contagem e classificação de pinos (válidos, danificados, cor incorreta).
* **Análise de Hastes:** Verificação de linearidade, comprimento e largura via PCA.
* **Inspeção de Caixas:** Validação de compartimentos e detecção de itens faltantes/extras.
* **Gestão de Lotes:** Criação, processamento e histórico de lotes de inspeção.
* **Dashboard Analítico:** Métricas de qualidade, score de aprovação e distribuição de defeitos.

## 🛠 Tech Stack

* **Backend:** Python 3.11, FastAPI
* **Visão Computacional:** OpenCV, NumPy
* **Banco de Dados & Storage:** Supabase (PostgreSQL)
* **Frontend:** Next.js, Tailwind CSS, Recharts


## 💻 Como Executar
**Pré-requisitos**
- Python 3.11+
- Conta no Supabase (URL e Key)

---

**1) Clone o repositório**
```bash
git clone https://github.com/d3vluz/HawkEye.git
cd hawkeye
```

**2) Execute o Launcher da aplicação**
```bash
# No Windows:
.\iniciar.bat
# No Linux:
./launcher.sh
```

**3) Configure as Variáveis de Ambiente (Frontend)**
```bash
# Acesso a pasta "frontend" crie um .env e preencha as informações:
NEXT_PUBLIC_SUPABASE_URL=sua_key_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_key_aqui
```

**4) Configure as Variáveis de Ambiente (Backend)**
```bash
# Acesso a pasta "backend" crie um .env e preencha as informações:
SUPABASE_URL="sua_key_aqui"
SUPABASE_KEY="sua_key_aqui"
```

**5) Acesse: "localhost:3000"**