@echo off
setlocal EnableDelayedExpansion
chcp 437 >nul
title GeoWork Stop Script

echo ========================================
echo        GeoWork Stop Script
echo ========================================
echo.

:: Get script directory
set "ROOT_DIR=%~dp0"
set "PID_FILE=%ROOT_DIR%.geowork-pids"

:: Check PID file
if not exist "%PID_FILE%" (
    echo [WARNING] PID file not found, using port detection mode
    echo [HINT] Using start.bat next time will be more precise
    echo.
    goto :port_mode
)

echo [INFO] Stopping processes precisely via PID file...
echo.

:: Read PID file and stop processes
set "stopped_count=0"
for /f "usebackq tokens=1,2 delims=:" %%a in ("%PID_FILE%") do (
    set "process_name=%%a"
    set "process_pid=%%b"
    
    :: Remove leading spaces
    for /f "tokens=* delims= " %%c in ("!process_name!") do set "process_name=%%c"
    for /f "tokens=* delims= " %%c in ("!process_pid!") do set "process_pid=%%c"
    
    :: Check if process exists
    tasklist /FI "PID eq !process_pid!" /NH 2>nul | findstr /I "!process_pid!" >nul
    if !errorlevel! equ 0 (
        echo Stopping !process_name! (PID: !process_pid!)...
        taskkill /PID !process_pid! /F >nul 2>&1
        if !errorlevel! equ 0 (
            echo [OK] !process_name! stopped
            set /a stopped_count+=1
        ) else (
            echo [FAILED] !process_name! stop failed
        )
    ) else (
        echo [OK] !process_name! (PID: !process_pid!) already stopped
    )
)

:: Delete PID file
if exist "%PID_FILE%" del "%PID_FILE%"
echo.
echo Total stopped: !stopped_count! processes
goto :check_ports

:port_mode
echo [INFO] Stopping processes via port detection...
echo [WARNING] This mode only stops processes listening on specified ports
echo.

:: Stop Go Core Runtime (port 8765)
echo [1/2] Stopping Go Core Runtime (port 8765)...
set "go_stopped=false"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765 ^| findstr LISTENING') do (
    echo Found process PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Go Core Runtime stopped
        set "go_stopped=true"
    ) else (
        echo [FAILED] Go Core Runtime stop failed
    )
)
if "!go_stopped!"=="false" (
    echo [OK] Go Core Runtime not running or already stopped
)
echo.

:: Stop Python Geo Worker (port 8766)
echo [2/2] Stopping Python Geo Worker (port 8766)...
set "py_stopped=false"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8766 ^| findstr LISTENING') do (
    echo Found process PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Python Geo Worker stopped
        set "py_stopped=true"
    ) else (
        echo [FAILED] Python Geo Worker stop failed
    )
)
if "!py_stopped!"=="false" (
    echo [OK] Python Geo Worker not running or already stopped
)
echo.

:: Prompt user to close Electron window manually
echo [HINT] Electron Desktop window needs to be closed manually
echo [HINT] Please close GeoWork Desktop window (if open)

:check_ports
echo.
echo ========================================
echo        Checking port release status
echo ========================================
echo.

:: Check if ports are released
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

if "!all_clear!"=="true" (
    echo.
    echo ========================================
    echo        GeoWork Stopped Completely!
    echo ========================================
) else (
    echo.
    echo [WARNING] Some ports still in use
    echo [HINT] Check manually: netstat -aon ^| findstr "8765 8766"
    echo [HINT] Or run status.bat for detailed status
)

echo.
pause
