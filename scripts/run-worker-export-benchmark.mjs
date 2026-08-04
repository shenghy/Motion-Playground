import { spawn } from 'node:child_process'
import { existsSync, createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ffmpegPath from 'ffmpeg-static'
import { WebSocket } from 'ws'
import { createExportApi } from './export-api.mjs'
import { createExportManager } from './export-manager.mjs'
import { createExportWebSocket } from './export-websocket.mjs'
import { createLocalStaticServer, findAvailablePort } from './local-server.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const chromeCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]

export function parseBenchmarkMode(value) {
  if (value === 'short' || value === 'long') return value
  throw new Error('基准模式必须是 short 或 long')
}

export function buildChromeArguments({
  profileDirectory,
  debuggingPort,
  appUrl,
  mode,
}) {
  const benchmarkUrl = new URL(appUrl)
  benchmarkUrl.searchParams.set('worker-export-benchmark', '1')
  benchmarkUrl.searchParams.set('mode', mode)
  return [
    '--headless=new',
    '--disable-gpu-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${profileDirectory}`,
    benchmarkUrl.href,
  ]
}

function findChrome() {
  const configured = process.env.CHROME_PATH
  if (configured && existsSync(configured)) return configured
  const found = chromeCandidates.find((candidate) => existsSync(candidate))
  if (!found) throw new Error('未找到 Chrome 或 Edge，请设置 CHROME_PATH')
  return found
}

async function waitForDebugger(debuggingPort, timeoutMs = 20_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)
      if (response.ok) {
        const targets = await response.json()
        const page = targets.find((target) => target.type === 'page')
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
      }
    } catch {
      // Chrome has not opened the debugging port yet.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
  }
  throw new Error('等待 Chrome 调试端口超时')
}

async function connectCdp(url) {
  const socket = new WebSocket(url)
  await new Promise((resolveOpen, rejectOpen) => {
    socket.once('open', resolveOpen)
    socket.once('error', rejectOpen)
  })
  let nextId = 1
  const pending = new Map()
  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString('utf8'))
    if (!message.id) return
    const operation = pending.get(message.id)
    if (!operation) return
    pending.delete(message.id)
    if (message.error) operation.reject(new Error(message.error.message))
    else operation.resolve(message.result)
  })
  socket.on('close', () => {
    for (const operation of pending.values()) {
      operation.reject(new Error('Chrome 调试连接已关闭'))
    }
    pending.clear()
  })
  return {
    send(method, params = {}) {
      const id = nextId++
      return new Promise((resolveResult, rejectResult) => {
        pending.set(id, { resolve: resolveResult, reject: rejectResult })
        socket.send(JSON.stringify({ id, method, params }))
      })
    },
    close() {
      socket.close()
    },
  }
}

function waitForProcessExit(child) {
  if (child.exitCode !== null) return Promise.resolve()
  return new Promise((resolveExit) => child.once('exit', resolveExit))
}

async function safeRemoveProfile(profileDirectory) {
  const absolute = resolve(profileDirectory)
  const tempRoot = `${resolve(tmpdir())}${sep}`
  if (
    !absolute.startsWith(tempRoot)
    || !basename(absolute).startsWith('motion-worker-benchmark-')
  ) {
    throw new Error(`拒绝删除非基准临时目录：${absolute}`)
  }
  await rm(absolute, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 250,
  })
}

async function startBenchmarkServer(port) {
  const host = '127.0.0.1'
  const origin = `http://${host}:${port}`
  const manager = createExportManager({ ffmpegPath })
  const exportApi = createExportApi({ manager, origin })
  const exportWebSocket = createExportWebSocket({ manager, origin })
  return createLocalStaticServer({
    rootDirectory: join(projectRoot, 'dist'),
    host,
    port,
    projectId: `worker-benchmark-${Date.now()}`,
    exportApi,
    exportWebSocket,
  })
}

