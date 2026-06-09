@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title GeoWork 状态检查

echo ========================================
echo        GeoWork 服务状态检查
echo ========================================
echo.

:: 获取脚本所在目录
set "ROOT_DIR=%~dp0"
set "PID_FILE=%ROOT_DIR%.geowork-pids"

:: 定义端口常量
set "GO_PORT=8765"
set "PY_PORT=8766"

:: 检查端口状态
echo [端口状态]
echo.

set "go_running=false"
set "py_running=false"

:: 检查 Go Core Runtime (端口 !GO_PORT!)
netstat -aon | findstr :!GO_PORT! | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :!GO_PORT! ^| findstr LISTENING') do set "go_pid=%%a"
    echo [√] Go Core Runtime 运行中 (端口 !GO_PORT!, PID: !go_pid!)
    set "go_running=true"
) else (
    echo [×] Go Core Runtime 未运行 (端口 !GO_PORT!)
)

:: 检查 Python Geo Worker (端口 !PY_PORT!)
netstat -aon | findstr :!PY_PORT! | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :!PY_PORT! ^| findstr LISTENING') do set "py_pid=%%a"
    echo [√] Python Geo Worker 运行中 (端口 !PY_PORT!, PID: !py_pid!)
    set "py_running=true"
) else (
    echo [×] Python Geo Worker 未运行 (端口 !PY_PORT!)
)

echo.

:: 检查 PID 文件
echo [PID 文件]
echo.

if exist "%PID_FILE%" (
    echo PID 文件存在: %PID_FILE%
    echo.
    for /f "usebackq tokens=1,2 delims=:" %%a in ("%PID_FILE%") do (
        set "process_name=%%a"
        set "process_pid=%%b"

        :: 去除前导空格
        for /f "tokens=* delims= " %%c in ("!process_name!") do set "process_name=%%c"
        for /f "tokens=* delims= " %%c in ("!process_pid!") do set "process_pid=%%c"

        :: 检查进程是否存在
        tasklist /FI "PID eq !process_pid!" /NH 2>nul | findstr /I "!process_pid!" >nul
        if !errorlevel! equ 0 (
            echo [√] !process_name! (PID: !process_pid!) 运行中
        ) else (
            echo [×] !process_name! (PID: !process_pid!) 已停止
        )
    )
) else (
    echo [×] PID 文件不存在
)

echo.

:: 检查健康状态
echo [健康检查]
echo.

:: 检查 Go Core Runtime 健康状态
if "!go_running!"=="true" (
    curl -s http://127.0.0.1:!GO_PORT!/api/health >nul 2>&1
    if !errorlevel! equ 0 (
        echo [√] Go Core Runtime 健康检查通过
    ) else (
        echo [!] Go Core Runtime 健康检查失败
    )
) else (
    echo [×] Go Core Runtime 未运行，跳过健康检查
)

:: 检查 Python Geo Worker 健康状态
if "!py_running!"=="true" (
    curl -s http://127.0.0.1:!PY_PORT!/health >nul 2>&1
    if !errorlevel! equ 0 (
        echo [√] Python Geo Worker 健康检查通过
    ) else (
        echo [!] Python Geo Worker 健康检查失败
    )
) else (
    echo [×] Python Geo Worker 未运行，跳过健康检查
)

echo.

:: 检查日志文件
echo [日志文件]
echo.

if exist "%ROOT_DIR%logs" (
    if exist "%ROOT_DIR%logs\go-core.log" (
        for %%a in ("%ROOT_DIR%logs\go-core.log") do (
            echo [√] go-core.log (%%~za bytes)
        )
    ) else (
        echo [×] go-core.log 不存在
    )

    if exist "%ROOT_DIR%logs\python-worker.log" (
        for %%a in ("%ROOT_DIR%logs\python-worker.log") do (
            echo [√] python-worker.log (%%~za bytes)
        )
    ) else (
        echo [×] python-worker.log 不存在
    )

    if exist "%ROOT_DIR%logs\desktop.log" (
        for %%a in ("%ROOT_DIR%logs\desktop.log") do (
            echo [√] desktop.log (%%~za bytes)
        )
    ) else (
        echo [×] desktop.log 不存在
    )
) else (
    echo [×] logs 目录不存在
)

echo.
echo ========================================
echo        状态检查完成
echo ========================================
echo.

:: 提供操作建议
if "!go_running!"=="true" if "!py_running!"=="true" (
    echo [√] GeoWork 服务运行正常
    echo [提示] 可以访问 http://127.0.0.1:!GO_PORT! 使用服务
) else (
    if "!go_running!"=="false" if "!py_running!"=="false" (
        echo [×] GeoWork 服务未运行
        echo [提示] 请运行 start.bat 启动服务
    ) else (
        echo [!] GeoWork 服务部分运行
        echo [提示] 请检查日志或运行 stop.bat 后重新启动
    )
)

echo.
pause
