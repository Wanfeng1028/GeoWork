@echo off
chcp 65001 >nul
title GeoWork 停止脚本

echo ========================================
echo        GeoWork 一键停止脚本
echo ========================================
echo.

:: 停止 Go Core Runtime (端口 8765)
echo [1/3] 停止 Go Core Runtime...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo [√] Go Core Runtime 已停止
echo.

:: 停止 Python Geo Worker (端口 8766)
echo [2/3] 停止 Python Geo Worker...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8766 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo [√] Python Geo Worker 已停止
echo.

:: 停止 Electron 桌面端
echo [3/3] 停止 Electron 桌面端...
taskkill /IM electron.exe /F >nul 2>&1
taskkill /IM geowork.exe /F >nul 2>&1
echo [√] Electron 桌面端 已停止
echo.

:: 停止所有相关进程
echo 停止所有 GeoWork 相关进程...
taskkill /FI "WINDOWTITLE eq GeoWork-Go-Core*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq GeoWork-Python-Worker*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq GeoWork-Desktop*" /F >nul 2>&1
echo [√] 所有进程已清理
echo.

:: 检查是否还有残留进程
echo 检查残留进程...
netstat -aon | findstr :8765 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [!] 警告: 端口 8765 仍被占用，请手动检查
) else (
    echo [√] 端口 8765 已释放
)

netstat -aon | findstr :8766 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [!] 警告: 端口 8766 仍被占用，请手动检查
) else (
    echo [√] 端口 8766 已释放
)

echo.
echo ========================================
echo        GeoWork 已停止！
echo ========================================
echo.
pause
