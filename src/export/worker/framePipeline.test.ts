import { describe, expect, it, vi } from 'vitest'
import { runFramePipeline } from './framePipeline'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return
    await Promise.resolve()
  }
  throw new Error('等待条件超时')
}

describe('runFramePipeline', () => {
  it('keeps at most three unacknowledged frames and refills after acknowledgements', async () => {
    const acknowledgements = Array.from({ length: 4 }, () => deferred<number>())
    const sent: number[] = []
    let activeFrames = 0
    let maxActiveFrames = 0

    const pipeline = runFramePipeline({
      totalFrames: 4,
      windowSize: 3,
      maxBufferedBytes: 1024,
      bufferedAmount: () => 0,
      waitForWritable: vi.fn(),
      renderFrame: (index) => new Uint8ClampedArray([index]),
      sendFrame: (index) => {
        sent.push(index)
        activeFrames += 1
        maxActiveFrames = Math.max(maxActiveFrames, activeFrames)
      },
      nextAcknowledgement: () => acknowledgements[sent.length - activeFrames].promise,
      onAcknowledged: () => {
        activeFrames -= 1
      },
      signal: new AbortController().signal,
    })

    await waitFor(() => sent.length === 3)
    expect(sent).toEqual([0, 1, 2])

    acknowledgements[0].resolve(0)
    await waitFor(() => sent.length === 4)
    expect(sent).toEqual([0, 1, 2, 3])

    acknowledgements[1].resolve(1)
    acknowledgements[2].resolve(2)
    acknowledgements[3].resolve(3)
    await pipeline

    expect(maxActiveFrames).toBe(3)
  })

  it('waits for socket writability before rendering another frame', async () => {
    let bufferedBytes = 2048
    const waitForWritable = vi.fn(async () => {
      bufferedBytes = 0
    })
    const renderFrame = vi.fn(() => new Uint8ClampedArray(4))

    const result = runFramePipeline({
      totalFrames: 1,
      windowSize: 3,
      maxBufferedBytes: 1024,
      bufferedAmount: () => bufferedBytes,
      waitForWritable,
      renderFrame,
      sendFrame: vi.fn(),
      nextAcknowledgement: async () => 0,
      onAcknowledged: vi.fn(),
      signal: new AbortController().signal,
    })

    await Promise.resolve()
    expect(waitForWritable).toHaveBeenCalledOnce()
    expect(renderFrame).not.toHaveBeenCalled()

    await result
    expect(renderFrame).toHaveBeenCalledOnce()
  })

  it('rejects skipped or stale acknowledgements', async () => {
    await expect(
      runFramePipeline({
        totalFrames: 2,
        windowSize: 2,
        maxBufferedBytes: 1024,
        bufferedAmount: () => 0,
        waitForWritable: vi.fn(),
        renderFrame: () => new Uint8ClampedArray(4),
        sendFrame: vi.fn(),
        nextAcknowledgement: async () => 1,
        onAcknowledged: vi.fn(),
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('确认帧不连续')
  })

  it('stops before rendering when aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const renderFrame = vi.fn()

    await expect(
      runFramePipeline({
        totalFrames: 1,
        windowSize: 3,
        maxBufferedBytes: 1024,
        bufferedAmount: () => 0,
        waitForWritable: vi.fn(),
        renderFrame,
        sendFrame: vi.fn(),
        nextAcknowledgement: vi.fn(),
        onAcknowledged: vi.fn(),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(renderFrame).not.toHaveBeenCalled()
  })

  it('reports progress only after each frame is acknowledged', async () => {
    const acknowledgement = deferred<number>()
    const onAcknowledged = vi.fn()

    const pipeline = runFramePipeline({
      totalFrames: 1,
      windowSize: 3,
      maxBufferedBytes: 1024,
      bufferedAmount: () => 0,
      waitForWritable: vi.fn(),
      renderFrame: () => new Uint8ClampedArray(4),
      sendFrame: vi.fn(),
      nextAcknowledgement: () => acknowledgement.promise,
      onAcknowledged,
      signal: new AbortController().signal,
    })

    await Promise.resolve()
    expect(onAcknowledged).not.toHaveBeenCalled()
    acknowledgement.resolve(0)
    await pipeline
    expect(onAcknowledged).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('starts three asynchronous frame jobs before waiting for the first result', async () => {
    const renders = Array.from({ length: 3 }, () => deferred<Uint8ClampedArray>())
    const renderFrame = vi.fn((index: number) => renders[index].promise)
    const sent: number[] = []
    const acknowledgement = deferred<number>()
    const pipeline = runFramePipeline({
      totalFrames: 3,
      windowSize: 3,
      maxBufferedBytes: 1024,
      bufferedAmount: () => 0,
      waitForWritable: vi.fn(),
      renderFrame,
      sendFrame: (index) => sent.push(index),
      nextAcknowledgement: () => acknowledgement.promise,
      onAcknowledged: vi.fn(),
      signal: new AbortController().signal,
    })

    await waitFor(() => renderFrame.mock.calls.length === 3)
    expect(sent).toEqual([])
    renders[0].resolve(new Uint8ClampedArray([0]))
    renders[1].resolve(new Uint8ClampedArray([1]))
    renders[2].resolve(new Uint8ClampedArray([2]))
    await waitFor(() => sent.length === 3)
    for (let index = 0; index < 3; index += 1) {
      acknowledgement.resolve(index)
      await Promise.resolve()
    }
    // The shared deferred is enough to prove launch concurrency; abort cleanup.
    void pipeline.catch(() => undefined)
  })
})
