@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Trackify - Smart Classroom Monitor

echo.
echo  ==========================================
echo   TRACKIFY - Smart Classroom Monitor
echo  ==========================================
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js is not installed.
    echo          Download it from: https://nodejs.org/
    pause & exit /b 1
)

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    python3 --version >nul 2>&1
    if errorlevel 1 (
        echo  [ERROR] Python is not installed.
        echo          Download it from: https://python.org/
        pause & exit /b 1
    )
    set PYTHON=python3
) else (
    set PYTHON=python
)

:: Install Node dependencies if missing
if not exist "node_modules" (
    echo  [SETUP] Installing frontend dependencies...
    call npm install
)
if not exist "local-api\node_modules" (
    echo  [SETUP] Installing local-api dependencies...
    cd local-api && call npm install && cd ..
)

:: Start all 3 services in separate windows
echo  Starting all services...
echo.

echo  [1/3] Local API         --^> http://localhost:3001
start "Trackify - Local API" cmd /k "cd /d "%~dp0local-api" && node server.js"

echo  [2/3] Python AI Backend --^> http://localhost:5000
start "Trackify - Python AI" cmd /k "cd /d "%~dp0" && %PYTHON% trackify_backend.py"

:: Small delay so API has time to init before frontend connects
timeout /t 2 /nobreak >nul

echo  [3/3] Frontend          --^> http://localhost:8080
start "Trackify - Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

:: Wait for frontend to start then open browser
timeout /t 4 /nobreak >nul
echo.
echo  Opening browser...
start http://localhost:8080

echo.
echo  ==========================================
echo   All services started!
echo   Close the 3 terminal windows to stop.
echo  ==========================================
echo.
echo   Admin:    admin@trackify.com   / admin123
echo   Dean:     dean@trackify.com    / dean123
echo   Doctor:   doctor@trackify.com  / doctor123
echo   Student:  student@trackify.com / student123
echo.
pause
