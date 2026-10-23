@echo off
title KRISHI RAKSHAK - Solar AI Field Robot
cd /d "C:\Users\meand\.gemini\antigravity\scratch\krishi-rakshak"
set "PATH=C:\Users\meand\AppData\Local\Programs\node\node-v20.18.0-win-x64;%PATH%"

echo ===================================================================
echo   KRISHI RAKSHAK - Solar Operated AI Smart Crop Analysis Robot
echo   Intelligent Crop Monitoring, Mapping & Targeted Field Assistance
echo ===================================================================
echo.
echo Starting local web server...
timeout /t 2 /nobreak >nul
start http://localhost:5173
npm run dev -- --host --port 5173
pause
