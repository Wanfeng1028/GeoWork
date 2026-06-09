@echo off
chcp 65001 >nul
title GeoWork 启动脚本

echo ========================================
echo        GeoWork 一键启动脚本
echo ========================================
echo.

:: 获取脚本所在目录
set "ROOT_DIR=%~dp0"
set "PID_FILE=%ROOT_DIR%.geowork-pids"

:: 检查依赖
echo [1/6] 检查依赖...
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

where uvicorn >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] 未找到 uvicorn，将使用 python -m uvicorn 启动
)
echo [√] 基础依赖检查通过
echo.

:: 检查 Electron 依赖
echo [2/6] 检查 Electron 依赖...
if not exist "%ROOT_DIR%apps\desktop\node_modules\.package-lock.json" (
    echo [提示] 首次运行，需要安装前端依赖...
    cd /d "%ROOT_DIR%apps\desktop"
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 前端依赖安装失败
        pause
        exit /b 1
    )
)
echo [√] Electron 依赖检查通过
echo.

:: 清理旧的 PID 文件
if exist "%PID_FILE%" del "%PID_FILE%"

:: 创建日志目录
if not exist "%ROOT_DIR%logs" mkdir "%ROOT_DIR%logs"

:: 启动 Go Core Runtime
echo [3/6] 启动 Go Core Runtime (端口 8765)...
start "GeoWork-Go-Core" /D "%ROOT_DIR%core" cmd /c "go run ./cmd/geowork-runtime --port 8765 > "%ROOT_DIR%logs\go-core.log" 2>&1"

:: 等待并获取 Go Core 进程 PID
timeout /t 2 >nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765 ^| findstr LISTENING') do (
    set "GO_PID=%%a"
)
if defined GO_PID (
    echo Go-Core: %GO_PID% >> "%PID_FILE%"
    echo [√] Go Core Runtime 已启动 (PID: %GO_PID%)
) else (
    echo [!] Go Core Runtime 启动中，请稍候...
)
echo.

:: 启动 Python Geo Worker
echo [4/6] 启动 Python Geo Worker (端口 8766)...
start "GeoWork-Python-Worker" /D "%ROOT_DIR%workers\geo-python" cmd /c "python -m uvicorn app.main:app --host 127.0.0.1 --port 8766 > "%ROOT_DIR%logs\python-worker.log" 2>&1"

:: 等待并获取 Python Worker 进程 PID
timeout /t 2 >nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8766 ^| findstr LISTENING') do (
    set "PY_PID=%%a"
)
if defined PY_PID (
    echo Python-Worker: %PY_PID% >> "%PID_FILE%"
    echo [√] Python Geo Worker 已启动 (PID: %PY_PID%)
) else (
    echo [!] Python Geo Worker 启动中，请稍候...
)
echo.

:: 启动 Electron 桌面端
echo [5/6] 启动 Electron 桌面端...
start "GeoWork-Desktop" /D "%ROOT_DIR%apps\desktop" cmd /c "npm run dev > "%ROOT_DIR%logs\desktop.log" 2>&1"

:: 等待 Electron 启动
timeout /t 3 >nul

:: 获取 Electron 相关进程 PID
for /f "tokens=2" %%a in ('tasklist /FI "WINDOWTITLE eq GeoWork-Desktop*" /NH 2^>nul ^| findstr /I "cmd.exe"') do (
    set "ELECTRON_CMD_PID=%%a"
)
if defined ELECTRON_CMD_PID (
    echo Electron-CMD: %ELECTRON_CMD_PID% >> "%PID_FILE%"
    echo [√] Electron 桌面端已启动 (CMD PID: %ELECTRON_CMD_PID%)
) else (
    echo [!] Electron 桌面端启动中，请稍候...
)
echo.

:: 检查服务状态
echo [6/6] 检查服务状态...
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

:: 显示 PID 文件内容
if exist "%PID_FILE%" (
    echo.
    echo 已记录进程 PID：
    type "%PID_FILE%"
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
echo PID 文件：
echo   - %PID_FILE%
echo.
echo 按任意键退出此窗口...
pause >nul
