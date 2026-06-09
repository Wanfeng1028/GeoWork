@echo off
setlocal EnableDelayedExpansion
chcp 437 >nul
title GeoWork Startup Script

echo ========================================
echo        GeoWork Startup Script
echo ========================================
echo.

:: Get script directory
set "ROOT_DIR=%~dp0"
set "PID_FILE=%ROOT_DIR%.geowork-pids"

:: Check dependencies
echo [1/6] Checking dependencies...
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js not found, please install Node.js first
    pause
    exit /b 1
)

where go >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Go not found, please install Go first
    pause
    exit /b 1
)

where python >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Python not found, please install Python first
    pause
    exit /b 1
)
echo [OK] Basic dependencies checked
echo.

:: Check Electron dependencies
echo [2/6] Checking Electron dependencies...
if not exist "%ROOT_DIR%apps\desktop\node_modules\.package-lock.json" (
    echo [INFO] First run, installing frontend dependencies...
    cd /d "%ROOT_DIR%apps\desktop"
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] Frontend dependency installation failed
        pause
        exit /b 1
    )
    cd /d "%ROOT_DIR%"
)
echo [OK] Electron dependencies checked
echo.

:: Check port availability
echo [3/6] Checking port availability...
set "port_clear=true"

netstat -aon | findstr :8765 | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARNING] Port 8765 is already in use
    set "port_clear=false"
) else (
    echo [OK] Port 8765 is available
)

netstat -aon | findstr :8766 | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARNING] Port 8766 is already in use
    set "port_clear=false"
) else (
    echo [OK] Port 8766 is available
)

if "!port_clear!"=="false" (
    echo.
    echo [WARNING] Some ports are already in use
    echo [HINT] If these are old GeoWork processes, run stop.bat first
    echo.
    choice /c YN /m "Continue startup? (Y/N)"
    if !errorlevel! equ 2 (
        echo Startup cancelled
        pause
        exit /b 0
    )
)
echo.

:: Clean old PID file
if exist "%PID_FILE%" del "%PID_FILE%"

:: Create log directory
if not exist "%ROOT_DIR%logs" mkdir "%ROOT_DIR%logs"

:: Start Go Core Runtime
echo [4/6] Starting Go Core Runtime (port 8765)...
start "GeoWork-Go-Core" /D "%ROOT_DIR%core" /B cmd /c "go run ./cmd/geowork-runtime --port 8765 >> "%ROOT_DIR%logs\go-core.log" 2>&1 || (echo Go Core stopped. Press any key to close... & pause >nul)"

:: Wait for startup
timeout /t 4 >nul

:: Get Go Core process PID
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765 ^| findstr LISTENING') do set "GO_PID=%%a"
if defined GO_PID (
    echo Go-Core: !GO_PID! >> "%PID_FILE%"
    echo [OK] Go Core Runtime started (PID: !GO_PID!)
) else (
    echo [INFO] Go Core Runtime is starting, please wait...
)
echo.

:: Start Python Geo Worker
echo [5/6] Starting Python Geo Worker (port 8766)...
start "GeoWork-Python-Worker" /D "%ROOT_DIR%workers\geo-python" /B cmd /c "python -m uvicorn app.main:app --host 127.0.0.1 --port 8766 >> "%ROOT_DIR%logs\python-worker.log" 2>&1 || (echo Python Worker stopped. Press any key to close... & pause >nul)"

:: Wait for startup
timeout /t 4 >nul

:: Get Python Worker process PID
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8766 ^| findstr LISTENING') do set "PY_PID=%%a"
if defined PY_PID (
    echo Python-Worker: !PY_PID! >> "%PID_FILE%"
    echo [OK] Python Geo Worker started (PID: !PY_PID!)
) else (
    echo [INFO] Python Geo Worker is starting, please wait...
)
echo.

:: Start Electron Desktop
echo [6/6] Starting Electron Desktop...
set "ELECTRON_PATH=%ROOT_DIR%node_modules\electron\dist\electron.exe"
start "GeoWork-Desktop" /D "%ROOT_DIR%" /B cmd /c "set ELECTRON_EXEC_PATH=%ELECTRON_PATH% && node node_modules\electron-vite\dist\cli.mjs dev apps\desktop >> "%ROOT_DIR%logs\desktop.log" 2>&1 || (echo Desktop stopped. Press any key to close... & pause >nul)"

:: Wait for Electron to start
timeout /t 8 >nul

echo [OK] Electron Desktop started
echo.

:: Check service status
echo Checking service status...
timeout /t 2 >nul

curl -s http://127.0.0.1:8765/api/health >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Go Core Runtime is running normally
) else (
    echo [WARNING] Go Core Runtime may not have started correctly, check logs
)

curl -s http://127.0.0.1:8766/health >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Python Geo Worker is running normally
) else (
    echo [WARNING] Python Geo Worker may not have started correctly, check logs
)

:: Show PID file content
if exist "%PID_FILE%" (
    echo.
    echo Recorded process PIDs:
    type "%PID_FILE%"
)

echo.
echo ========================================
echo        GeoWork Startup Complete!
echo ========================================
echo.
echo Service addresses:
echo   - Go Core Runtime: http://127.0.0.1:8765
echo   - Python Geo Worker: http://127.0.0.1:8766
echo.
echo Log files:
echo   - %ROOT_DIR%logs\go-core.log
echo   - %ROOT_DIR%logs\python-worker.log
echo   - %ROOT_DIR%logs\desktop.log
echo.
echo PID file:
echo   - %PID_FILE%
echo.
echo ========================================
echo Press any key to exit this window...
pause >nul
exit /b 0
