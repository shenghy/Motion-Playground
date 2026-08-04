import { describe, expect, it, vi } from 'vitest'
import { exportPngSequence } from './exportController'
import { createExportPerformance } from './exportPerformance'

function createMemoryDirectory() {
  const files = new Map<string, Blob>()
  const child = {
    name: 'Overlay-PNG-test',
    async getDirectoryHandle() {
      return child
    },
    async getFileHandle(name: string) {
      return {
        name,
        async createWritable() {
          return {
            async write(blob: Blob) {
              files.set(name, blob)
            },
            async close() {},
            async abort() {},
          }
        },
      }
    },
  }
  return { directory: child, files }
}

describe('exportPngSequence', () => {
  it('writes complete frames sequentially with six-digit names', async () => {
    const { directory, files } = createMemoryDirectory()
    const captureFrame = vi.fn(async (time: number) =>
      new Blob([String(time)], { type: 'image/png' }),
    )
    const progress = vi.fn()
    const beginCapture = vi.fn(async () => undefined)
    const endCapture = vi.fn()
    let clock = 0
    const performance = createExportPerformance(() => clock)

    const result = await exportPngSequence({
      duration: 0.1,
      captureFrame: async (time) => {
        clock += 10
        return captureFrame(time)
      },
      chooseDirectory: async () => directory,
      signal: new AbortController().signal,
      onProgress: progress,
      beginCapture,
      endCapture,
      performance,
      now: () => new Date('2026-07-26T08:00:00Z'),
    })

    expect([...files.keys()]).toEqual([
      'frame_000001.png',
      'frame_000002.png',
      'frame_000003.png',
    ])
    expect(captureFrame.mock.calls.map(([time]) => time)).toEqual([
      0,
      1 / 30,
      2 / 30,
    ])
    expect(result).toMatchObject({
      status: 'completed',
      completedFrames: 3,
    })
    expect(progress).toHaveBeenLastCalledWith({
      phase: 'rendering',
      completedFrames: 3,
      totalFrames: 3,
      performance: expect.objectContaining({
        completedFrames: 3,
        totalFrames: 3,
        framesPerSecond: 100,
      }),
    })
    expect(beginCapture).toHaveBeenCalledTimes(1)
    expect(endCapture).toHaveBeenCalledTimes(1)
  })

  it('stops before the next frame after cancellation', async () => {
    const { directory, files } = createMemoryDirectory()
    const controller = new AbortController()
    const endCapture = vi.fn()

    const result = await exportPngSequence({
      duration: 1,
      captureFrame: async () => {
        controller.abort()
        return new Blob(['frame'], { type: 'image/png' })
      },
      chooseDirectory: async () => directory,
      signal: controller.signal,
      onProgress: vi.fn(),
      beginCapture: async () => undefined,
      endCapture,
    })

    expect(files.size).toBe(1)
    expect(result.status).toBe('cancelled')
    expect(endCapture).toHaveBeenCalledTimes(1)
  })
})
