@echo off
title Cafeteria
cd /d "%~dp0"

echo Abriendo la aplicacion de la cafeteria...
echo.
echo NO CIERRES ESTA VENTANA mientras uses la aplicacion.
echo.

if not exist "dist" (
  echo Preparando la aplicacion por primera vez, tarda un momento...
  call npm install
  call npm run build
)

start "" http://localhost:4173
call npx vite preview --port 4173
