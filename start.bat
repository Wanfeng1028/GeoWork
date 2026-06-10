@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title GeoWork 启动脚本

echo ========================================
echo        GeoWork 一键启动脚本
echo ========================================
echo.

:: 获取脚本所在目录
set "ROOT_DIR=%~dp0"
set "PID_FILE=%ROOT_DIR%.geowork-pids"

:: 定义端口常量
set "GO_PORT=8765"
set "PY_PORT=8766"
set "CLOUD_PORT=8767"

:: 设置 Electron 路径
set "ELECTRON_PATH=%ROOT_DIR%node_modules\electron\dist\electron.exe"

:: 检查依赖
echo [1/7] 检查依赖...
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

where go >nul 2>&1
if !errorlevel! neq 0 (
    echo [错误] 未找到 Go，请先安装 Go
    pause
    exit /b 1
)

where python >nul 2>&1
if !errorlevel! neq 0 (
    echo [错误] 未找到 Python，请先安装 Python
    pause
    exit /b 1
)

:: 检查 Electron 是否存在
if not exist "!ELECTRON_PATH!" (
    echo [错误] 未找到 Electron，请先安装依赖: npm install
    pause
    exit /b 1
)
echo [√] 基础依赖检查通过
echo.

:: 检查 Go 依赖
echo [2/7] 检查 Go 依赖...
if not exist "%ROOT_DIR%core\go.sum" (
    echo [提示] 首次运行，需要下载 Go 依赖...
    cd /d "%ROOT_DIR%core"
    call go mod download
    if !errorlevel! neq 0 (
        echo [错误] Go 依赖下载失败
        pause
        exit /b 1
    )
    cd /d "%ROOT_DIR%"
)
echo [√] Go 依赖检查通过
echo.

:: 检查 Python 依赖
echo [3/7] 检查 Python 依赖...
if not exist "%ROOT_DIR%workers\geo-python\requirements.txt" (
    echo [警告] 未找到 requirements.txt，跳过 Python 依赖检查
) else (
    pip show uvicorn >nul 2>&1
    if !errorlevel! neq 0 (
        echo [提示] 安装 Python 依赖...
        cd /d "%ROOT_DIR%workers\geo-python"
        pip install -r requirements.txt
        if !errorlevel! neq 0 (
            echo [警告] Python 依赖安装失败，可能需要手动安装
        )
        cd /d "%ROOT_DIR%"
    )
)
echo [√] Python 依赖检查通过
echo.

:: 检查 Electron 依赖
echo [4/7] 检查 Electron 依赖...
if not exist "%ROOT_DIR%apps\desktop\node_modules\.package-lock.json" (
    echo [提示] 首次运行，需要安装前端依赖...
    cd /d "%ROOT_DIR%apps\desktop"
    call npm install
    if !errorlevel! neq 0 (
        echo [错误] 前端依赖安装失败
        pause
        exit /b 1
    )
    cd /d "%ROOT_DIR%"
)
echo [√] Electron 依赖检查通过
echo.

:: 检查端口是否被占用
echo [5/8] 检查端口占用...
set "port_clear=true"

netstat -aon | findstr :!GO_PORT! | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [!] 端口 !GO_PORT! 已被占用
    set "port_clear=false"
) else (
    echo [√] 端口 !GO_PORT! 可用
)

netstat -aon | findstr :!PY_PORT! | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [!] 端口 !PY_PORT! 已被占用
    set "port_clear=false"
) else (
    echo [√] 端口 !PY_PORT! 可用
)

netstat -aon | findstr :!CLOUD_PORT! | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [!] 端口 !CLOUD_PORT! 已被占用
    set "port_clear=false"
) else (
    echo [√] 端口 !CLOUD_PORT! 可用
)

if "!port_clear!"=="false" (
    echo.
    echo [警告] 部分端口已被占用，是否继续？
    echo [提示] 如果这些是 GeoWork 旧进程，建议先运行 stop.bat
    echo.
    choice /c YN /m "继续启动？(Y/N)"
    if !errorlevel! equ 2 (
        echo 已取消启动
        pause
        exit /b 0
    )
)
echo.

:: 清理旧的 PID 文件
if exist "%PID_FILE%" del "%PID_FILE%"

:: 创建日志目录
if not exist "%ROOT_DIR%logs" mkdir "%ROOT_DIR%logs"

:: 启动 Go Core Runtime
echo [6/8] 启动 Go Core Runtime (端口 !GO_PORT!)...
start "GeoWork-Go-Core" /D "%ROOT_DIR%core" cmd /c "go run ./cmd/geowork-runtime --port !GO_PORT! > "%ROOT_DIR%logs\go-core.log" 2>&1"

