import { describe, expect, it, vi } from 'vitest'
import { renderTransparentMovRaw } from './rawMovClient'

class FakeSocket {
  sent: Array<ArrayBuffer | string> = []
  listeners = new Map<string, Set<(event: Event | MessageEvent) => void>>()
  readyState = 0

  addEventListener(type: string, listener: (event: Event | MessageEvent) => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: (event: Event | MessageEvent) => void) {
    this.listeners.get(type)?.delete(listener)
  }

  send(data: ArrayBuffer | string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = 3
    this.emit('close', new Event('close'))
  }

  open() {
    this.readyState = 1
    this.emit('open', new Event('open'))
  }

  receive(value: unknown) {
    this.emit('message', new MessageEvent('message', {
      data: JSON.stringify(value),
    }))
  }

  emit(type: string, event: Event | MessageEvent) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function jsonResponse(value: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('raw transparent MOV client', () => {
  it('keeps exactly one rgba frame in flight and reports acknowledgements', async () => {
    const socket = new FakeSocket()
    const requests: Array<{ url: string; method: string; body?: string }> = []
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : undefined,
      })
      return jsonResponse({ id: 'raw-job' }, { status: 201 })
    })
    const renderFrame = vi.fn((time: number) => {
      void time
      return new Uint8ClampedArray(8_294_400)
    })
    const progress: number[] = []
    const operation = renderTransparentMovRaw({
      duration: 2 / 30,
      renderFrame,
      signal: new AbortController().signal,
      onProgress: (value) => {
        if (value.phase === 'rendering') progress.push(value.completedFrames)
      },
      fetcher,
      createSocket: () => {
        queueMicrotask(() => socket.open())
        return socket
      },
    })

    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    expect(new DataView(socket.sent[0] as ArrayBuffer).getUint32(0)).toBe(0)
    expect(renderFrame).toHaveBeenCalledTimes(1)

    socket.receive({ type: 'frame-accepted', frameIndex: 0 })
    await vi.waitFor(() => expect(socket.sent).toHaveLength(2))
    expect(new DataView(socket.sent[1] as ArrayBuffer).getUint32(0)).toBe(1)
    expect(renderFrame).toHaveBeenCalledTimes(2)

    socket.receive({ type: 'frame-accepted', frameIndex: 1 })
    await vi.waitFor(() => expect(socket.sent).toHaveLength(3))
    expect(socket.sent[2]).toBe(JSON.stringify({ type: 'finish' }))
    socket.receive({ type: 'completed', size: 321, encodingMs: 25 })

    await expect(operation).resolves.toEqual({
      status: 'completed',
      jobId: 'raw-job',
      completedFrames: 2,
      totalFrames: 2,
      size: 321,
      encodingMs: 25,
    })
    expect(progress).toEqual([1, 2])
    expect(renderFrame.mock.calls.map(([time]) => time)).toEqual([0, 1 / 30])
    expect(JSON.parse(requests[0].body ?? '{}')).toMatchObject({
      transport: 'raw-rgba',
      totalFrames: 2,
    })
  })

  it('cancels the server job while waiting for a frame acknowledgement', async () => {
    const socket = new FakeSocket()
    const controller = new AbortController()
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/jobs') && init?.method === 'POST') {
        return jsonResponse({ id: 'cancel-job' }, { status: 201 })
      }
      return new Response(null, { status: 204 })
    })
    const endCapture = vi.fn()
    const operation = renderTransparentMovRaw({
      duration: 1,
      renderFrame: () => new Uint8ClampedArray(8_294_400),
      signal: controller.signal,
      onProgress: vi.fn(),
      fetcher,
      beginCapture: vi.fn(async () => undefined),
      endCapture,
      createSocket: () => {
        queueMicrotask(() => socket.open())
        return socket
      },
    })

    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    controller.abort()

    await expect(operation).resolves.toMatchObject({
      status: 'cancelled',
      completedFrames: 0,
    })
    expect(fetcher).toHaveBeenLastCalledWith(
      '/__overlay_export__/jobs/cancel-job',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(endCapture).toHaveBeenCalledTimes(1)
  })

  it('rejects a stale acknowledgement and discards the job', async () => {
    const socket = new FakeSocket()
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/jobs') && init?.method === 'POST') {
        return jsonResponse({ id: 'stale-job' }, { status: 201 })
      }
      return new Response(null, { status: 204 })
    })
    const operation = renderTransparentMovRaw({
      duration: 1 / 30,
      renderFrame: () => new Uint8ClampedArray(8_294_400),
      signal: new AbortController().signal,
      onProgress: vi.fn(),
      fetcher,
      createSocket: () => {
        queueMicrotask(() => socket.open())
        return socket
      },
    })
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    socket.receive({ type: 'frame-accepted', frameIndex: 9 })
    await expect(operation).rejects.toThrow('确认帧序号不连续')
    expect(fetcher).toHaveBeenLastCalledWith(
      '/__overlay_export__/jobs/stale-job',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
