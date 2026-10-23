@echo off
title KrishiRakshak All-in-One Command Center
echo ====================================================================
echo   🌾 Starting KrishiRakshak All-in-One Rover Command System
echo   (Frontend + Backend + Real-time WebSockets)
echo ====================================================================
set "PATH=C:\Users\meand\AppData\Local\Programs\node\node-v20.18.0-win-x64;%PATH%"
cd /d "%~dp0"

echo [1/2] Launching Unified Server on http://localhost:5000 ...
timeout /t 2 /nobreak >nul
start "" "http://localhost:5000"
node server.js
pause
