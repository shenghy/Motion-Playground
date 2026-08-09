import type { OverlayCard } from '../../timeline/types'
import type { ExportProgress } from '../exportController'
import type { ExportPerformance } from '../exportPerformance'
import {
  calculateFrameCount,
  EXPORT_FPS,
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
} from '../frameMath'
import { discardTransparentMov } from '../movExportClient'
import type { RenderRawMovResult } from '../rawMovClient'
import type {
  WorkerExportCommand,
  WorkerExportEvent,
  WorkerPhaseDurations,
} from './messages'

const API_PREFIX = '/__overlay_export__'

export interface WorkerLike {
  addEventListener(
    type: string,
    listener: (event: Event | MessageEvent) => void,
  ): void
  removeEventListener(
    type: string,
    listener: (event: Event | MessageEvent) => void,
  ): void
  postMessage(message: unknown): void
  terminate(): void
}

interface WorkerFeatureScope {
  Worker?: unknown
  OffscreenCanvas?: unknown
  FontFace?: unknown
}

interface WorkerPipelineCapabilities {
  mov?: unknown
  rawRgba?: unknown
  transport?: unknown
  orderedRawProtocol?: unknown
  workerPipeline?: unknown
  orderedRleProtocol?: unknown
  orderedRoiProtocol?: unknown
}

export class WorkerMovPreparationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkerMovPreparationError'
  }
}

export function canUseWorkerMovExport(
  scope: WorkerFeatureScope = window,
) {
  return typeof scope.Worker === 'function'
    && typeof scope.OffscreenCanvas === 'function'
    && typeof scope.FontFace === 'function'
}

export function supportsWorkerMovPipeline(
  capability: WorkerPipelineCapabilities,
) {
  return capability.mov === true
    && capability.rawRgba === true
    && capability.transport === 'websocket'
    && capability.orderedRawProtocol === 'v2'
    && capability.workerPipeline === true
    && capability.orderedRleProtocol === 'v3'
    && capability.orderedRoiProtocol === 'v4'
}

const browserWorkerFactory = (): WorkerLike => new Worker(
  new URL('./rawMovExport.worker.ts', import.meta.url),
  { type: 'module', name: 'transparent-mov-export' },
)

function createWorkerEventQueue(worker: WorkerLike) {
  const events: WorkerExportEvent[] = []
  const waiting: Array<{
    resolve(event: WorkerExportEvent): void
    reject(reason: unknown): void
  }> = []
  let failure: Error | undefined

  const fail = (error: Error) => {
    failure = error
    while (waiting.length > 0) waiting.shift()?.reject(error)
  }
  const onMessage = (event: Event | MessageEvent) => {
    if (!(event instanceof MessageEvent)) {
      fail(new Error('Worker 返回了无效导出消息'))
      return
    }
    const value = event.data as WorkerExportEvent
    if (!value || typeof value !== 'object' || typeof value.type !== 'string') {
      fail(new Error('Worker 返回了无效导出消息'))
      return
    }
    const waiter = waiting.shift()
    if (waiter) waiter.resolve(value)
    else events.push(value)
  }
  const onError = () => fail(new Error('透明导出 Worker 运行失败'))
  const onMessageError = () => fail(new Error('透明导出 Worker 消息无法解析'))

  worker.addEventListener('message', onMessage)
  worker.addEventListener('error', onError)
  worker.addEventListener('messageerror', onMessageError)

  return {
    next() {
      if (events.length > 0) return Promise.resolve(events.shift()!)
      if (failure) return Promise.reject(failure)
      return new Promise<WorkerExportEvent>((resolve, reject) => {
        waiting.push({ resolve, reject })
      })
    },
    dispose() {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      worker.removeEventListener('messageerror', onMessageError)
    },
  }
}

async function requireCreatedJob(response: Response) {
  if (!response.ok) {
    throw new Error(`透明 MOV 导出请求失败（HTTP ${response.status}）`)
  }
  const body = (await response.json()) as { id?: unknown }
  if (typeof body.id !== 'string' || body.id === '') {
    throw new Error('本地导出服务没有返回任务编号')
  }
  return body.id
}

