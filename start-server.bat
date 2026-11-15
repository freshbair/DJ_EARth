@echo off
title DJ_EARth Local Server
echo ========================================================
echo   Starting DJ_EARth Local Server for Voice Assistant
echo ========================================================
echo.
echo Note: Google Chrome and Microsoft Edge require a local
echo server (http://localhost) for speech-to-text to work.
echo.

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting server with Python...
    start http://localhost:8000/
    python -m http.server 8000
    goto end
)

where npx >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting server with npx serve...
    start http://localhost:8000/
    npx serve -l 8000 .
    goto end
)

echo Starting server with PowerShell...
start http://localhost:8000/
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"

:end
pause
