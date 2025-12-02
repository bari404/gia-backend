@echo off
title Reparar Backend IA (Puerto 3001)
color 0b

echo ===============================
echo 🔧 INICIANDO AUTO-FIX DEL BACKEND
echo ===============================
echo.

echo 🔍 Buscando procesos usando el puerto 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
    echo ⚠ Encontrado proceso en puerto 3001: PID %%a
    echo 🛑 Matando proceso...
    taskkill /PID %%a /F >nul
    echo ✔ Proceso eliminado.
)

echo.
echo 🚀 Arrancando backend con: npm run dev
echo -------------------------------

cd "%~dp0"
npm run dev

pause
