@echo off
cd /d "%~dp0"
echo ========================================================
echo   JalDrishti - Starting Localhost Development Servers
echo ========================================================
echo.

echo 1. Starting Backend Server on http://localhost:5000 ...
start "JalDrishti Backend Server (Port 5000)" cmd /k "cd /d ""%~dp0backend"" && ""%~dp0.venv\Scripts\python.exe"" app.py"

echo 2. Starting Frontend Server on http://localhost:5173 ...
start "JalDrishti Frontend Server (Port 5173)" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

timeout /t 3 /nobreak >nul

echo 3. Opening Application in Browser...
start http://localhost:5173

echo.
echo ========================================================
echo   JalDrishti is running locally:
echo   - Frontend: http://localhost:5173
echo   - Backend:  http://localhost:5000
echo ========================================================
echo Keep the terminal windows open while testing.
pause
