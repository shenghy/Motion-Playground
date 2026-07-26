# Overlay Studio Local Web Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Windows and macOS double-click launchers that build Overlay Studio, serve it on an available localhost port, and open the default browser.

**Architecture:** Keep the React/Vite application unchanged. A small Node module serves `dist` and owns safe static-file routing; a separate launcher module checks the environment, runs install/build commands, selects a port, starts the server, and opens the browser. Thin `.bat` and `.command` wrappers provide double-click entry points.

**Tech Stack:** Node.js built-in `http`, `net`, `fs`, `path`, `child_process`; Vite production build; Vitest; Windows batch; POSIX shell.

---

## File Structure

- Create `scripts/local-server.mjs`: localhost-only static server, MIME mapping, SPA fallback, safe path resolution, and available-port selection.
- Create `scripts/local-server.test.mjs`: real HTTP and port-selection tests.
- Create `scripts/start-overlay-studio.mjs`: dependency/build orchestration, server startup, browser opening, and Chinese terminal messages.
- Create `scripts/start-overlay-studio.test.mjs`: launcher helper and failure-message tests without opening a real browser.
- Create `启动 Overlay Studio.bat`: Windows double-click wrapper.
- Create `启动 Overlay Studio.command`: macOS double-click wrapper.
- Create `本地启动说明.md`: short user-facing startup and troubleshooting guide.
- Modify `package.json`: add `start:local` and focused launcher-test scripts.

### Task 1: Local Static Server

**Files:**
- Create: `scripts/local-server.test.mjs`
- Create: `scripts/local-server.mjs`

- [ ] **Step 1: Write failing server tests**

Create tests that import the wished-for API:

```js
import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createLocalStaticServer,
  findAvailablePort,
  getContentType,
} from './local-server.mjs'

describe('local static server', () => {
  it('falls back when the preferred port is occupied', async () => {
    const blocker = createServer()
    await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve))
    const occupied = blocker.address().port
    expect(await findAvailablePort('127.0.0.1', occupied, occupied + 2))
      .toBe(occupied + 1)
    await new Promise((resolve) => blocker.close(resolve))
  })

  it('serves assets with MIME types and falls back to index.html', async () => {
    const root = await mkdtemp(join(tmpdir(), 'overlay-server-'))
    await writeFile(join(root, 'index.html'), '<main>Overlay Studio</main>')
    await writeFile(join(root, 'app.js'), 'globalThis.overlay = true')
    const port = await findAvailablePort()
    const local = await createLocalStaticServer({ rootDirectory: root, port })

    const asset = await fetch(`${local.url}/app.js`)
    expect(asset.headers.get('content-type')).toContain('javascript')
    const route = await fetch(`${local.url}/editor`)
    expect(await route.text()).toContain('Overlay Studio')

    await local.close()
    await rm(root, { recursive: true, force: true })
  })

  it('does not expose files outside dist', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'overlay-server-'))
    const root = join(parent, 'dist')
    await mkdir(root)
    await writeFile(join(root, 'index.html'), '<main>Overlay Studio</main>')
    await writeFile(join(parent, 'secret.txt'), 'must-not-leak')
    const port = await findAvailablePort()
    const local = await createLocalStaticServer({ rootDirectory: root, port })

    const response = await fetch(`${local.url}/%2e%2e%2fsecret.txt`)
    expect([403, 404]).toContain(response.status)
    expect(await response.text()).not.toContain('must-not-leak')

    await local.close()
    await rm(parent, { recursive: true, force: true })
  })

  it('maps the file types used by the Vite build', () => {
    expect(getContentType('app.js')).toContain('javascript')
    expect(getContentType('font.woff2')).toBe('font/woff2')
  })
})
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npx vitest --run scripts/local-server.test.mjs
```

Expected: FAIL because `scripts/local-server.mjs` does not exist.

- [ ] **Step 3: Implement the minimal static server**

Implement these exports:

```js
export function getContentType(filePath) {}
export async function findAvailablePort(
  host = '127.0.0.1',
  startPort = 4173,
  endPort = 4192,
) {}
export function createLocalStaticServer({
  rootDirectory,
  host = '127.0.0.1',
  port,
}) {}
```

`createLocalStaticServer` must return:

```js
{
  server,
  url,
  close: () => Promise<void>,
}
```

Resolve every request against `rootDirectory`, reject decoded paths that escape it, serve existing files, and use `index.html` only for extensionless SPA routes.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
npx vitest --run scripts/local-server.test.mjs
```

Expected: all static-server tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/local-server.mjs scripts/local-server.test.mjs
git commit -m "feat: add localhost static server"
```

### Task 2: Cross-Platform Launcher

**Files:**
- Create: `scripts/start-overlay-studio.test.mjs`
- Create: `scripts/start-overlay-studio.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing launcher tests**

Test exported helpers without starting a browser:

```js
import { describe, expect, it, vi } from 'vitest'
import {
  buildBrowserCommand,
  ensureProjectReady,
} from './start-overlay-studio.mjs'