function socketUrl(jobId: string, pageLocation: URL) {
  const protocol = pageLocation.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${pageLocation.host}${API_PREFIX}/jobs/${encodeURIComponent(jobId)}/raw`
}

function phaseSynchronizer(performance: ExportPerformance | undefined) {
  let previous: WorkerPhaseDurations = {
    frameCaptureMs: 0,
    frameTransferMs: 0,
    acknowledgementMs: 0,
    encodingMs: 0,
  }
  return (next: WorkerPhaseDurations) => {
    if (!performance) return
    performance.addDuration(
      'frameCapture',
      next.frameCaptureMs - previous.frameCaptureMs,
    )
    performance.addDuration(
      'frameTransfer',
      next.frameTransferMs - previous.frameTransferMs
        + next.acknowledgementMs - previous.acknowledgementMs,
    )
    performance.addDuration('encoding', next.encodingMs - previous.encodingMs)
    previous = { ...next }
  }
}

export async function renderTransparentMovWorker({
  cards,
  duration,
  signal,
  onProgress,
  onJobCreated,
  performance,
  fetcher = fetch,
  createWorker = browserWorkerFactory,
  pageLocation = new URL(window.location.href),
}: {
  cards: OverlayCard[]
  duration: number
  signal: AbortSignal
  onProgress(progress: ExportProgress): void
  onJobCreated?(jobId: string): void
  performance?: ExportPerformance
  fetcher?: typeof fetch
  createWorker?: () => WorkerLike
  pageLocation?: URL
}): Promise<RenderRawMovResult> {
  const totalFrames = calculateFrameCount(duration)
  let completedFrames = 0
  let jobId: string | undefined
  const worker = createWorker()
  const queue = createWorkerEventQueue(worker)
  const syncPhases = phaseSynchronizer(performance)
  const onAbort = () => worker.postMessage({ type: 'cancel' } satisfies WorkerExportCommand)
  signal.addEventListener('abort', onAbort, { once: true })

  try {
    if (signal.aborted) {
      return { status: 'cancelled', completedFrames, totalFrames }
    }

    const prepare = async () => {
      worker.postMessage({
        type: 'prepare',
        cards,
        duration,
        windowSize: 3,
      } satisfies WorkerExportCommand)
      const event = await queue.next()
      if (event.type !== 'ready') {
        const message = event.type === 'error'
          ? event.message
          : '透明导出 Worker 准备失败'
        throw new WorkerMovPreparationError(message)
      }
    }
    if (performance) await performance.measure('preparing', prepare)
    else await prepare()

    jobId = await requireCreatedJob(await fetcher(`${API_PREFIX}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        width: EXPORT_WIDTH,
        height: EXPORT_HEIGHT,
        fps: EXPORT_FPS,
        totalFrames,
        transport: 'raw-rgba-roi-ordered',
      }),
      signal,
    }))
    onJobCreated?.(jobId)
    worker.postMessage({
      type: 'start',
      jobId,
      socketUrl: socketUrl(jobId, pageLocation),
    } satisfies WorkerExportCommand)

    while (true) {
      const event = await queue.next()
      if (event.type === 'progress') {
        completedFrames = event.completedFrames
        syncPhases(event.phases)
        performance?.completeFrame(completedFrames, totalFrames)
        onProgress({
          phase: 'rendering',
          completedFrames,
          totalFrames,
          ...(performance ? { performance: performance.snapshot() } : {}),
        })
        if (completedFrames === totalFrames) {
          onProgress({
            phase: 'encoding',
            completedFrames,
            totalFrames,
            ...(performance ? { performance: performance.snapshot() } : {}),
          })
        }
        continue
      }
      if (event.type === 'completed') {
        syncPhases(event.phases)
        return {
          status: 'completed',
          completedFrames,
          totalFrames,
          jobId,
          size: event.size,
          encodingMs: event.encodingMs,
        }
      }
      if (event.type === 'cancelled') {
        completedFrames = event.completedFrames
        await discardTransparentMov(jobId, fetcher).catch(() => undefined)
        return { status: 'cancelled', completedFrames, totalFrames }
      }
      if (event.type === 'error') throw new Error(event.message)
      throw new Error('Worker 返回了意外的导出消息')
    }
  } catch (error) {
    if (jobId) await discardTransparentMov(jobId, fetcher).catch(() => undefined)
    if (signal.aborted) {
      return { status: 'cancelled', completedFrames, totalFrames }
    }
    throw error
  } finally {
    signal.removeEventListener('abort', onAbort)
    queue.dispose()
    worker.terminate()
  }
}
