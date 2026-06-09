@echo off
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
for /f "tokens=1,2 delims=:" %%a in ('type "%PID_FILE%"') do (
    set "process_name=%%a"
    set "process_pid=%%b"
    
    :: 去除空格
    set "process_name=!process_name: =!"
    set "process_pid=!process_pid: =!"
    
    :: 检查进程是否存在
    tasklist /FI "PID eq !process_pid!" /NH 2>nul | findstr /I "!process_pid!" >nul
    if !errorlevel! equ 0 (
        echo 停止 !process_name! (PID: !process_pid!)...
        taskkill /PID !process_pid! /F >nul 2>&1
        if !errorlevel! equ 0 (
            echo [√] !process_name! 已停止
            set /a stopped_count+=1
        ) else (
            echo [!] !process_name! 停止失败
        )
    ) else (
        echo [√] !process_name! (PID: !process_pid!) 已经停止
    )
)

:: 删除 PID 文件
if exist "%PID_FILE%" del "%PID_FILE%"
echo.
echo 共停止 %stopped_count% 个进程
goto :check_ports

:port_mode
echo [信息] 通过端口检测停止进程...
echo.

:: 停止 Go Core Runtime (端口 8765)
echo [1/3] 停止 Go Core Runtime...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765 ^| findstr LISTENING') do (
    echo 找到进程 PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo [√] Go Core Runtime 已停止
    ) else (
        echo [!] Go Core Runtime 停止失败
    )
)
echo.

:: 停止 Python Geo Worker (端口 8766)
echo [2/3] 停止 Python Geo Worker...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8766 ^| findstr LISTENING') do (
    echo 找到进程 PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo [√] Python Geo Worker 已停止
    ) else (
        echo [!] Python Geo Worker 停止失败
    )
)
echo.

:: 停止 Electron 桌面端（通过窗口标题）
echo [3/3] 停止 Electron 桌面端...
taskkill /FI "WINDOWTITLE eq GeoWork-Desktop*" /F >nul 2>&1
echo [√] Electron 桌面端 停止命令已发送

:check_ports
echo.
echo ========================================
echo        检查端口释放状态
echo ========================================
echo.

:: 检查端口是否释放
set "all_clear=true"

netstat -aon | findstr :8765 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [!] 端口 8765 仍被占用
    set "all_clear=false"
) else (
    echo [√] 端口 8765 已释放
)

netstat -aon | findstr :8766 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [!] 端口 8766 仍被占用
    set "all_clear=false"
) else (
    echo [√] 端口 8766 已释放
)

if "%all_clear%"=="true" (
    echo.
    echo ========================================
    echo        GeoWork 已完全停止！
    echo ========================================
) else (
    echo.
    echo [警告] 部分端口仍被占用
    echo [提示] 可以手动检查：netstat -aon | findstr "8765 8766"
)

echo.
pause
