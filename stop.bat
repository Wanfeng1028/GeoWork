@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title GeoWork 停止脚本

echo ========================================
echo        GeoWork 一键停止脚本
echo ========================================
echo.

:: 获取脚本所在目录
set "ROOT_DIR=%~dp0"
set "PID_FILE=%ROOT_DIR%.geowork-pids"

:: 检查 PID 文件
if not exist "%PID_FILE%" (
    echo [警告] 未找到 PID 文件，将使用端口检测模式
    echo [提示] 下次使用 start.bat 启动会更精确
    echo.
    goto :port_mode
)

echo [信息] 通过 PID 文件精确停止进程...
echo.

:: 读取 PID 文件并停止进程
set "stopped_count=0"
for /f "usebackq tokens=1,2 delims=:" %%a in ("%PID_FILE%") do (
    set "process_name=%%a"
    set "process_pid=%%b"
    
    :: 去除前导空格
    for /f "tokens=* delims= " %%c in ("!process_name!") do set "process_name=%%c"
    for /f "tokens=* delims= " %%c in ("!process_pid!") do set "process_pid=%%c"
    
    :: 检查进程是否存在
    tasklist /FI "PID eq !process_pid!" /NH 2>nul | findstr /I "!process_pid!" >nul
    if !errorlevel! equ 0 (
        echo 停止 !process_name! ^(PID: !process_pid!^)...
        taskkill /PID !process_pid! /F >nul 2>&1
        if !errorlevel! equ 0 (
            echo [√] !process_name! 已停止
            set /a stopped_count+=1
        ) else (
            echo [!] !process_name! 停止失败
        )
    ) else (
        echo [√] !process_name! ^(PID: !process_pid!^) 已经停止
    )
)

:: 删除 PID 文件
if exist "%PID_FILE%" del "%PID_FILE%"
echo.
echo 共停止 !stopped_count! 个进程
goto :check_ports

:port_mode
echo [信息] 通过端口检测停止进程...
echo.

:: 停止 Go Core Runtime (端口 8765)
echo [1/3] 停止 Go Core Runtime...
set "go_stopped=false"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765 ^| findstr LISTENING') do (
    echo 找到进程 PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo [√] Go Core Runtime 已停止
        set "go_stopped=true"
    ) else (
        echo [!] Go Core Runtime 停止失败
    )
)
if "!go_stopped!"=="false" (
    echo [√] Go Core Runtime 未运行或已停止
)
echo.

:: 停止 Python Geo Worker (端口 8766)
echo [2/3] 停止 Python Geo Worker...
set "py_stopped=false"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8766 ^| findstr LISTENING') do (
    echo 找到进程 PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo [√] Python Geo Worker 已停止
        set "py_stopped=true"
    ) else (
        echo [!] Python Geo Worker 停止失败
    )
)
if "!py_stopped!"=="false" (
    echo [√] Python Geo Worker 未运行或已停止
)
echo.

:: 停止 Electron 桌面端
echo [3/3] 停止 Electron 桌面端...
set "electron_stopped=false"

:: 通过进程名查找并停止 Electron 相关进程
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq electron.exe" /NH 2^>nul ^| findstr /I "electron"') do (
    echo 找到 Electron 进程 PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo [√] Electron 进程已停止
        set "electron_stopped=true"
    )
)

:: 通过进程名查找并停止 Node.js 相关进程（npm run dev 启动的）
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /NH 2^>nul ^| findstr /I "node"') do (
    echo 找到 Node.js 进程 PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo [√] Node.js 进程已停止
        set "electron_stopped=true"
    )
)

if "!electron_stopped!"=="false" (
    echo [√] Electron 桌面端未运行或已停止
)

:check_ports
echo.
echo ========================================
echo        检查端口释放状态
echo ========================================
echo.

:: 检查端口是否释放
set "all_clear=true"

netstat -aon | findstr :8765 | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [!] 端口 8765 仍被占用
    set "all_clear=false"
) else (
    echo [√] 端口 8765 已释放
)

netstat -aon | findstr :8766 | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [!] 端口 8766 仍被占用
    set "all_clear=false"
) else (
    echo [√] 端口 8766 已释放
)

if "!all_clear!"=="true" (
    echo.
    echo ========================================
    echo        GeoWork 已完全停止！
    echo ========================================
) else (
    echo.
    echo [警告] 部分端口仍被占用
    echo [提示] 可以手动检查：netstat -aon ^| findstr "8765 8766"
    echo [提示] 或者使用：tasklist /FI "IMAGENAME eq node.exe"
)

echo.
pause
