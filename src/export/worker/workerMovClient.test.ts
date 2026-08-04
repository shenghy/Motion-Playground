import { describe, expect, it, vi } from 'vitest'
import {
  canUseWorkerMovExport,
  renderTransparentMovWorker,
  supportsWorkerMovPipeline,
  WorkerMovPreparationError,
  type WorkerLike,
} from './workerMovClient'

class FakeWorker implements WorkerLike {
  listeners = new Map<string, Set<(event: Event | MessageEvent) => void>>()
  commands: unknown[] = []
  terminated = false
  failPrepare = false

  addEventListener(type: string, listener: (event: Event | MessageEvent) => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: (event: Event | MessageEvent) => void) {
    this.listeners.get(type)?.delete(listener)
  }

  postMessage(command: unknown) {
    this.commands.push(command)
    const type = (command as { type?: string }).type
    if (type === 'prepare') {
      queueMicrotask(() => this.emitMessage(this.failPrepare
        ? { type: 'error', message: 'OffscreenCanvas unavailable' }
        : { type: 'ready' }))
    }
    if (type === 'start') {
      queueMicrotask(() => {
        this.emitMessage({
          type: 'progress',
          completedFrames: 1,
          totalFrames: 1,
          phases: {
            frameCaptureMs: 5,
            frameTransferMs: 3,
            acknowledgementMs: 2,
            encodingMs: 0,
          },
        })
        this.emitMessage({
          type: 'completed',
          size: 456,
          encodingMs: 7,
          phases: {
            frameCaptureMs: 5,
            frameTransferMs: 3,
            acknowledgementMs: 2,
            encodingMs: 7,
          },
        })
      })
    }
  }

  terminate() {
    this.terminated = true
  }

  emitMessage(data: unknown) {
    const event = new MessageEvent('message', { data })
    for (const listener of this.listeners.get('message') ?? []) listener(event)
  }
}

describe('worker MOV client', () => {
  it('detects all required browser Worker features', () => {
    const features = {
      Worker: class {},
      OffscreenCanvas: class {},
      FontFace: class {},
    }
    expect(canUseWorkerMovExport(features)).toBe(true)
    expect(canUseWorkerMovExport({ ...features, Worker: undefined })).toBe(false)
    expect(canUseWorkerMovExport({ ...features, OffscreenCanvas: undefined })).toBe(false)
    expect(canUseWorkerMovExport({ ...features, FontFace: undefined })).toBe(false)
  })

  it('requires both ordered-v2 and worker server capabilities', () => {
    const base = { mov: true, rawRgba: true, transport: 'websocket' }
    expect(supportsWorkerMovPipeline({
      ...base,
      orderedRawProtocol: 'v2',
      workerPipeline: true,
    })).toBe(true)
    expect(supportsWorkerMovPipeline(base)).toBe(false)
    expect(supportsWorkerMovPipeline({
      ...base,
      orderedRawProtocol: 'v2',
      workerPipeline: false,
    })).toBe(false)
  })

  it('prepares before creating one ordered job and maps progress', async () => {
    const worker = new FakeWorker()
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), init })
      return new Response(JSON.stringify({ id: 'worker-job' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch
    const onProgress = vi.fn()
    const onJobCreated = vi.fn()

    const result = await renderTransparentMovWorker({
      cards: [],
      duration: 1 / 30,
      signal: new AbortController().signal,
      onProgress,
      onJobCreated,
      fetcher,
      createWorker: () => worker,
      pageLocation: new URL('http://localhost:4173/editor'),
    })

    expect(worker.commands.map((command) => (
      command as { type: string }
    ).type)).toEqual(['prepare', 'start'])
    expect(requests).toHaveLength(1)
    expect(JSON.parse(String(requests[0].init?.body))).toMatchObject({
      width: 1920,
      height: 1080,
      fps: 30,
      totalFrames: 1,
      transport: 'raw-rgba-ordered',
    })
    expect(onJobCreated).toHaveBeenCalledExactlyOnceWith('worker-job')
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
      phase: 'rendering',
      completedFrames: 1,
      totalFrames: 1,
    }))
    expect(result).toMatchObject({
      status: 'completed',
      jobId: 'worker-job',
      completedFrames: 1,
      totalFrames: 1,
      size: 456,
      encodingMs: 7,
    })
    expect(worker.terminated).toBe(true)
  })

  it('surfaces preparation failure before creating a server job', async () => {
    const worker = new FakeWorker()
    worker.failPrepare = true
    const fetcher = vi.fn()

    await expect(renderTransparentMovWorker({
      cards: [],
      duration: 1,
      signal: new AbortController().signal,
      onProgress: vi.fn(),
      fetcher: fetcher as typeof fetch,
      createWorker: () => worker,
      pageLocation: new URL('http://localhost:4173/editor'),
    })).rejects.toBeInstanceOf(WorkerMovPreparationError)
    expect(fetcher).not.toHaveBeenCalled()
    expect(worker.terminated).toBe(true)
  })

  it('posts cancellation to an active worker', async () => {
    const worker = new FakeWorker()
    worker.postMessage = function (command: unknown) {
      this.commands.push(command)
      if ((command as { type?: string }).type === 'prepare') {
        queueMicrotask(() => this.emitMessage({ type: 'ready' }))
      }
      if ((command as { type?: string }).type === 'cancel') {
        queueMicrotask(() => this.emitMessage({ type: 'cancelled', completedFrames: 0 }))
      }
    }
    const controller = new AbortController()
    const operation = renderTransparentMovWorker({
      cards: [],
      duration: 1,
      signal: controller.signal,
      onProgress: vi.fn(),
      fetcher: vi.fn(async () => new Response(JSON.stringify({ id: 'job-1' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch,
      createWorker: () => worker,
      pageLocation: new URL('http://localhost:4173/editor'),
    })
    await vi.waitFor(() => expect(worker.commands).toHaveLength(2))
    controller.abort()

    await expect(operation).resolves.toMatchObject({
      status: 'cancelled',
      completedFrames: 0,
    })
    expect(worker.commands.at(-1)).toEqual({ type: 'cancel' })
  })
})
