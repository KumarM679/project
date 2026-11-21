@echo off
cd /d "%~dp0"
echo ========================================================
echo   JalDrishti - High Speed Cloudflare Public Link
echo ========================================================
echo.

echo 1. Starting Backend Server (Port 5000)...
start "JalDrishti Backend Server" cmd /k "cd /d ""%~dp0backend"" && ""%~dp0.venv\Scripts\python.exe"" app.py"

timeout /t 3 /nobreak >nul

echo 2. Launching Cloudflare Tunnel...
echo.
echo ========================================================
echo   Look for the URL below ending in .trycloudflare.com
echo   Share that URL with anyone to view your live app!
echo ========================================================
echo.
cloudflared.exe tunnel --url http://127.0.0.1:5000
pause