describe('Overlay Studio launcher', () => {
  it('uses the native browser opener for each platform', () => {
    expect(buildBrowserCommand('win32', 'http://127.0.0.1:4173'))
      .toEqual({ command: 'cmd', args: ['/c', 'start', '', 'http://127.0.0.1:4173'] })
    expect(buildBrowserCommand('darwin', 'http://127.0.0.1:4173'))
      .toEqual({ command: 'open', args: ['http://127.0.0.1:4173'] })
  })

  it('installs only when node_modules is missing and always builds', () => {
    const run = vi.fn()
    ensureProjectReady({
      projectRoot: 'project',
      exists: (path) => !path.endsWith('node_modules'),
      run,
    })
    expect(run.mock.calls.map(([command]) => command))
      .toEqual(['npm install', 'npm run build'])
  })
})
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npx vitest --run scripts/start-overlay-studio.test.mjs
```

Expected: FAIL because the launcher module does not exist.

- [ ] **Step 3: Implement launcher orchestration**

Export testable helpers:

```js
export function buildBrowserCommand(platform, url) {}
export function ensureProjectReady({
  projectRoot,
  exists = existsSync,
  run = runProjectCommand,
}) {}
export async function startOverlayStudio(options = {}) {}
```

`startOverlayStudio` must:

1. Resolve the project root from the script location.
2. Install dependencies only when `node_modules` is missing.
3. Always run `npm run build`.
4. Find a port from 4173 through 4192.
5. Serve `dist` on `127.0.0.1`.
6. Print the actual URL.
7. Open the browser unless `OVERLAY_STUDIO_NO_OPEN=1`.
8. Handle `SIGINT` and `SIGTERM` by closing the server.

Add package scripts:

```json
{
  "scripts": {
    "start:local": "node scripts/start-overlay-studio.mjs",
    "test:launcher": "vitest --run scripts/*.test.mjs"
  }
}
```

- [ ] **Step 4: Run launcher tests and verify GREEN**

Run:

```powershell
npm run test:launcher
```

Expected: all launcher tests PASS without opening a browser.

- [ ] **Step 5: Commit**

```powershell
git add package.json scripts/start-overlay-studio.mjs scripts/start-overlay-studio.test.mjs
git commit -m "feat: add local web launcher"
```

### Task 3: Double-Click Wrappers and User Guide

**Files:**
- Create: `启动 Overlay Studio.bat`
- Create: `启动 Overlay Studio.command`
- Create: `本地启动说明.md`

- [ ] **Step 1: Write a failing wrapper validation test**

Extend `scripts/start-overlay-studio.test.mjs` to read both wrappers and assert:

```js
expect(windowsWrapper).toContain('where node')
expect(windowsWrapper).toContain('scripts\\start-overlay-studio.mjs')
expect(macWrapper).toContain('command -v node')
expect(macWrapper).toContain('scripts/start-overlay-studio.mjs')
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npm run test:launcher
```

Expected: FAIL because the wrapper files do not exist.

- [ ] **Step 3: Add Windows and macOS wrappers**

The Windows wrapper must use its own directory:

```bat
@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [Overlay Studio] 未检测到 Node.js，请先安装 Node.js LTS。
  pause
  exit /b 1
)
node "scripts\start-overlay-studio.mjs"
if errorlevel 1 pause
```

The macOS wrapper must do the equivalent:

```sh
#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "[Overlay Studio] 未检测到 Node.js，请先安装 Node.js LTS。"
  read -r -p "按回车键退出..."
  exit 1
fi
node "scripts/start-overlay-studio.mjs"
```

Add a concise Chinese guide covering double-click startup, Node.js prerequisite, automatic port fallback, stopping the service, and manual `npm run start:local`.

- [ ] **Step 4: Mark the macOS script executable and verify**

Run:

```powershell
git update-index --add --chmod=+x "启动 Overlay Studio.command"
npm run test:launcher
```

Expected: wrapper tests PASS and Git records mode `100755` for the `.command` file.

- [ ] **Step 5: Commit**

```powershell
git add "启动 Overlay Studio.bat" "启动 Overlay Studio.command" "本地启动说明.md" scripts/start-overlay-studio.test.mjs
git commit -m "docs: add desktop launch entries"
```

### Task 4: Windows Desktop Shortcut and End-to-End Verification

**Files:**
- External artifact: `%USERPROFILE%\Desktop\Overlay Studio.lnk`
- No source-code restructuring.

- [ ] **Step 1: Create the Windows desktop shortcut**

Use PowerShell `WScript.Shell`:

```powershell
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Overlay Studio.lnk')
)
$shortcut.TargetPath = 'E:\Code\Motion-playground\启动 Overlay Studio.bat'
$shortcut.WorkingDirectory = 'E:\Code\Motion-playground'
$shortcut.Description = '启动 Overlay Studio 本地网页编辑器'
$shortcut.Save()
```

- [ ] **Step 2: Verify shortcut metadata**

Read the shortcut back with `WScript.Shell` and assert its target and working directory exactly match the project paths.

- [ ] **Step 3: Run the local service without opening a browser**

Run in a background process with `OVERLAY_STUDIO_NO_OPEN=1`, capture its printed URL, and verify:

```powershell
Invoke-WebRequest http://127.0.0.1:<selected-port>/ -UseBasicParsing
```

Expected: HTTP 200 and the Vite application HTML.

- [ ] **Step 4: Verify in the browser**

Open the printed localhost URL and confirm:

- Overlay Studio title and editor UI render.
- Existing video import, timeline, JSON controls, card editing, and local persistence UI remain present.
- Refresh keeps the page reachable.

- [ ] **Step 5: Run the full verification gate**

Run:

```powershell
npm run lint
npm run build
npm test -- --run
git diff --check
git status --short
```

Expected: lint/build/tests succeed, no whitespace errors, and only intentional source changes remain.

- [ ] **Step 6: Commit any final verification-only adjustments**

If verification required a source correction:

```powershell
git add package.json scripts "启动 Overlay Studio.bat" "启动 Overlay Studio.command" "本地启动说明.md"
git commit -m "fix: harden local launcher"
```

If no correction was needed, do not create an empty commit.
