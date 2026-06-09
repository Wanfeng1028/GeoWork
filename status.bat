@echo off
setlocal EnableDelayedExpansion
chcp 437 >nul
title GeoWork Status Check

:top
echo ========================================
echo        GeoWork Service Status Check
echo ========================================
echo.

:: Get script directory
set "ROOT_DIR=%~dp0"
set "PID_FILE=%ROOT_DIR%.geowork-pids"

:: Check port status
echo [Port Status]
echo.

set "go_running=false"
set "py_running=false"

:: Check Go Core Runtime (port 8765)
netstat -aon | findstr :8765 | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765 ^| findstr LISTENING') do set "go_pid=%%a"
    echo [OK] Go Core Runtime running (port 8765, PID: !go_pid!)
    set "go_running=true"
) else (
    echo [MISSING] Go Core Runtime not running (port 8765)
)

:: Check Python Geo Worker (port 8766)
netstat -aon | findstr :8766 | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8766 ^| findstr LISTENING') do set "py_pid=%%a"
    echo [OK] Python Geo Worker running (port 8766, PID: !py_pid!)
    set "py_running=true"
) else (
    echo [MISSING] Python Geo Worker not running (port 8766)
)

echo.

:: Check GeoWork windows
echo [GeoWork Windows]
echo.

:: Check for GeoWork windows
wmic process where "name='cmd.exe' and command line like '%%GeoWork-%%'" get ProcessId,CommandLine /format:list >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] GeoWork windows found:
    for /f "tokens=2 delims=:," %%a in ('wmic process where "name='cmd.exe' and command line like '%%GeoWork-%%'" get ProcessId /format:list ^| findstr "ProcessId"') do (
        set "pid=%%a"
        for /f "tokens=* delims= " %%p in ("!pid!") do (
            echo   - PID: !pid!
        )
    )
) else (
    echo [MISSING] No GeoWork windows running
)

echo.

:: Check PID file
echo [PID File]
echo.

if exist "%PID_FILE%" (
    echo [OK] PID file exists: %PID_FILE%
    echo.
    type "%PID_FILE%"
) else (
    echo [MISSING] PID file does not exist
)

echo.

:: Check health status
echo [Health Check]
echo.

:: Check Go Core Runtime health status
if "!go_running!"=="true" (
    curl -s http://127.0.0.1:8765/api/health >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Go Core Runtime health check passed
    ) else (
        echo [WARNING] Go Core Runtime health check failed
    )
) else (
    echo [MISSING] Go Core Runtime not running, skipping health check
)

:: Check Python Geo Worker health status
if "!py_running!"=="true" (
    curl -s http://127.0.0.1:8766/health >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Python Geo Worker health check passed
    ) else (
        echo [WARNING] Python Geo Worker health check failed
    )
) else (
    echo [MISSING] Python Geo Worker not running, skipping health check
)

echo.

:: Check log files
echo [Log Files]
echo.

if exist "%ROOT_DIR%logs" (
    if exist "%ROOT_DIR%logs\go-core.log" (
        for %%a in ("%ROOT_DIR%logs\go-core.log") do (
            echo [OK] go-core.log (%%~za bytes)
        )
    ) else (
        echo [MISSING] go-core.log does not exist
    )
    
    if exist "%ROOT_DIR%logs\python-worker.log" (
        for %%a in ("%ROOT_DIR%logs\python-worker.log") do (
            echo [OK] python-worker.log (%%~za bytes)
        )
    ) else (
        echo [MISSING] python-worker.log does not exist
    )
    
    if exist "%ROOT_DIR%logs\desktop.log" (
        for %%a in ("%ROOT_DIR%logs\desktop.log") do (
            echo [OK] desktop.log (%%~za bytes)
        )
    ) else (
        echo [MISSING] desktop.log does not exist
    )
) else (
    echo [MISSING] logs directory does not exist
)

echo.
echo ========================================
echo        Status Check Complete
echo ========================================
echo.

:: Provide operation suggestions
if "!go_running!"=="true" if "!py_running!"=="true" (
    echo [OK] GeoWork services running normally
    echo [HINT] Access http://127.0.0.1:8765 to use services
) else (
    if "!go_running!"=="false" if "!py_running!"=="false" (
        echo [MISSING] GeoWork services not running
        echo [HINT] Run start.bat to start services
    ) else (
        echo [WARNING] GeoWork services partially running
        echo [HINT] Check logs or run stop.bat then restart
    )
)

echo.
echo ========================================
echo        Press any key to check again...
echo ========================================
pause >nul
goto :top
