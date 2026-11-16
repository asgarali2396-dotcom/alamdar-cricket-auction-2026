@echo off
title Alamdar Box Cricket Auction 2026 - Online Public Launcher
color 0A
cls
echo ==============================================================
echo    🏏 ALAMDAR BOX CRICKET AUCTION 2026 - ALL-IN-ONE LAUNCHER
echo ==============================================================
echo.

:: 1. Check if local Python server is already running on port 3000
netstat -ano | findstr :3000 | findstr LISTENING >nul
if errorlevel 1 (
    echo [1/2] Local Python auction server is NOT running.
    echo       Starting Python server in background...
    start "Alamdar Auction - Local Server" cmd /k "python server.py"
    timeout /t 2 /nobreak >nul
    echo       Local Python server started successfully!
) else (
    echo [1/2] Local Python auction server is already running on port 3000.
)

:: 2. Launch Cloudflare Tunnel
echo.
echo [2/2] Launching Cloudflare Public Tunnel...
echo ==============================================================
echo.
call "%~dp0start_cloudflare_tunnel.bat"

