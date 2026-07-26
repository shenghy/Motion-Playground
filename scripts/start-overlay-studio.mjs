import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  createLocalStaticServer,
  findAvailablePort,
} from './local-server.mjs'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_START_PORT = 4173
const DEFAULT_END_PORT = 4192
const LEGACY_STARTUP_LOCK_AGE_MS = 10 * 60 * 1000
const INVALID_LOCK_GRACE_MS = 5000

export function buildBrowserCommand(platform, url) {
  if (platform === 'win32') {
    return {
      command: 'cmd',
      args: ['/c', 'start', '', url],
    }
  }
  if (platform === 'darwin') {
    return {
      command: 'open',
      args: [url],
    }
  }
  return {
    command: 'xdg-open',
    args: [url],
  }
}

function runProjectCommand(command, projectRoot) {
  const result = spawnSync(command, {
    cwd: projectRoot,
    shell: true,
    stdio: 'inherit',
    windowsHide: false,
  })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with ${result.status}`)
  }
}

export function ensureProjectReady({
  projectRoot,
  exists = existsSync,
  run = runProjectCommand,
}) {
  if (!exists(join(projectRoot, 'node_modules'))) {
    console.log('[Overlay Studio] 首次启动，正在安装项目依赖…')
    try {
      run('npm install', projectRoot)
    } catch (error) {
      throw new Error('依赖安装失败，请检查网络和 npm 配置。', {
        cause: error,
      })
    }
  }

  console.log('[Overlay Studio] 正在构建本地网页…')
  try {
    run('npm run build', projectRoot)
  } catch (error) {
    throw new Error('项目构建失败，请查看上方命令输出。', {
      cause: error,
    })
  }
}

export function openDefaultBrowser(
  url,
  platform = process.platform,
  spawnProcess = spawn,
) {
  const browserCommand = buildBrowserCommand(platform, url)
  const child = spawnProcess(browserCommand.command, browserCommand.args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
  return child
}

function isValidPort(port) {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

export function readSavedPort(filePath) {
  try {
    const port = Number(readFileSync(filePath, 'utf8').trim())
    return isValidPort(port) ? port : null
  } catch {
    return null
  }
}

export function savePreferredPort(filePath, port) {
  writeFileSync(filePath, `${port}\n`, 'utf8')
}

export function createProjectId(projectRoot) {
  const normalizedRoot =
    process.platform === 'win32'
      ? resolve(projectRoot).toLowerCase()
      : resolve(projectRoot)
  return createHash('sha256')
    .update(normalizedRoot)
    .digest('hex')
    .slice(0, 20)
}

export async function probeOverlayStudio(host, port, projectId) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 350)
  try {
    const response = await fetch(
      `http://${host}:${port}/__overlay_studio_status__`,
      {
        cache: 'no-store',
        signal: controller.signal,
      },
    )
    if (!response.ok) {
      return false
    }
    const status = await response.json()
    return (
      status?.app === 'overlay-studio' &&
      status?.version === 1 &&
      status?.projectId === projectId
    )
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export async function chooseLauncherTarget({
  host,
  startPort,
  endPort,
  savedPort,
  projectId,
  probe = probeOverlayStudio,
  findPort = findAvailablePort,
}) {
  if (isValidPort(savedPort)) {
    if (await probe(host, savedPort, projectId)) {
      return {
        port: savedPort,
        url: `http://${host}:${savedPort}/`,
        reused: true,
      }
    }

    try {
      const port = await findPort(host, savedPort, savedPort)
      return {
        port,
        url: `http://${host}:${port}/`,
        reused: false,
      }
    } catch {
      // The remembered port belongs to another process; use the normal range.
    }
  } else {
    for (let port = startPort; port <= endPort; port += 1) {
      if (await probe(host, port, projectId)) {
        return {
          port,
          url: `http://${host}:${port}/`,
          reused: true,
        }
      }
    }
  }

  const port = await findPort(host, startPort, endPort)
  return {
    port,
    url: `http://${host}:${port}/`,
    reused: false,
  }
}

