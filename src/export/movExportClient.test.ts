import { describe, expect, it, vi } from 'vitest'
import type { OverlayFileSystemFileHandle } from './fileSystemAccess'
import {
  discardTransparentMov,
  renderTransparentMov,
  saveTransparentMov,
} from './movExportClient'

function jsonResponse(value: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('transparent MOV client', () => {
  it('renders PNG frames sequentially and finishes one export job', async () => {
    const requests: Array<{ url: string; method: string }> = []
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      requests.push({ url, method })
      if (url.endsWith('/jobs') && method === 'POST') {
        return jsonResponse({ id: 'job-1' }, { status: 201 })
      }
      if (url.endsWith('/finish')) {
        return jsonResponse({ id: 'job-1', size: 321 })
      }
      return new Response(null, { status: 204 })
    })
    const captureFrame = vi.fn(async (time: number) =>
      new Blob([String(time)], { type: 'image/png' }),
    )

    const result = await renderTransparentMov({
      duration: 0.1,
      captureFrame,
      signal: new AbortController().signal,
      onProgress: vi.fn(),
      fetcher,
    })

    expect(requests).toEqual([
      { url: '/__overlay_export__/jobs', method: 'POST' },
      {
        url: '/__overlay_export__/jobs/job-1/frames/0',
        method: 'PUT',
      },
      {
        url: '/__overlay_export__/jobs/job-1/frames/1',
        method: 'PUT',
      },
      {
        url: '/__overlay_export__/jobs/job-1/frames/2',
        method: 'PUT',
      },
      {
        url: '/__overlay_export__/jobs/job-1/finish',
        method: 'POST',
      },
    ])
    expect(captureFrame.mock.calls.map(([time]) => time)).toEqual([
      0,
      1 / 30,
      2 / 30,
    ])
    expect(result).toEqual({
      status: 'completed',
      jobId: 'job-1',
      completedFrames: 3,
      totalFrames: 3,
      size: 321,
    })
  })

  it('cancels the server job without sending another frame', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/jobs') && init?.method === 'POST') {
        return jsonResponse({ id: 'job-cancelled' }, { status: 201 })
      }
      return new Response(null, { status: 204 })
    })

    const result = await renderTransparentMov({
      duration: 1,
      captureFrame: async () => {
        controller.abort()
        return new Blob(['frame'], { type: 'image/png' })
      },
      signal: controller.signal,
      onProgress: vi.fn(),
      fetcher,
    })

    expect(result.status).toBe('cancelled')
    expect(fetcher).toHaveBeenLastCalledWith(
      '/__overlay_export__/jobs/job-cancelled',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('streams the MOV to the chosen file and deletes the completed job', async () => {
    const writes: Array<Blob | BufferSource | string> = []
    const writable = {
      write: vi.fn(async (data: Blob | BufferSource | string) => {
        writes.push(data)
      }),
      close: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined),
    }
    const fileHandle: OverlayFileSystemFileHandle = {
      name: 'overlay.mov',
      createWritable: vi.fn(async () => writable),
    }
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/file')) {
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'Content-Type': 'video/quicktime' },
        })
      }
      return new Response(null, { status: 204 })
    })

    await saveTransparentMov({
      jobId: 'job-1',
      fileHandle,
      fetcher,
    })

    expect(writes).toHaveLength(1)
    expect(Array.from(writes[0] as Uint8Array)).toEqual([1, 2, 3])
    expect(writable.close).toHaveBeenCalled()
    expect(fetcher).toHaveBeenLastCalledWith(
      '/__overlay_export__/jobs/job-1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('keeps the encoded job when saving fails so the user can retry', async () => {
    const writable = {
      write: vi.fn(async () => {
        throw new Error('disk full')
      }),
      close: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined),
    }
    const fileHandle: OverlayFileSystemFileHandle = {
      name: 'overlay.mov',
      createWritable: vi.fn(async () => writable),
    }
    const fetcher = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3])),
    )

    await expect(
      saveTransparentMov({ jobId: 'job-1', fileHandle, fetcher }),
    ).rejects.toThrow('disk full')

    expect(writable.abort).toHaveBeenCalled()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('aborts a file write without deleting the encoded job', async () => {
    const controller = new AbortController()
    const writable = {
      write: vi.fn(async () => {
        controller.abort()
      }),
      close: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined),
    }
    const fileHandle: OverlayFileSystemFileHandle = {
      name: 'overlay.mov',
      createWritable: vi.fn(async () => writable),
    }
    const fetcher = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3])),
    )

    await expect(
      saveTransparentMov({
        jobId: 'job-1',
        fileHandle,
        signal: controller.signal,
        fetcher,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(writable.abort).toHaveBeenCalled()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('can explicitly discard a completed job', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }))

    await discardTransparentMov('job-1', fetcher)

    expect(fetcher).toHaveBeenCalledWith(
      '/__overlay_export__/jobs/job-1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
