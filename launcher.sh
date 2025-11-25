#!/bin/bash

# Define o título da janela atual (se o terminal suportar)
echo -ne "\033]0;HawkEye Launcher\007"

echo "=================================================="
echo "  Iniciando HawkEye System (Backend + Frontend)"
echo "=================================================="
echo ""

# --- 1. BACKEND ---
echo "[1/2] Lançando Backend em nova janela..."

# Abre nova janela, entra na pasta, verifica venv, instala reqs e roda uvicorn
gnome-terminal --title="HawkEye Backend" -- bash -c "
    cd backend;
    if [ ! -d 'venv' ]; then
        echo '[INFO] Criando ambiente virtual...';
        python3 -m venv venv;
    else
        echo '[INFO] Venv ja existe.';
    fi;
    echo '[INFO] Ativando venv...';
    source venv/bin/activate;
    echo '[INFO] Verificando dependencias...';
    pip install -r requirements.txt;
    echo '[INFO] Iniciando Uvicorn...';
    uvicorn main:app --reload --host 0.0.0.0 --port 8000;
    exec bash"

# --- 2. FRONTEND ---
echo "[2/2] Lançando Frontend em nova janela..."

# Abre nova janela, entra na pasta, instala npm e roda start
gnome-terminal --title="HawkEye Frontend" -- bash -c "
    cd frontend;
    echo '[INFO] Instalando dependencias NPM (pode demorar na primeira vez)...';
    npm install;
    echo '[INFO] Rodando script de produção...';
    npm run build;
    npm run start;
    exec bash"
# opcional: npm run dev

echo ""
echo "=================================================="
echo "  Tudo pronto! Sistema rodando em: localhost:3000"
echo "=================================================="
echo ""

# Espera 5 segundos antes de fechar o launcher principal
sleep 5