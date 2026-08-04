import { describe, expect, it, vi } from 'vitest'
import type { CanvasExportSession } from '../canvas/CanvasExportSurface'
import {
  createRawMovExportWorkerRuntime,
  type WorkerExportSocket,
} from './rawMovExport.worker'

class FakeSocket implements WorkerExportSocket {
  readyState = 0
  bufferedAmount = 0
  sent: (ArrayBuffer | string)[] = []
  private listeners = new Map<string, Set<(event: Event | MessageEvent) => void>>()

  addEventListener(type: string, listener: (event: Event | MessageEvent) => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: (event: Event | MessageEvent) => void) {
    this.listeners.get(type)?.delete(listener)
  }

  emit(type: string, event: Event | MessageEvent = new Event(type)) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }

  send(data: ArrayBuffer | string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = 3
  }
}

function workerSession(totalFrames: number) {
  const frameTimes: number[] = []
  const pixels = Array.from(
    { length: totalFrames },
    (_, index) => new Uint8ClampedArray([index, 2, 3, 4]),
  )
  let currentFrame = 0
  const session: CanvasExportSession = {
    begin: vi.fn(async () => undefined),
    renderFrame: vi.fn((time) => {
      frameTimes.push(time)
      currentFrame = Math.round(time * 30)
    }),
    readRgba: vi.fn(() => pixels[currentFrame]),
    capturePng: vi.fn(),
    end: vi.fn(),
  }
  return { session, frameTimes, pixels }
}

describe('raw MOV export worker runtime', () => {
  it('prepares first, keeps three direct rgba buffers in flight, and completes once', async () => {
    const socket = new FakeSocket()
    const { session, frameTimes, pixels } = workerSession(4)
    const events: unknown[] = []
    const runtime = createRawMovExportWorkerRuntime({
      origin: 'http://localhost:4173',
      postEvent: (event) => events.push(event),
      prepareSession: async () => session,
      createSocket: () => {
        queueMicrotask(() => {
          socket.readyState = 1
          socket.emit('open')
        })
        return socket
      },
      now: (() => {
        let value = 0
        return () => ++value
      })(),
    })

    await runtime.handleMessage({
      type: 'prepare',
      cards: [],
      duration: 4 / 30,
      windowSize: 3,
    })
    expect(events).toEqual([{ type: 'ready' }])

    const operation = runtime.handleMessage({
      type: 'start',
      jobId: 'job-1',
      socketUrl: 'ws://localhost:4173/jobs/job-1/raw',
    })
    await vi.waitFor(() => {
      expect(socket.sent.filter((item) => item instanceof ArrayBuffer)).toHaveLength(3)
    })
    expect(socket.sent.slice(0, 3)).toEqual(pixels.slice(0, 3).map((item) => item.buffer))

    for (let frameIndex = 0; frameIndex < 4; frameIndex += 1) {
      socket.emit('message', new MessageEvent('message', {
        data: JSON.stringify({ type: 'frame-accepted', frameIndex }),
      }))
      if (frameIndex === 0) {
        await vi.waitFor(() => {
          expect(socket.sent.filter((item) => item instanceof ArrayBuffer)).toHaveLength(4)
        })
      }
    }
    await vi.waitFor(() => expect(socket.sent).toContain('{"type":"finish"}'))
    socket.emit('message', new MessageEvent('message', {
      data: JSON.stringify({ type: 'completed', size: 123, encodingMs: 45 }),
    }))
    await operation

    expect(frameTimes).toEqual([0, 1 / 30, 2 / 30, 3 / 30])
    expect(events.filter((event) => (
      event as { type?: string }
    ).type === 'progress')).toHaveLength(4)
    expect(events.at(-1)).toMatchObject({
      type: 'completed',
      size: 123,
      encodingMs: 45,
    })
    expect(events.filter((event) => ['completed', 'cancelled', 'error'].includes(
      (event as { type?: string }).type ?? '',
    ))).toHaveLength(1)
  })

  it('rejects a discontinuous acknowledgement with one error event', async () => {
    const socket = new FakeSocket()
    const { session } = workerSession(1)
    const events: { type: string; message?: string }[] = []
    const runtime = createRawMovExportWorkerRuntime({
      origin: 'http://localhost:4173',
      postEvent: (event) => events.push(event as typeof events[number]),
      prepareSession: async () => session,
      createSocket: () => {
        queueMicrotask(() => {
          socket.readyState = 1
          socket.emit('open')
        })
        return socket
      },
    })
    await runtime.handleMessage({ type: 'prepare', cards: [], duration: 1 / 30, windowSize: 3 })
    const operation = runtime.handleMessage({
      type: 'start',
      jobId: 'job-1',
      socketUrl: 'ws://localhost:4173/jobs/job-1/raw',
    })
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1))
    socket.emit('message', new MessageEvent('message', {
      data: JSON.stringify({ type: 'frame-accepted', frameIndex: 7 }),
    }))
    await operation

    expect(events.at(-1)).toMatchObject({ type: 'error' })
    expect(events.at(-1)?.message).toContain('确认帧不连续')
    expect(events.filter((event) => ['completed', 'cancelled', 'error'].includes(event.type))).toHaveLength(1)
  })
})
