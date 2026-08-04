import type { OverlayCard } from '../../timeline/types'
import {
  createCanvasExportSession,
  type CanvasExportSession,
} from '../canvas/CanvasExportSurface'
import { resolveCanvasRenderer } from '../canvas/rendererRegistry'
import {
  calculateFrameCount,
  calculateFrameTime,
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
} from '../frameMath'
import { runFramePipeline } from './framePipeline'
import { loadWorkerFonts } from './fonts'
import {
  validateWorkerExportCommand,
  type WorkerExportCommand,
  type WorkerExportEvent,
  type WorkerPhaseDurations,
} from './messages'

const MAX_BUFFERED_BYTES = 32 * 1024 * 1024

export interface WorkerExportSocket {
  readyState: number
  bufferedAmount: number
  addEventListener(
    type: string,
    listener: (event: Event | MessageEvent) => void,
  ): void
  removeEventListener(
    type: string,
    listener: (event: Event | MessageEvent) => void,
  ): void
  send(data: ArrayBuffer | string): void
  close(code?: number, reason?: string): void
}

interface RuntimeDependencies {
  origin: string
  postEvent(event: WorkerExportEvent): void
  prepareSession(cards: OverlayCard[]): Promise<CanvasExportSession>
  createSocket(url: string): WorkerExportSocket
  now?(): number
}

interface PreparedExport {
  session: CanvasExportSession
  duration: number
  totalFrames: number
  windowSize: 3
}

function abortError() {
  return new DOMException('透明导出已取消', 'AbortError')
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Worker 透明导出失败'
}

function waitForSocketOpen(socket: WorkerExportSocket, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(abortError())
  if (socket.readyState === 1) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      socket.removeEventListener('open', onOpen)
      socket.removeEventListener('error', onError)
      socket.removeEventListener('close', onClose)
      signal.removeEventListener('abort', onAbort)
    }
    const onOpen = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Worker 导出 WebSocket 连接失败'))
    }
    const onClose = () => {
      cleanup()
      reject(new Error('Worker 导出 WebSocket 已断开'))
    }
    const onAbort = () => {
      cleanup()
      reject(abortError())
    }
    socket.addEventListener('open', onOpen)
    socket.addEventListener('error', onError)
    socket.addEventListener('close', onClose)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function createSocketMessageQueue(
  socket: WorkerExportSocket,
  signal: AbortSignal,
) {
  const queued: Record<string, unknown>[] = []
  const waiting: Array<{
    resolve(value: Record<string, unknown>): void
    reject(reason: unknown): void
  }> = []
  let failure: Error | undefined

  const rejectWaiters = (error: Error) => {
    failure = error
    while (waiting.length > 0) waiting.shift()?.reject(error)
  }
  const onMessage = (event: Event | MessageEvent) => {
    try {
      if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
        throw new Error('Worker 导出服务返回了无效消息')
      }
      const value = JSON.parse(event.data) as unknown
      if (!value || typeof value !== 'object') {
        throw new Error('Worker 导出服务返回了无效消息')
      }
      const message = value as Record<string, unknown>
      const waiter = waiting.shift()
      if (waiter) waiter.resolve(message)
      else queued.push(message)
    } catch (error) {
      rejectWaiters(error instanceof Error ? error : new Error(String(error)))
    }
  }
  const onError = () => rejectWaiters(new Error('Worker 导出 WebSocket 传输失败'))
  const onClose = () => {
    if (!signal.aborted) rejectWaiters(new Error('Worker 导出 WebSocket 已断开'))
  }
  const onAbort = () => rejectWaiters(abortError())

  socket.addEventListener('message', onMessage)
  socket.addEventListener('error', onError)
  socket.addEventListener('close', onClose)
  signal.addEventListener('abort', onAbort, { once: true })

  return {
    next() {
      if (queued.length > 0) return Promise.resolve(queued.shift()!)
      if (failure) return Promise.reject(failure)
      return new Promise<Record<string, unknown>>((resolve, reject) => {
        waiting.push({ resolve, reject })
      })
    },
    dispose() {
      socket.removeEventListener('message', onMessage)
      socket.removeEventListener('error', onError)
      socket.removeEventListener('close', onClose)
      signal.removeEventListener('abort', onAbort)
    },
  }
}

