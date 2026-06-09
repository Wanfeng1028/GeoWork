@echo off
chcp 65001 >nul
title GeoWork 启动脚本

echo ========================================
echo        GeoWork 一键启动脚本
echo ========================================
echo.

:: 获取脚本所在目录
set "ROOT_DIR=%~dp0"

:: 检查依赖
echo [1/5] 检查依赖...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

where go >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Go，请先安装 Go
    pause
    exit /b 1
)

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Python，请先安装 Python
    pause
    exit /b 1
)

echo [√] 依赖检查通过
echo.

:: 创建日志目录
if not exist "%ROOT_DIR%logs" mkdir "%ROOT_DIR%logs"

:: 启动 Go Core Runtime
echo [2/5] 启动 Go Core Runtime (端口 8765)...
start "GeoWork-Go-Core" /D "%ROOT_DIR%core" cmd /c "go run ./cmd/geowork-runtime --port 8765 > "%ROOT_DIR%logs\go-core.log" 2>&1"
timeout /t 3 >nul
echo [√] Go Core Runtime 已启动
echo.

:: 启动 Python Geo Worker
echo [3/5] 启动 Python Geo Worker (端口 8766)...
start "GeoWork-Python-Worker" /D "%ROOT_DIR%workers\geo-python" cmd /c "python -m uvicorn app.main:app --host 127.0.0.1 --port 8766 > "%ROOT_DIR%logs\python-worker.log" 2>&1"
timeout /t 3 >nul
echo [√] Python Geo Worker 已启动
echo.

:: 启动 Electron 桌面端
echo [4/5] 启动 Electron 桌面端...
start "GeoWork-Desktop" /D "%ROOT_DIR%apps\desktop" cmd /c "npm run dev > "%ROOT_DIR%logs\desktop.log" 2>&1"
timeout /t 5 >nul
echo [√] Electron 桌面端已启动
echo.

:: 检查服务状态
echo [5/5] 检查服务状态...
timeout /t 2 >nul

curl -s http://127.0.0.1:8765/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [√] Go Core Runtime 运行正常
) else (
    echo [!] Go Core Runtime 可能未正常启动，请检查日志
)

curl -s http://127.0.0.1:8766/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [√] Python Geo Worker 运行正常
) else (
    echo [!] Python Geo Worker 可能未正常启动，请检查日志
)

echo.
echo ========================================
echo        GeoWork 启动完成！
echo ========================================
echo.
echo 服务地址：
echo   - Go Core Runtime: http://127.0.0.1:8765
echo   - Python Geo Worker: http://127.0.0.1:8766
echo.
echo 日志文件：
echo   - %ROOT_DIR%logs\go-core.log
echo   - %ROOT_DIR%logs\python-worker.log
echo   - %ROOT_DIR%logs\desktop.log
echo.
echo 按任意键退出此窗口...
pause >nul
