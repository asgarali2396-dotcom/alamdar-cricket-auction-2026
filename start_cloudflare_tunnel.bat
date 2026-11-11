@echo off
title Alamdar Box Cricket Auction 2026 - Cloudflare Tunnel
color 0B
cls
echo ==============================================================
echo    🏏 ALAMDAR BOX CRICKET AUCTION 2026 - CLOUDFLARE TUNNEL
echo ==============================================================
echo.
echo Checking for cloudflared executable...
if not exist "%~dp0cloudflared.exe" (
    echo Downloading official Cloudflare Tunnel (cloudflared.exe)...
    curl.exe -L -o "%~dp0cloudflared.exe" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
    if errorlevel 1 (
        echo.
        echo Error downloading cloudflared.exe automatically.
        echo Please download it manually from:
        echo https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
        echo and place it into this folder.
        pause
        exit /b 1
    )
    echo Download complete!
)

echo.
echo IMPORTANT: Ensure "start_auction_server.bat" is running first!
echo.
echo Starting Cloudflare Tunnel to http://localhost:3000...
echo.
echo Copy the public URL ending with ".trycloudflare.com" below and share it with owners!
echo ==============================================================
echo.
"%~dp0cloudflared.exe" tunnel --url http://localhost:3000
pause
