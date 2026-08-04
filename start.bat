@echo off
title Hau Para Fuma
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js la instala iha ita-nia PC.
  echo Hola husi https://nodejs.org, hafoin husik file ne'e klik fila fali.
  pause
  exit /b 1
)

start "Hau Para Fuma - servidor" cmd /k node server\server.js
timeout /t 1 /nobreak >nul
start http://localhost:8080
