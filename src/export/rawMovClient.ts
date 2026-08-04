import { discardTransparentMov } from './movExportClient'
import {
  calculateFrameCount,
  calculateFrameTime,
  EXPORT_FPS,
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
} from './frameMath'
import type { ExportProgress } from './exportController'
import type { ExportPerformance } from './exportPerformance'

const API_PREFIX = '/__overlay_export__'
const RAW_FRAME_BYTES = EXPORT_WIDTH * EXPORT_HEIGHT * 4

interface RawSocket {
  readyState: number
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

type SocketFactory = (url: string) => RawSocket

export interface RenderRawMovResult {
  status: 'completed' | 'cancelled'
  completedFrames: number
  totalFrames: number
  jobId?: string
  size?: number
  encodingMs?: number
}

async function responseError(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === 'string') return body.error
  } catch {
    // The local server may return an empty response.
  }
  return `透明 MOV 导出请求失败（HTTP ${response.status}）`
}

async function requireOk(response: Response) {
  if (!response.ok) throw new Error(await responseError(response))
  return response
}

function abortError() {
  return new DOMException('透明导出已取消', 'AbortError')
}

function waitForSocketEvent(
  socket: RawSocket,
  type: 'open' | 'message',
  signal: AbortSignal,
) {
  if (signal.aborted) return Promise.reject(abortError())
  if (type === 'open' && socket.readyState === 1) {
    return Promise.resolve(new Event('open'))
  }

  return new Promise<Event | MessageEvent>((resolve, reject) => {
    const cleanup = () => {
      socket.removeEventListener(type, onExpected)
      socket.removeEventListener('error', onError)
      socket.removeEventListener('close', onClose)
      signal.removeEventListener('abort', onAbort)
    }
    const onExpected = (event: Event | MessageEvent) => {
      cleanup()
      resolve(event)
    }
    const onError = () => {
      cleanup()
      reject(new Error('透明导出 WebSocket 连接失败'))
    }
    const onClose = () => {
      cleanup()
      reject(signal.aborted
        ? abortError()
        : new Error('透明导出 WebSocket 已断开'))
    }
    const onAbort = () => {
      cleanup()
      socket.close(1000, 'cancelled')
      reject(abortError())
    }
    socket.addEventListener(type, onExpected)
    socket.addEventListener('error', onError)
    socket.addEventListener('close', onClose)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function parseSocketMessage(event: Event | MessageEvent) {
  if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
    throw new Error('透明导出服务返回了无效消息')
  }
  return JSON.parse(event.data) as Record<string, unknown>
}

function framePacket(frameIndex: number, rgba: Uint8ClampedArray) {
  if (rgba.byteLength !== RAW_FRAME_BYTES) {
    throw new Error(`RGBA 帧字节数必须为 ${RAW_FRAME_BYTES}`)
  }
  const packet = new ArrayBuffer(4 + rgba.byteLength)
  new DataView(packet).setUint32(0, frameIndex)
  new Uint8Array(packet, 4).set(rgba)
  return packet
}

function socketUrl(jobId: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${API_PREFIX}/jobs/${encodeURIComponent(jobId)}/raw`
}

const browserSocketFactory: SocketFactory = (url) => new WebSocket(url)

export async function renderTransparentMovRaw({
  duration,
  renderFrame,
  signal,
  onProgress,
  onJobCreated,
  beginCapture,
  endCapture,
  performance,
  fetcher = fetch,
  createSocket = browserSocketFactory,
}: {
  duration: number
  renderFrame(time: number): Uint8ClampedArray
  signal: AbortSignal
  onProgress(progress: ExportProgress): void
  onJobCreated?: (jobId: string) => void
  beginCapture?(): Promise<void>
  endCapture?(): void
  performance?: ExportPerformance
  fetcher?: typeof fetch
  createSocket?: SocketFactory
}): Promise<RenderRawMovResult> {
  const totalFrames = calculateFrameCount(duration)
  let completedFrames = 0
  let jobId: string | undefined
  let socket: RawSocket | undefined
  let captureStarted = false

  try {
    if (beginCapture) {
      if (performance) await performance.measure('preparing', beginCapture)
      else await beginCapture()
      captureStarted = true
    }

    const response = await requireOk(await fetcher(`${API_PREFIX}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        width: EXPORT_WIDTH,
        height: EXPORT_HEIGHT,
        fps: EXPORT_FPS,
        totalFrames,
        transport: 'raw-rgba',
      }),
      signal,
    }))
    const created = (await response.json()) as { id?: unknown }
    if (typeof created.id !== 'string') {
      throw new Error('本地导出服务没有返回任务编号')
    }
    jobId = created.id
    onJobCreated?.(jobId)
    socket = createSocket(socketUrl(jobId))
    await waitForSocketEvent(socket, 'open', signal)

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      if (signal.aborted) throw abortError()
      const render = async () => renderFrame(
        calculateFrameTime(frameIndex, EXPORT_FPS),
      )
      const rgba = performance
        ? await performance.measure('frameCapture', render)
        : await render()
      const packet = framePacket(frameIndex, rgba)
      const transfer = async () => {
        const acknowledgement = waitForSocketEvent(socket!, 'message', signal)
        socket!.send(packet)
        const message = parseSocketMessage(await acknowledgement)
        if (
          message.type !== 'frame-accepted'
          || message.frameIndex !== frameIndex
        ) {
          throw new Error('透明导出确认帧序号不连续')
        }
      }
      if (performance) await performance.measure('frameTransfer', transfer)
      else await transfer()

      completedFrames += 1
      performance?.completeFrame(completedFrames, totalFrames)
      onProgress({
        phase: 'rendering',
        completedFrames,
        totalFrames,
        ...(performance ? { performance: performance.snapshot() } : {}),
      })
    }

    onProgress({ phase: 'encoding', completedFrames, totalFrames })
    const completed = waitForSocketEvent(socket, 'message', signal)
    socket.send(JSON.stringify({ type: 'finish' }))
    const message = parseSocketMessage(await completed)
    if (message.type !== 'completed') {
      throw new Error('本地导出服务没有完成 MOV 编码')
    }
    const encodingMs = typeof message.encodingMs === 'number'
      ? message.encodingMs
      : undefined
    if (encodingMs !== undefined) performance?.addDuration('encoding', encodingMs)
    socket.close(1000, 'completed')
    return {
      status: 'completed',
      jobId,
      completedFrames,
      totalFrames,
      size: typeof message.size === 'number' ? message.size : undefined,
      encodingMs,
    }
  } catch (error) {
    socket?.close(1000, signal.aborted ? 'cancelled' : 'failed')
    if (jobId) {
      await discardTransparentMov(jobId, fetcher).catch(() => undefined)
    }
    if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      return { status: 'cancelled', completedFrames, totalFrames }
    }
    throw error
  } finally {
    if (captureStarted) endCapture?.()
  }
}
