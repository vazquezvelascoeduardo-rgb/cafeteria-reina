@echo off
title Preparar el cajon

set PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe

if not exist "%PS%" (
  echo No se encuentra PowerShell en este equipo.
  echo.
  pause
  exit /b 1
)

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-cajon.ps1"
echo.
pause