:: 等待启动
timeout /t 3 >nul

:: 获取 Go Core 进程 PID（单行设置变量避免 for 循环作用域问题）
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :!GO_PORT! ^| findstr LISTENING') do set "GO_PID=%%a"
if defined GO_PID (
    echo Go-Core: !GO_PID! >> "%PID_FILE%"
    echo [√] Go Core Runtime 已启动 (PID: !GO_PID!)
) else (
    echo [!] Go Core Runtime 启动中，请稍候...
    echo [提示] 如果启动失败，请检查日志: %ROOT_DIR%logs\go-core.log
)
echo.

:: 启动 Python Geo Worker
echo [7/8] 启动 Python Geo Worker (端口 !PY_PORT!)...
start "GeoWork-Python-Worker" /D "%ROOT_DIR%workers\geo-python" cmd /c "python -m uvicorn app.main:app --host 127.0.0.1 --port !PY_PORT! > "%ROOT_DIR%logs\python-worker.log" 2>&1"

:: 等待启动
timeout /t 3 >nul

:: 获取 Python Worker 进程 PID（单行设置变量避免 for 循环作用域问题）
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :!PY_PORT! ^| findstr LISTENING') do set "PY_PID=%%a"
if defined PY_PID (
    echo Python-Worker: !PY_PID! >> "%PID_FILE%"
    echo [√] Python Geo Worker 已启动 (PID: !PY_PID!)
) else (
    echo [!] Python Geo Worker 启动中，请稍候...
    echo [提示] 如果启动失败，请检查日志: %ROOT_DIR%logs\python-worker.log
)
echo.

:: 启动 Cloud Server (v0.4.0)
echo [8/8] 启动 Cloud Server (端口 !CLOUD_PORT!)...
start "GeoWork-Cloud-Server" /D "%ROOT_DIR%server" cmd /c "go run ./cmd/geowork-api > "%ROOT_DIR%logs\cloud-server.log" 2>&1"

:: 等待启动
timeout /t 3 >nul

:: 获取 Cloud Server 进程 PID
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :!CLOUD_PORT! ^| findstr LISTENING') do set "CLOUD_PID=%%a"
if defined CLOUD_PID (
    echo Cloud-Server: !CLOUD_PID! >> "%PID_FILE%"
    echo [√] Cloud Server 已启动 (PID: !CLOUD_PID!)
) else (
    echo [!] Cloud Server 启动中，请稍候...
    echo [提示] 如果启动失败，请检查日志: %ROOT_DIR%logs\cloud-server.log
)
echo.

:: 启动 Electron 桌面端（使用 ELECTRON_EXEC_PATH 环境变量）
echo 启动 Electron 桌面端...
start "GeoWork-Desktop" /D "%ROOT_DIR%" cmd /c "set ELECTRON_EXEC_PATH=!ELECTRON_PATH! && npm --workspace apps/desktop run dev > "%ROOT_DIR%logs\desktop.log" 2>&1"

:: 等待 Electron 启动
timeout /t 8 >nul

echo [√] Electron 桌面端已启动
echo [提示] 如果桌面端未自动打开，请检查日志: %ROOT_DIR%logs\desktop.log
echo.

:: 检查服务状态
echo 检查服务状态...
timeout /t 2 >nul

curl -s http://127.0.0.1:!GO_PORT!/api/health >nul 2>&1
if !errorlevel! equ 0 (
    echo [√] Go Core Runtime 运行正常
) else (
    echo [!] Go Core Runtime 可能未正常启动，请检查日志
    echo [提示] 日志位置: %ROOT_DIR%logs\go-core.log
)

curl -s http://127.0.0.1:!PY_PORT!/health >nul 2>&1
if !errorlevel! equ 0 (
    echo [√] Python Geo Worker 运行正常
) else (
    echo [!] Python Geo Worker 可能未正常启动，请检查日志
    echo [提示] 日志位置: %ROOT_DIR%logs\python-worker.log
)

curl -s http://127.0.0.1:!CLOUD_PORT!/api/health >nul 2>&1
if !errorlevel! equ 0 (
    echo [√] Cloud Server 运行正常
) else (
    echo [!] Cloud Server 可能未正常启动，请检查日志
    echo [提示] 日志位置: %ROOT_DIR%logs\cloud-server.log
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
echo   - Go Core Runtime: http://127.0.0.1:!GO_PORT!
echo   - Python Geo Worker: http://127.0.0.1:!PY_PORT!
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
