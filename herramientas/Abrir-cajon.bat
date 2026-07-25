@echo off
title Abrir cajon

rem Se llama al PowerShell que Windows trae de serie por su ruta completa.
rem Si se llama solo "powershell", algunos equipos abren la tienda para
rem instalar una version nueva que no hace ninguna falta.
set PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe

if not exist "%PS%" (
  echo No se encuentra PowerShell en este equipo.
  echo Ruta buscada: %PS%
  echo.
  pause
  exit /b 1
)

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0abrir-cajon.ps1"
echo.
pause