export async function findRunningOverlayStudio({
  host,
  startPort,
  endPort,
  savedPort,
  projectId,
  probe = probeOverlayStudio,
}) {
  const ports = []
  if (
    isValidPort(savedPort) &&
    savedPort >= startPort &&
    savedPort <= endPort
  ) {
    ports.push(savedPort)
  }
  for (let port = startPort; port <= endPort; port += 1) {
    if (!ports.includes(port)) {
      ports.push(port)
    }
  }

  for (const port of ports) {
    if (await probe(host, port, projectId)) {
      return {
        port,
        url: `http://${host}:${port}/`,
        reused: true,
      }
    }
  }
  return null
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false
  }
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function getProcessIdentity(
  pid,
  platform = process.platform,
  run = spawnSync,
) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return null
  }

  const processQuery =
    platform === 'win32'
      ? {
          command: 'powershell.exe',
          args: [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`,
          ],
        }
      : {
          command: 'ps',
          args: ['-p', String(pid), '-o', 'lstart='],
        }

  try {
    const result = run(processQuery.command, processQuery.args, {
      encoding: 'utf8',
      windowsHide: true,
    })
    if (result.error || result.status !== 0) {
      return null
    }
    return result.stdout.trim() || null
  } catch {
    return null
  }
}

function readLockRecord(lockPath) {
  const stat = statSync(lockPath)
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  return { lock, stat }
}

function isLockOwnerAlive(lock, stat) {
  const pid = Number(lock.pid)
  if (!isProcessRunning(pid)) {
    return false
  }

  if (typeof lock.processIdentity === 'string' && lock.processIdentity) {
    return getProcessIdentity(pid) === lock.processIdentity
  }

  return Date.now() - stat.mtimeMs <= LEGACY_STARTUP_LOCK_AGE_MS
}

function removeInactiveLock(lockPath) {
  try {
    const first = readLockRecord(lockPath)
    if (isLockOwnerAlive(first.lock, first.stat)) {
      return false
    }

    const current = readLockRecord(lockPath)
    if (
      current.lock.token !== first.lock.token ||
      current.stat.mtimeMs !== first.stat.mtimeMs
    ) {
      return false
    }

    unlinkSync(lockPath)
    return true
  } catch {
    try {
      if (Date.now() - statSync(lockPath).mtimeMs > INVALID_LOCK_GRACE_MS) {
        unlinkSync(lockPath)
        return true
      }
    } catch {
      return true
    }
    return false
  }
}

function createOwnedLock(lockPath, token) {
  let fileDescriptor
  try {
    fileDescriptor = openSync(lockPath, 'wx')
    writeFileSync(
      fileDescriptor,
      JSON.stringify({
        pid: process.pid,
        token,
        createdAt: Date.now(),
        processIdentity: getProcessIdentity(process.pid),
      }),
      'utf8',
    )
    closeSync(fileDescriptor)
    fileDescriptor = undefined
    return true
  } catch (error) {
    if (fileDescriptor !== undefined) {
      closeSync(fileDescriptor)
    }
    if (error?.code === 'EEXIST') {
      return false
    }
    throw error
  }
}

function acquireLockGuard(guardPath) {
  const token = randomUUID()
  if (!createOwnedLock(guardPath, token)) {
    if (!removeInactiveLock(guardPath) || !createOwnedLock(guardPath, token)) {
      return null
    }
  }

  return () => {
    try {
      const guard = JSON.parse(readFileSync(guardPath, 'utf8'))
      if (guard.token === token) {
        unlinkSync(guardPath)
      }
    } catch {
      // The owning process or stale-lock recovery may have removed the guard.
    }
  }
}

export function acquireStartupLock(lockPath) {
  const token = randomUUID()
  const guardPath = `${lockPath}.guard`
  const releaseGuard = acquireLockGuard(guardPath)
  if (!releaseGuard) {
    return null
  }

  try {
    if (!createOwnedLock(lockPath, token)) {
      if (!removeInactiveLock(lockPath) || !createOwnedLock(lockPath, token)) {
        return null
      }
    }
  } finally {
    releaseGuard()
  }

  return () => {
    try {
      const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
      if (lock.token !== token) {
        return null
      }
      unlinkSync(lockPath)
    } catch {
      // A terminated process or manual cleanup may have removed the lock.
    }
  }
}

async function waitForStartupLock(lockFile) {
  for (let attempt = 0; attempt < 2400; attempt += 1) {
    const releaseStartupLock = acquireStartupLock(lockFile)
    if (releaseStartupLock) {
      return releaseStartupLock
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  throw new Error('另一个启动器长时间未完成，请关闭旧窗口后重试。')
}

function openBrowserWithFallback(url) {
  try {
    const browserProcess = openDefaultBrowser(url)
    browserProcess.once('error', () => {
      console.warn(
        `[Overlay Studio] 浏览器未能自动打开，请手动访问：${url}`,
      )
    })
  } catch {
    console.warn(
      `[Overlay Studio] 浏览器未能自动打开，请手动访问：${url}`,
    )
  }
}

function announceExistingInstance(target, noOpen) {
  console.log('')
  console.log('[Overlay Studio] 已检测到正在运行的本地编辑器')
  console.log(`[Overlay Studio] 访问地址：${target.url}`)
  console.log('')
  if (!noOpen) {
    openBrowserWithFallback(target.url)
  }
  return {
    url: target.url,
    reused: true,
    close: async () => undefined,
  }
}

export async function startOverlayStudio({
  projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  host = DEFAULT_HOST,
  startPort = Number(
    process.env.OVERLAY_STUDIO_PORT ?? DEFAULT_START_PORT,
  ),
  endPort = Number(
    process.env.OVERLAY_STUDIO_END_PORT ?? DEFAULT_END_PORT,
  ),
  skipBuild = process.env.OVERLAY_STUDIO_SKIP_BUILD === '1',
  noOpen = process.env.OVERLAY_STUDIO_NO_OPEN === '1',
} = {}) {
  const distDirectory = join(projectRoot, 'dist')
  const portFile = join(projectRoot, '.overlay-studio-port.local')
  const lockFile = join(projectRoot, '.overlay-studio-starting.local')
  const projectId = createProjectId(projectRoot)
  const savedPort = readSavedPort(portFile)
  const releaseStartupLock =
    acquireStartupLock(lockFile) ?? (await waitForStartupLock(lockFile))

  let local
  try {
    if (!skipBuild) {
      ensureProjectReady({ projectRoot })
    }

    const runningAfterLock = await findRunningOverlayStudio({
      host,
      startPort,
      endPort,
      savedPort,
      projectId,
    })
    if (runningAfterLock) {
      return announceExistingInstance(runningAfterLock, noOpen)
    }

    const target = await chooseLauncherTarget({
      host,
      startPort,
      endPort,
      savedPort,
      projectId,
    })
    local = await createLocalStaticServer({
      rootDirectory: distDirectory,
      host,
      port: target.port,
      projectId,
    })
    savePreferredPort(portFile, target.port)
  } finally {
    releaseStartupLock()
  }

  console.log('')
  console.log('[Overlay Studio] 本地网页编辑器已启动')
  console.log(`[Overlay Studio] 访问地址：${local.url}`)
  console.log('[Overlay Studio] 关闭此窗口或按 Ctrl+C 即可停止服务')
  console.log('')

  if (!noOpen) {
    openBrowserWithFallback(local.url)
  }

  let closing = false
  const shutdown = async () => {
    if (closing) {
      return
    }
    closing = true
    console.log('\n[Overlay Studio] 正在停止本地服务…')
    await local.close()
  }

  process.once('SIGINT', () => {
    void shutdown().finally(() => process.exit(0))
  })
  process.once('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0))
  })

  return local
}

const entryPath = process.argv[1]
const isDirectExecution =
  entryPath !== undefined &&
  pathToFileURL(resolve(entryPath)).href === import.meta.url

if (isDirectExecution) {
  startOverlayStudio().catch((error) => {
    console.error('')
    console.error(`[Overlay Studio] 启动失败：${error.message}`)
    console.error('')
    process.exitCode = 1
  })
}
