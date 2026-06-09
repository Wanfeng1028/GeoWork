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

:: Method 1: Kill processes by window title (most reliable for start.bat launched windows)
echo [1/3] Stopping GeoWork windows by title...
echo.

:: Kill all windows with "GeoWork-" in the title
for /f "tokens=2 delims=:," %%a in ('wmic process where "name='cmd.exe' and command line like '%%GeoWork-%%'" get ProcessId /format:list ^| findstr "ProcessId"') do (
    set "pid=%%a"
    for /f "tokens=* delims= " %%p in ("!pid!") do (
        echo Stopping GeoWork process PID: !pid!...
        taskkill /PID !pid! /F >nul 2>&1
    )
)

:: Give processes time to stop
timeout /t 2 >nul
echo [OK] GeoWork windows stopped
echo.

:: Method 2: Stop by port if processes still running
:port_mode
echo [2/3] Checking ports and stopping remaining processes...
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
echo [2/2] Checking port 8766 (Python Worker)...
set "py_stopped=false"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8766 ^| findstr LISTENING') do (
    echo Found process PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Process stopped
        set "py_stopped=true"
    )
)
if "!py_stopped!"=="false" (
    echo [OK] Port 8766 is free
)
echo.

:: Clean PID file
if exist "%PID_FILE%" del "%PID_FILE%"
echo [OK] PID file cleaned
echo.

:: Verify all stopped
:check_ports
echo [3/3] Verifying all processes stopped...
echo.

set "all_clear=true"

netstat -aon | findstr :8765 | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARNING] Port 8765 still in use
    set "all_clear=false"
) else (
    echo [OK] Port 8765 released
)

netstat -aon | findstr :8766 | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARNING] Port 8766 still in use
    set "all_clear=false"
) else (
    echo [OK] Port 8766 released
)

echo.
if "!all_clear!"=="true" (
    echo ========================================
    echo        GeoWork Stopped Completely!
    echo ========================================
) else (
    echo [WARNING] Some ports still in use
    echo [HINT] Try running stop.bat again
    echo [HINT] Or check manually: netstat -aon ^| findstr "8765 8766"
)

echo.
echo ========================================
echo        Press any key to exit...
echo ========================================
pause >nul
goto :top
