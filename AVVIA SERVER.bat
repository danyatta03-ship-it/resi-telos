@echo off
title Reparto Resi Telos - Server
color 0A

echo.
echo  ========================================
echo   REPARTO RESI TELOS - Avvio Server
echo  ========================================
echo.

:: Controlla se Node.js e' installato
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo  [ERRORE] Node.js non trovato.
  echo.
  echo  Scarica e installa Node.js da:
  echo  https://nodejs.org  (versione LTS)
  echo.
  echo  Dopo l'installazione riavvia questo file.
  echo.
  pause
  exit /b 1
)

:: Installa dipendenze se mancano
if not exist "node_modules\" (
  echo  Prima esecuzione - installo le dipendenze...
  echo.
  call npm install
  if %ERRORLEVEL% NEQ 0 (
    echo  [ERRORE] Installazione fallita.
    pause
    exit /b 1
  )
  echo.
)

:: Avvia il server
echo  Avvio server in corso...
echo.
start "" "http://localhost:3000"
node server.js

pause
