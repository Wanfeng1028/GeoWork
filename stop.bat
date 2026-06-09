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

:: 定义端口常量
set "GO_PORT=8765"
set "PY_PORT=8766"

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
echo [警告] 此模式只停止监听指定端口的进程，不会误杀其他应用
echo.

:: 停止 Go Core Runtime (端口 !GO_PORT!)
echo [1/2] 停止 Go Core Runtime (端口 !GO_PORT!)...
set "go_stopped=false"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :!GO_PORT! ^| findstr LISTENING') do (
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

:: 停止 Python Geo Worker (端口 !PY_PORT!)
echo [2/2] 停止 Python Geo Worker (端口 !PY_PORT!)...
set "py_stopped=false"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :!PY_PORT! ^| findstr LISTENING') do (
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

:: 提示用户手动关闭 Electron 窗口
echo [提示] Electron 桌面端窗口需要手动关闭
echo [提示] 请关闭 GeoWork 桌面窗口（如果已打开）

:check_ports
echo.
echo ========================================
echo        检查端口释放状态
echo ========================================
echo.

:: 检查端口是否释放
set "all_clear=true"

netstat -aon | findstr :!GO_PORT! | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [!] 端口 !GO_PORT! 仍被占用
    set "all_clear=false"
) else (
    echo [√] 端口 !GO_PORT! 已释放
)

netstat -aon | findstr :!PY_PORT! | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [!] 端口 !PY_PORT! 仍被占用
    set "all_clear=false"
) else (
    echo [√] 端口 !PY_PORT! 已释放
)

if "!all_clear!"=="true" (
    echo.
    echo ========================================
    echo        GeoWork 已完全停止！
    echo ========================================
) else (
    echo.
    echo [警告] 部分端口仍被占用
    echo [提示] 可以手动检查：netstat -aon ^| findstr "!GO_PORT! !PY_PORT!"
    echo [提示] 或者运行 status.bat 查看详细状态
)

echo.
pause
