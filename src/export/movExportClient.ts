import type { OverlayFileSystemFileHandle } from './fileSystemAccess'
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

type Fetcher = typeof fetch

export interface RenderMovResult {
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
    // The server may return an empty or non-JSON response.
  }
  return `透明 MOV 导出请求失败（HTTP ${response.status}）`
}

async function requireOk(response: Response) {
  if (!response.ok) throw new Error(await responseError(response))
  return response
}

export async function discardTransparentMov(
  jobId: string,
  fetcher: Fetcher = fetch,
) {
  await requireOk(
    await fetcher(`${API_PREFIX}/jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    }),
  )
}

export async function renderTransparentMov({
  duration,
  captureFrame,
  signal,
  onProgress,
  onJobCreated,
  beginCapture,
  endCapture,
  performance,
  fetcher = fetch,
}: {
  duration: number
  captureFrame(time: number): Promise<Blob>
  signal: AbortSignal
  onProgress(progress: ExportProgress): void
  onJobCreated?: (jobId: string) => void
  beginCapture?(): Promise<void>
  endCapture?(): void
  performance?: ExportPerformance
  fetcher?: Fetcher
}): Promise<RenderMovResult> {
  const totalFrames = calculateFrameCount(duration)
  let jobId: string | undefined
  let completedFrames = 0
  let captureStarted = false

  try {
    if (beginCapture) {
      if (performance) {
        await performance.measure('preparing', beginCapture)
      } else {
        await beginCapture()
      }
      captureStarted = true
    }
    const created = await requireOk(
      await fetcher(`${API_PREFIX}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          width: EXPORT_WIDTH,
          height: EXPORT_HEIGHT,
          fps: EXPORT_FPS,
          totalFrames,
        }),
        signal,
      }),
    )
    const createdBody = (await created.json()) as { id?: unknown }
    if (typeof createdBody.id !== 'string') {
      throw new Error('本地导出服务没有返回任务编号')
    }
    jobId = createdBody.id
    const activeJobId = jobId
    onJobCreated?.(activeJobId)

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      if (signal.aborted) break
      const frame = await captureFrame(
        calculateFrameTime(frameIndex, EXPORT_FPS),
      )
      if (signal.aborted) break

      const transferFrame = async () => requireOk(
        await fetcher(
          `${API_PREFIX}/jobs/${encodeURIComponent(activeJobId)}/frames/${frameIndex}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'image/png' },
            body: frame,
            signal,
          },
        ),
      )
      if (performance) {
        await performance.measure('frameTransfer', transferFrame)
      } else {
        await transferFrame()
      }
      completedFrames += 1
      performance?.completeFrame(completedFrames, totalFrames)
      onProgress({
        phase: 'rendering',
        completedFrames,
        totalFrames,
        ...(performance ? { performance: performance.snapshot() } : {}),
      })
    }

    if (signal.aborted || completedFrames !== totalFrames) {
      await discardTransparentMov(activeJobId, fetcher)
      return { status: 'cancelled', completedFrames, totalFrames }
    }

    onProgress({
      phase: 'encoding',
      completedFrames,
      totalFrames,
    })
    const finishEncoding = async () => requireOk(
      await fetcher(
        `${API_PREFIX}/jobs/${encodeURIComponent(activeJobId)}/finish`,
        { method: 'POST', signal },
      ),
    )
    const finished = await finishEncoding()
    const body = (await finished.json()) as {
      size?: unknown
      encodingMs?: unknown
    }
    if (typeof body.encodingMs === 'number') {
      performance?.addDuration('encoding', body.encodingMs)
    }
    return {
      status: 'completed',
      jobId: activeJobId,
      completedFrames,
      totalFrames,
      size: typeof body.size === 'number' ? body.size : undefined,
      encodingMs:
        typeof body.encodingMs === 'number'
          ? body.encodingMs
          : undefined,
    }
  } catch (error) {
    if (jobId) {
      try {
        await discardTransparentMov(jobId, fetcher)
      } catch {
        // Preserve the original rendering or cancellation error.
      }
    }
    if (signal.aborted) {
      return { status: 'cancelled', completedFrames, totalFrames }
    }
    throw error
  } finally {
    if (captureStarted) endCapture?.()
  }
}

export async function saveTransparentMov({
  jobId,
  fileHandle,
  signal,
  performance,
  fetcher = fetch,
}: {
  jobId: string
  fileHandle: OverlayFileSystemFileHandle
  signal?: AbortSignal
  performance?: ExportPerformance
  fetcher?: Fetcher
}) {
  const save = async () => {
    const response = await requireOk(
      await fetcher(
        `${API_PREFIX}/jobs/${encodeURIComponent(jobId)}/file`,
      ),
    )
    if (!response.body) throw new Error('本地导出服务没有返回 MOV 文件')

    const writable = await fileHandle.createWritable()
    const reader = response.body.getReader()
    try {
      while (true) {
        if (signal?.aborted) {
          throw new DOMException('导出已取消', 'AbortError')
        }
        const { done, value } = await reader.read()
        if (done) break
        await writable.write(value)
        if (signal?.aborted) {
          throw new DOMException('导出已取消', 'AbortError')
        }
      }
      await writable.close()
    } catch (error) {
      await reader.cancel().catch(() => undefined)
      await writable.abort?.()
      throw error
    } finally {
      reader.releaseLock()
    }

    await discardTransparentMov(jobId, fetcher)
  }

  if (performance) {
    await performance.measure('saving', save)
  } else {
    await save()
  }
}
