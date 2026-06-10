@echo off
setlocal EnableDelayedExpansion
chcp 437 >nul
title GeoWork Stop Script

:top
echo ========================================
echo        GeoWork Stop Script
echo ========================================
echo.

:: Get script directory
set "ROOT_DIR=%~dp0"
set "PID_FILE=%ROOT_DIR%.geowork-pids"

:: Set port constants
set "GO_PORT=8765"
set "PY_PORT=8766"
set "CLOUD_PORT=8767"

:: Method: Kill processes by port (most reliable)
echo [1/2] Stopping GeoWork processes by port...
echo.

:: Stop Go Core Runtime (port 8765)
echo [1/2] Checking port 8765 (Go Core)...
set "go_stopped=false"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765 ^| findstr LISTENING') do (
    echo Found process PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Process stopped
        set "go_stopped=true"
    )
)
if "!go_stopped!"=="false" (
    echo [OK] Port 8765 is free
)
echo.

:: Stop Python Geo Worker (port 8766)
echo [2/3] Checking port 8766 (Python Worker)...
set "py_stopped=false"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :!PY_PORT! ^| findstr LISTENING') do (
    echo Found process PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Process stopped
        set "py_stopped=true"
    )
)
if "!py_stopped!"=="false" (
    echo [OK] Port !PY_PORT! is free
)
echo.

:: Stop Cloud Server (port 8767)
echo [3/3] Checking port !CLOUD_PORT! (Cloud Server)...
set "cloud_stopped=false"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :!CLOUD_PORT! ^| findstr LISTENING') do (
    echo Found process PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Process stopped
        set "cloud_stopped=true"
    )
)
if "!cloud_stopped!"=="false" (
    echo [OK] Port !CLOUD_PORT! is free
)
echo.

:: Clean PID file
if exist "%PID_FILE%" del "%PID_FILE%"
echo [OK] PID file cleaned
echo.

:: Give processes time to stop
timeout /t 2 >nul

:: Verify all stopped
:check_ports
echo [2/2] Verifying all processes stopped...
echo.

set "all_clear=true"

netstat -aon | findstr :8765 | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARNING] Port !GO_PORT! still in use
    set "all_clear=false"
) else (
    echo [OK] Port !GO_PORT! released
)

netstat -aon | findstr :!PY_PORT! | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARNING] Port !PY_PORT! still in use
    set "all_clear=false"
) else (
    echo [OK] Port !PY_PORT! released
)

netstat -aon | findstr :!CLOUD_PORT! | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARNING] Port !CLOUD_PORT! still in use
    set "all_clear=false"
) else (
    echo [OK] Port !CLOUD_PORT! released
)

echo.
if "!all_clear!"=="true" (
    echo ========================================
    echo        GeoWork Stopped Completely!
    echo ========================================
) else (
    echo [WARNING] Some ports still in use
    echo [HINT] Try running stop.bat again
    echo [HINT] Or check manually: netstat -aon ^| findstr "!GO_PORT! !PY_PORT! !CLOUD_PORT!"
)

echo.
echo ========================================
echo        Press any key to exit...
echo ========================================
pause >nul
goto :top
