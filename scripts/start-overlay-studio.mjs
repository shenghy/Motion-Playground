import { existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  createLocalStaticServer,
  findAvailablePort,
} from './local-server.mjs'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_START_PORT = 4173
const DEFAULT_END_PORT = 4192

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
  if (!skipBuild) {
    ensureProjectReady({ projectRoot })
  }

  const distDirectory = join(projectRoot, 'dist')
  const port = await findAvailablePort(host, startPort, endPort)
  const local = await createLocalStaticServer({
    rootDirectory: distDirectory,
    host,
    port,
  })

  console.log('')
  console.log('[Overlay Studio] 本地网页编辑器已启动')
  console.log(`[Overlay Studio] 访问地址：${local.url}`)
  console.log('[Overlay Studio] 关闭此窗口或按 Ctrl+C 即可停止服务')
  console.log('')

  if (!noOpen) {
    try {
      const browserProcess = openDefaultBrowser(local.url)
      browserProcess.once('error', () => {
        console.warn(
          `[Overlay Studio] 浏览器未能自动打开，请手动访问：${local.url}`,
        )
      })
    } catch {
      console.warn(
        `[Overlay Studio] 浏览器未能自动打开，请手动访问：${local.url}`,
      )
    }
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
