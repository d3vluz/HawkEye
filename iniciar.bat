@echo off
title HawkEye Launcher

echo ==================================================
echo   Iniciando HawkEye System (Backend + Frontend)
echo ==================================================
echo.

:: --- 1. BACKEND ---
echo [1/2] Lançando Backend em nova janela...
start "HawkEye Backend" cmd /k "cd backend && if not exist venv (echo [INFO] Criando ambiente virtual... && python -m venv venv) else (echo [INFO] Venv ja existe.) && echo [INFO] Ativando venv... && call venv\Scripts\activate && echo [INFO] Verificando dependencias... && pip install -r requirements.txt && echo [INFO] Iniciando Uvicorn... && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

:: --- 2. FRONTEND ---
echo [2/2] Lançando Frontend em nova janela...
start "HawkEye Frontend" cmd /k "cd frontend && echo [INFO] Instalando dependencias NPM (pode demorar na primeira vez)... && npm install && echo [INFO] Rodando script de produção... && npm run build && npm run start"
:: --- opção: rodar em dev: npm run dev

echo.
echo ==================================================
echo   Tudo pronto! sistema rodando em: localhost:3000.
echo ==================================================
echo.
timeout /t 5