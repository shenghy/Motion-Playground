import { describe, expect, it, vi } from 'vitest'
import { createLatestWriteQueue } from './latestWriteQueue'

function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

describe('createLatestWriteQueue', () => {
  it('serializes writes and coalesces pending values to the latest snapshot', async () => {
    const first = deferred()
    const third = deferred()
    const writes: number[] = []
    const queue = createLatestWriteQueue(async (value: number) => {
      writes.push(value)
      await (value === 1 ? first.promise : third.promise)
    })

    queue.enqueue(1)
    queue.enqueue(2)
    queue.enqueue(3)

    expect(writes).toEqual([1])

    first.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(writes).toEqual([1, 3])

    third.resolve()
    await expect(queue.flush()).resolves.toBeUndefined()
  })

  it('reports a failed cycle and accepts a newer write afterwards', async () => {
    const write = vi
      .fn<(value: number) => Promise<void>>()
      .mockRejectedValueOnce(new Error('quota'))
      .mockResolvedValueOnce()
    const queue = createLatestWriteQueue(write)

    queue.enqueue(1)
    await expect(queue.flush()).rejects.toThrow('quota')

    queue.enqueue(2)
    await expect(queue.flush()).resolves.toBeUndefined()
    expect(write).toHaveBeenNthCalledWith(1, 1)
    expect(write).toHaveBeenNthCalledWith(2, 2)
  })

  it('drops a pending value on dispose but lets the active write finish', async () => {
    const first = deferred()
    const writes: number[] = []
    const queue = createLatestWriteQueue(async (value: number) => {
      writes.push(value)
      await first.promise
    })

    queue.enqueue(1)
    queue.enqueue(2)
    queue.dispose()
    first.resolve()

    await expect(queue.flush()).resolves.toBeUndefined()
    expect(writes).toEqual([1])

    queue.enqueue(3)
    await expect(queue.flush()).resolves.toBeUndefined()
    expect(writes).toEqual([1])
  })
})
