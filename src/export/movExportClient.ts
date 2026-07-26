import type { OverlayFileSystemFileHandle } from './fileSystemAccess'
import {
  calculateFrameCount,
  calculateFrameTime,
  EXPORT_FPS,
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
} from './frameMath'
import type { ExportProgress } from './exportController'

const API_PREFIX = '/__overlay_export__'

type Fetcher = typeof fetch

export interface RenderMovResult {
  status: 'completed' | 'cancelled'
  completedFrames: number
  totalFrames: number
  jobId?: string
  size?: number
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
  fetcher = fetch,
}: {
  duration: number
  captureFrame(time: number): Promise<Blob>
  signal: AbortSignal
  onProgress(progress: ExportProgress): void
  fetcher?: Fetcher
}): Promise<RenderMovResult> {
  const totalFrames = calculateFrameCount(duration)
  let jobId: string | undefined
  let completedFrames = 0

  try {
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

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      if (signal.aborted) break
      const frame = await captureFrame(
        calculateFrameTime(frameIndex, EXPORT_FPS),
      )
      if (signal.aborted) break

      await requireOk(
        await fetcher(
          `${API_PREFIX}/jobs/${encodeURIComponent(jobId)}/frames/${frameIndex}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'image/png' },
            body: frame,
            signal,
          },
        ),
      )
      completedFrames += 1
      onProgress({
        phase: 'rendering',
        completedFrames,
        totalFrames,
      })
    }

    if (signal.aborted || completedFrames !== totalFrames) {
      await discardTransparentMov(jobId, fetcher)
      return { status: 'cancelled', completedFrames, totalFrames }
    }

    onProgress({
      phase: 'encoding',
      completedFrames,
      totalFrames,
    })
    const finished = await requireOk(
      await fetcher(
        `${API_PREFIX}/jobs/${encodeURIComponent(jobId)}/finish`,
        { method: 'POST', signal },
      ),
    )
    const body = (await finished.json()) as { size?: unknown }
    return {
      status: 'completed',
      jobId,
      completedFrames,
      totalFrames,
      size: typeof body.size === 'number' ? body.size : undefined,
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
  }
}

export async function saveTransparentMov({
  jobId,
  fileHandle,
  signal,
  fetcher = fetch,
}: {
  jobId: string
  fileHandle: OverlayFileSystemFileHandle
  signal?: AbortSignal
  fetcher?: Fetcher
}) {
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