async function downloadResult(origin, jobId, mode) {
  const outputPath = join(
    tmpdir(),
    `motion-playground-worker-${mode}-${Date.now()}.mov`,
  )
  const started = performance.now()
  const response = await fetch(
    `${origin}/__overlay_export__/jobs/${encodeURIComponent(jobId)}/file`,
  )
  if (!response.ok || !response.body) {
    throw new Error(`下载基准 MOV 失败（HTTP ${response.status}）`)
  }
  await pipeline(
    Readable.fromWeb(response.body),
    createWriteStream(outputPath),
  )
  const savingMs = performance.now() - started
  await fetch(
    `${origin}/__overlay_export__/jobs/${encodeURIComponent(jobId)}`,
    { method: 'DELETE' },
  ).catch(() => undefined)
  return { outputPath, savingMs }
}

export async function runWorkerExportBenchmark(modeValue) {
  const mode = parseBenchmarkMode(modeValue)
  if (!existsSync(join(projectRoot, 'dist', 'index.html'))) {
    throw new Error('缺少 dist 构建产物，请先运行 npm run build')
  }
  const appPort = await findAvailablePort('127.0.0.1', 45_000, 45_999)
  const debuggingPort = await findAvailablePort('127.0.0.1', 46_000, 46_999)
  const profileDirectory = await mkdtemp(
    join(tmpdir(), 'motion-worker-benchmark-'),
  )
  const server = await startBenchmarkServer(appPort)
  const child = spawn(
    findChrome(),
    buildChromeArguments({
      profileDirectory,
      debuggingPort,
      appUrl: server.url,
      mode,
    }),
    { stdio: 'ignore', windowsHide: true },
  )
  let cdp
  let chromeExited = false

  try {
    const debuggerUrl = await waitForDebugger(debuggingPort)
    cdp = await connectCdp(debuggerUrl)
    await cdp.send('Runtime.enable')
    const timeoutMs = mode === 'long' ? 15 * 60_000 : 5 * 60_000
    const started = Date.now()
    let lastProgressAt = 0
    let result
    while (Date.now() - started < timeoutMs) {
      const evaluation = await cdp.send('Runtime.evaluate', {
        expression: 'window.__WORKER_EXPORT_BENCHMARK__ ?? null',
        returnByValue: true,
      })
      result = evaluation?.result?.value
      if (result?.status === 'completed' || result?.status === 'error') break
      if (Date.now() - lastProgressAt >= 20_000) {
        lastProgressAt = Date.now()
        console.log(
          `[worker-benchmark] ${result?.stage ?? 'starting'} `
          + `${result?.completedFrames ?? 0}/${result?.totalFrames ?? '?'}`,
        )
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
    }
    if (!result || result.status === 'running') {
      throw new Error('Worker 导出浏览器基准超时')
    }
    if (result.status === 'error') {
      throw new Error(result.message ?? 'Worker 导出浏览器基准失败')
    }
    const downloaded = await downloadResult(server.url, result.jobId, mode)
    const finalResult = {
      ...result,
      ...downloaded,
      totalWithSavingMs: result.elapsedMs + downloaded.savingMs,
    }
    console.log(`BENCHMARK_RESULT=${JSON.stringify(finalResult)}`)
    return finalResult
  } finally {
    if (cdp) {
      await cdp.send('Browser.close').catch(() => undefined)
      cdp.close()
    }
    await Promise.race([
      waitForProcessExit(child),
      new Promise((resolveTimeout) => setTimeout(resolveTimeout, 10_000)),
    ])
    if (child.exitCode === null) child.kill()
    await waitForProcessExit(child)
    chromeExited = true
    await server.close()
    if (chromeExited) await safeRemoveProfile(profileDirectory)
  }
}

const entryPath = process.argv[1]
const isDirectExecution = entryPath
  && pathToFileURL(resolve(entryPath)).href === import.meta.url

if (isDirectExecution) {
  runWorkerExportBenchmark(process.argv[2] ?? 'short').catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
