@echo off
cd /d "%~dp0"
echo ========================================================
echo   Compiling and Running JalDrishti Java Simulator
echo ========================================================
echo.

where javac >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] javac.exe not found on PATH.
    pause
    exit /b 1
)

echo Compiling Java source files...
javac -d bin jaldrishti\FloodRiskEngine.java jaldrishti\JalDrishtiSimulator.java
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Java compilation failed!
    pause
    exit /b %ERRORLEVEL%
)

echo Running Java Flood Risk Simulation...
echo.
java -cp bin jaldrishti.JalDrishtiSimulator
pause