export function createRawMovExportWorkerRuntime({
  origin,
  postEvent,
  prepareSession,
  createSocket,
  now = () => performance.now(),
}: RuntimeDependencies) {
  let prepared: PreparedExport | undefined
  let controller: AbortController | undefined
  let socket: WorkerExportSocket | undefined
  let completedFrames = 0
  let terminalPosted = false

  const postTerminal = (event: WorkerExportEvent) => {
    if (terminalPosted) return
    terminalPosted = true
    postEvent(event)
  }

  const phases = (): WorkerPhaseDurations => ({
    frameCaptureMs: 0,
    frameTransferMs: 0,
    acknowledgementMs: 0,
    encodingMs: 0,
  })

  async function prepare(command: Extract<WorkerExportCommand, { type: 'prepare' }>) {
    if (prepared || controller) throw new Error('Worker 导出已经准备')
    const session = await prepareSession(command.cards)
    await session.begin()
    prepared = {
      session,
      duration: command.duration,
      totalFrames: calculateFrameCount(command.duration),
      windowSize: command.windowSize,
    }
    postEvent({ type: 'ready' })
  }

  async function start(command: Extract<WorkerExportCommand, { type: 'start' }>) {
    if (!prepared) throw new Error('Worker 导出尚未准备')
    if (controller) throw new Error('Worker 导出已经开始')

    controller = new AbortController()
    const signal = controller.signal
    const timings = phases()
    const { session, totalFrames, windowSize } = prepared
    socket = createSocket(command.socketUrl)
    const messageQueue = createSocketMessageQueue(socket, signal)

    try {
      await waitForSocketOpen(socket, signal)
      await runFramePipeline({
        totalFrames,
        windowSize,
        maxBufferedBytes: MAX_BUFFERED_BYTES,
        bufferedAmount: () => socket?.bufferedAmount ?? 0,
        waitForWritable: async () => {
          while ((socket?.bufferedAmount ?? 0) > MAX_BUFFERED_BYTES) {
            if (signal.aborted) throw abortError()
            await new Promise((resolve) => setTimeout(resolve, 4))
          }
        },
        renderFrame: (frameIndex) => {
          const started = now()
          session.renderFrame(calculateFrameTime(frameIndex))
          const pixels = session.readRgba()
          timings.frameCaptureMs += now() - started
          return pixels
        },
        sendFrame: (_frameIndex, pixels) => {
          const started = now()
          socket?.send(pixels.buffer as ArrayBuffer)
          timings.frameTransferMs += now() - started
        },
        nextAcknowledgement: async () => {
          const started = now()
          const message = await messageQueue.next()
          timings.acknowledgementMs += now() - started
          if (
            message.type !== 'frame-accepted'
            || typeof message.frameIndex !== 'number'
          ) {
            throw new Error('Worker 导出服务返回了无效帧确认')
          }
          return message.frameIndex
        },
        onAcknowledged: (nextCompletedFrames) => {
          completedFrames = nextCompletedFrames
          postEvent({
            type: 'progress',
            completedFrames,
            totalFrames,
            phases: { ...timings },
          })
        },
        signal,
      })

      const encodingStarted = now()
      socket.send(JSON.stringify({ type: 'finish' }))
      const completed = await messageQueue.next()
      timings.encodingMs += now() - encodingStarted
      if (
        completed.type !== 'completed'
        || typeof completed.size !== 'number'
      ) {
        throw new Error('本地导出服务没有完成 MOV 编码')
      }
      const encodingMs = typeof completed.encodingMs === 'number'
        ? completed.encodingMs
        : timings.encodingMs
      timings.encodingMs = encodingMs
      postTerminal({
        type: 'completed',
        size: completed.size,
        encodingMs,
        phases: { ...timings },
      })
      socket.close(1000, 'completed')
    } catch (error) {
      socket.close(1000, signal.aborted ? 'cancelled' : 'failed')
      if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        postTerminal({ type: 'cancelled', completedFrames })
      } else {
        postTerminal({ type: 'error', message: errorMessage(error) })
      }
    } finally {
      messageQueue.dispose()
      session.end()
    }
  }

  return {
    async handleMessage(value: unknown) {
      try {
        const command = validateWorkerExportCommand(value, origin)
        if (command.type === 'prepare') await prepare(command)
        else if (command.type === 'start') await start(command)
        else controller?.abort()
      } catch (error) {
        postTerminal({ type: 'error', message: errorMessage(error) })
      }
    },
  }
}

function createBrowserWorkerRuntime() {
  const scope = globalThis as unknown as {
    location: Location
    fonts: FontFaceSet
    postMessage(event: WorkerExportEvent): void
  }
  return createRawMovExportWorkerRuntime({
    origin: scope.location.origin,
    postEvent: (event) => scope.postMessage(event),
    prepareSession: async (cards) => {
      const canvas = new OffscreenCanvas(EXPORT_WIDTH, EXPORT_HEIGHT)
      const resources = await loadWorkerFonts(scope.fonts, FontFace)
      return createCanvasExportSession({
        canvas,
        cards,
        resolveRenderer: resolveCanvasRenderer,
        fontReady: async () => undefined,
        resources,
      })
    },
    createSocket: (url) => new WebSocket(url),
  })
}

if (typeof document === 'undefined' && typeof globalThis.postMessage === 'function') {
  const runtime = createBrowserWorkerRuntime()
  globalThis.addEventListener('message', (event: MessageEvent<unknown>) => {
    void runtime.handleMessage(event.data)
  })
}
