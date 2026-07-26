@echo off
chcp 65001 >nul
setlocal
title Overlay Studio 本地网页编辑器
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [Overlay Studio] 未检测到 Node.js。
  echo 请安装 Node.js LTS 后重新双击此文件：
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo [Overlay Studio] 未检测到 npm，请重新安装 Node.js LTS。
  echo.
  pause
  exit /b 1
)

node "scripts\start-overlay-studio.mjs"
set "OVERLAY_EXIT_CODE=%ERRORLEVEL%"

if not "%OVERLAY_EXIT_CODE%"=="0" (
  echo.
  echo [Overlay Studio] 启动未完成，请查看上方错误信息。
  echo.
  pause
)

endlocal & exit /b %OVERLAY_EXIT_CODE%
