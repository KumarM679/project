@echo off
cd /d "%~dp0"
echo ========================================================
echo   Compiling JalDrishti C/C++ Engine
echo ========================================================

where gcc >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Compiling with GCC...
    gcc -shared -O3 -DBUILDING_RISK_ENGINE_DLL -o risk_engine.dll risk_engine.c
    gcc -O3 -o risk_cli.exe risk_cli.c risk_engine.c
    where g++ >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        g++ -O3 -o risk_cpp.exe risk_engine.cpp risk_engine.c
    )
    echo Build complete! Created risk_engine.dll and executables.
    pause
    exit /b 0
)

where clang >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Compiling with Clang...
    clang -shared -O3 -DBUILDING_RISK_ENGINE_DLL -o risk_engine.dll risk_engine.c
    clang -O3 -o risk_cli.exe risk_cli.c risk_engine.c
    echo Build complete with Clang!
    pause
    exit /b 0
)

where cl >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Compiling with MSVC cl.exe...
    cl /LD /O2 /DBUILDING_RISK_ENGINE_DLL risk_engine.c /Fe:risk_engine.dll
    cl /O2 risk_cli.c risk_engine.c /Fe:risk_cli.exe
    echo Build complete with MSVC!
    pause
    exit /b 0
)

echo [INFO] No C compiler (gcc, clang, cl) found on PATH.
echo Python's risk_engine.py will run the built-in fallback engine directly.
echo To enable C hardware acceleration, install MinGW-w64 or Visual Studio C++ Build Tools.
pause

