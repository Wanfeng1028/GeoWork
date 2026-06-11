@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo ========================================
echo        GeoWork One-Click Startup Script
echo ========================================
echo.

:: Get script directory
set "ROOT_DIR=%~dp0"
set "PID_FILE=%ROOT_DIR%.geowork-pids"

:: Define port constants
set "GO_PORT=8765"
set "PY_PORT=8766"
set "CLOUD_PORT=8767"

:: Set Electron path
set "ELECTRON_PATH=%ROOT_DIR%node_modules\electron\dist\electron.exe"

:: Check dependencies
echo [Step 1/8] Checking dependencies...
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

:: Check if Electron exists
if not exist "!ELECTRON_PATH!" (
    echo [ERROR] Electron not found, please run: npm install
    pause
    exit /b 1
)
echo [OK] Basic dependencies check passed
echo.

:: Check Go dependencies
echo [Step 2/8] Checking Go dependencies...
if not exist "%ROOT_DIR%core\go.sum" (
    echo [INFO] First run, downloading Go dependencies...
    cd /d "%ROOT_DIR%core"
    call go mod download
    if !errorlevel! neq 0 (
        echo [ERROR] Go dependency download failed
        pause
        exit /b 1
    )
    cd /d "%ROOT_DIR%"
)
echo [OK] Go dependencies check passed
echo.

:: Check Python dependencies
echo [Step 3/8] Checking Python dependencies...
if not exist "%ROOT_DIR%workers\geo-python\requirements.txt" (
    echo [WARN] requirements.txt not found, skipping Python dependency check
) else (
    pip show uvicorn >nul 2>&1
    if !errorlevel! neq 0 (
        echo [INFO] Installing Python dependencies...
        cd /d "%ROOT_DIR%workers\geo-python"
        pip install -r requirements.txt
        if !errorlevel! neq 0 (
            echo [WARN] Python dependency installation failed, may need manual installation
        )
        cd /d "%ROOT_DIR%"
    )
)
echo [OK] Python dependencies check passed
echo.

:: Check Electron dependencies
echo [Step 4/8] Checking Electron dependencies...
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
echo [OK] Electron dependencies check passed
echo.

:: Check if ports are in use
echo [Step 5/8] Checking port availability...
set "port_clear=true"

netstat -aon | findstr :!GO_PORT! | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARN] Port !GO_PORT! is already in use
    set "port_clear=false"
) else (
    echo [OK] Port !GO_PORT! is available
)

netstat -aon | findstr :!PY_PORT! | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARN] Port !PY_PORT! is already in use
    set "port_clear=false"
) else (
    echo [OK] Port !PY_PORT! is available
)

netstat -aon | findstr :!CLOUD_PORT! | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARN] Port !CLOUD_PORT! is already in use
    set "port_clear=false"
) else (
    echo [OK] Port !CLOUD_PORT! is available
)

if "!port_clear!"=="false" (
    echo.
    echo [WARN] Some ports are already in use. Continue?
    echo [INFO] If these are old GeoWork processes, consider running stop.bat first
    echo.
    choice /c YN /m "Continue startup? (Y/N)"
    if !errorlevel! equ 2 (
        echo Startup cancelled
        pause
        exit /b 0
    )
)
echo.

:: Clean up old PID file
if exist "%PID_FILE%" del "%PID_FILE%"

:: Create logs directory
if not exist "%ROOT_DIR%logs" mkdir "%ROOT_DIR%logs"

:: Start Go Core Runtime
echo [Step 6/8] Starting Go Core Runtime (port !GO_PORT!)...
start "GeoWork-Go-Core" /D "%ROOT_DIR%core" cmd /c "go run ./cmd/geowork-runtime --port !GO_PORT! > "%ROOT_DIR%logs\go-core.log" 2>&1"

:: Wait for startup
timeout /t 3 >nul

:: Get Go Core process PID
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :!GO_PORT! ^| findstr LISTENING') do set "GO_PID=%%a"
if defined GO_PID (
    echo Go-Core: !GO_PID! >> "%PID_FILE%"
    echo [OK] Go Core Runtime started (PID: !GO_PID!)
) else (
    echo [INFO] Go Core Runtime is starting, please wait...
    echo [INFO] If startup fails, check log: %ROOT_DIR%logs\go-core.log
)
echo.

