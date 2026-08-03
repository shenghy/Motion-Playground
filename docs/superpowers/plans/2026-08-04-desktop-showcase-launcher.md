# Desktop Showcase Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Windows 桌面创建 `展示台.bat`，双击后启动 Overlay Studio、自动打开浏览器、显示成功状态与实际端口，并在启动器退出后保留控制台窗口。

**Architecture:** 桌面 BAT 只作为稳定包装层，固定调用项目已有的 `E:\Code\Motion-playground\启动 Overlay Studio.bat`。项目启动器继续负责依赖检查、构建、端口选择、成功输出和浏览器打开；桌面包装层只负责路径检查、退出状态说明和最终 `pause`。

**Tech Stack:** Windows Batch、Node.js 项目现有本地启动器、PowerShell/HTTP 验证

---

### Task 1: 创建桌面展示台包装脚本

**Files:**
- Create: `C:\Users\Administrator\Desktop\展示台.bat`
- Reference: `E:\Code\Motion-playground\启动 Overlay Studio.bat`

- [ ] **Step 1: 验证项目启动器存在**

Run:

```powershell
Test-Path -LiteralPath "E:\Code\Motion-playground\启动 Overlay Studio.bat"
```

Expected: 输出 `True`。

- [ ] **Step 2: 创建桌面 BAT**

使用 `apply_patch` 创建以下完整内容：

```bat
@echo off
chcp 65001 >nul
setlocal
title Overlay Studio 展示台

set "PROJECT_DIR=E:\Code\Motion-playground"
set "PROJECT_LAUNCHER=%PROJECT_DIR%\启动 Overlay Studio.bat"

echo.
echo [展示台] 正在启动 Overlay Studio...
echo [展示台] 项目位置：%PROJECT_DIR%
echo.

if not exist "%PROJECT_LAUNCHER%" (
  echo [展示台] 启动失败：找不到项目启动器。
  echo [展示台] 预期位置：%PROJECT_LAUNCHER%
  set "SHOWCASE_EXIT_CODE=1"
  goto :keep_open
)

call "%PROJECT_LAUNCHER%"
set "SHOWCASE_EXIT_CODE=%ERRORLEVEL%"

echo.
if "%SHOWCASE_EXIT_CODE%"=="0" (
  echo [展示台] Overlay Studio 已正常结束。
) else (
  echo [展示台] Overlay Studio 启动或运行失败，退出码：%SHOWCASE_EXIT_CODE%
)

:keep_open
echo.
echo [展示台] 控制台将保留，请查看上方端口和启动状态。
echo [展示台] 按任意键关闭此窗口...
pause >nul

endlocal & exit /b %SHOWCASE_EXIT_CODE%
```

- [ ] **Step 3: 静态验证文件名、编码和关键行为**

Run:

```powershell
$path = "C:\Users\Administrator\Desktop\展示台.bat"
$text = Get-Content -Raw -Encoding UTF8 $path
[pscustomobject]@{
  Exists = Test-Path -LiteralPath $path
  CallsProjectLauncher = $text.Contains('call "%PROJECT_LAUNCHER%"')
  KeepsConsoleOpen = $text.Contains('pause >nul')
  FixedProjectPath = $text.Contains('E:\Code\Motion-playground')
}
```

Expected: 四个字段全部为 `True`。

### Task 2: 验证启动、端口输出和浏览器服务

**Files:**
- Test: `C:\Users\Administrator\Desktop\展示台.bat`
- Verify: `http://127.0.0.1:$port/__overlay_studio_status__`

- [ ] **Step 1: 在后台运行桌面 BAT 并捕获输出**

如果 Overlay Studio 已运行，使用现有实例路径测试，这会快速返回到 `pause`；向标准输入提供一个换行，使自动化验证能够退出：

```powershell
$output = Join-Path $env:TEMP "showcase-launcher-test.log"
cmd /c "echo.|"C:\Users\Administrator\Desktop\展示台.bat"" *> $output
Get-Content -Encoding UTF8 $output
```

Expected: 输出包含“已检测到正在运行的本地编辑器”和实际的 `http://127.0.0.1:端口/` 地址。

- [ ] **Step 2: 验证状态接口与透明 MOV 能力接口**

读取项目启动器保存的实际端口后运行：

```powershell
$port = [int](Get-Content -Raw "E:\Code\Motion-playground\.overlay-studio-port.local")
$status = Invoke-RestMethod "http://127.0.0.1:$port/__overlay_studio_status__"
$capability = Invoke-RestMethod "http://127.0.0.1:$port/__overlay_export__/capabilities"
[pscustomobject]@{
  App = $status.app
  Version = $status.version
  Mov = $capability.mov
  Resolution = "$($capability.width)x$($capability.height)"
  Fps = $capability.fps
}
```

Expected: `App=overlay-studio`、`Version=2`、`Mov=True`、`Resolution=1920x1080`、`Fps=30`。

- [ ] **Step 3: 验证控制台驻留行为**

Run:

```powershell
Select-String -LiteralPath "C:\Users\Administrator\Desktop\展示台.bat" -Pattern "pause >nul"
```

Expected: 匹配到一行，证明项目启动器返回后包装窗口必须等待按键。

- [ ] **Step 4: 提交项目内实施计划**

```powershell
git add docs/superpowers/plans/2026-08-04-desktop-showcase-launcher.md
git commit -m "docs: plan desktop showcase launcher"
```

Expected: 提交成功；桌面 BAT 本身位于项目仓库外，不加入 Git。