:: Start Python Geo Worker
echo [Step 7/8] Starting Python Geo Worker (port !PY_PORT!)...
start "GeoWork-Python-Worker" /D "%ROOT_DIR%workers\geo-python" cmd /c "python -m uvicorn app.main:app --host 127.0.0.1 --port !PY_PORT! > "%ROOT_DIR%logs\python-worker.log" 2>&1"

:: Wait for startup
timeout /t 3 >nul

:: Get Python Worker process PID
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :!PY_PORT! ^| findstr LISTENING') do set "PY_PID=%%a"
if defined PY_PID (
    echo Python-Worker: !PY_PID! >> "%PID_FILE%"
    echo [OK] Python Geo Worker started (PID: !PY_PID!)
) else (
    echo [INFO] Python Geo Worker is starting, please wait...
    echo [INFO] If startup fails, check log: %ROOT_DIR%logs\python-worker.log
)
echo.

:: Start Cloud Server
echo [Step 8/8] Starting Cloud Server (port !CLOUD_PORT!)...
start "GeoWork-Cloud-Server" /D "%ROOT_DIR%server" cmd /c "go run ./cmd/geowork-api > "%ROOT_DIR%logs\cloud-server.log" 2>&1"

:: Wait for startup
timeout /t 3 >nul

:: Get Cloud Server process PID
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :!CLOUD_PORT! ^| findstr LISTENING') do set "CLOUD_PID=%%a"
if defined CLOUD_PID (
    echo Cloud-Server: !CLOUD_PID! >> "%PID_FILE%"
    echo [OK] Cloud Server started (PID: !CLOUD_PID!)
) else (
    echo [INFO] Cloud Server is starting, please wait...
    echo [INFO] If startup fails, check log: %ROOT_DIR%logs\cloud-server.log
)
echo.

:: Start Electron desktop app
echo Starting Electron desktop app...
start "GeoWork-Desktop" /D "%ROOT_DIR%" cmd /c "set ELECTRON_EXEC_PATH=!ELECTRON_PATH! && npm --workspace apps/desktop run dev > "%ROOT_DIR%logs\desktop.log" 2>&1"

:: Wait for Electron startup
timeout /t 8 >nul

echo [OK] Electron desktop app started
echo [INFO] If desktop app did not open automatically, check log: %ROOT_DIR%logs\desktop.log
echo.

:: Check service status
echo Checking service status...
timeout /t 2 >nul

curl -s http://127.0.0.1:!GO_PORT!/api/health >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Go Core Runtime is running normally
) else (
    echo [WARN] Go Core Runtime may not have started correctly, check log
    echo [INFO] Log location: %ROOT_DIR%logs\go-core.log
)

curl -s http://127.0.0.1:!PY_PORT!/health >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Python Geo Worker is running normally
) else (
    echo [WARN] Python Geo Worker may not have started correctly, check log
    echo [INFO] Log location: %ROOT_DIR%logs\python-worker.log
)

curl -s http://127.0.0.1:!CLOUD_PORT!/api/health >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Cloud Server is running normally
) else (
    echo [WARN] Cloud Server may not have started correctly, check log
    echo [INFO] Log location: %ROOT_DIR%logs\cloud-server.log
)

:: Show PID file content
if exist "%PID_FILE%" (
    echo.
    echo Process PIDs recorded:
    type "%PID_FILE%"
)

echo.
echo ========================================
echo        GeoWork Startup Complete!
echo ========================================
echo.
echo Service addresses:
echo   - Go Core Runtime: http://127.0.0.1:!GO_PORT!
echo   - Python Geo Worker: http://127.0.0.1:!PY_PORT!
echo.
echo Log files:
echo   - %ROOT_DIR%logs\go-core.log
echo   - %ROOT_DIR%logs\python-worker.log
echo   - %ROOT_DIR%logs\desktop.log
echo.
echo PID file:
echo   - %PID_FILE%
echo.
echo Press any key to exit this window...
pause >nul
