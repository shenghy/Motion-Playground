export interface LatestWriteQueue<T> {
  enqueue(value: T): void
  flush(): Promise<void>
  dispose(): void
}

interface Completion {
  promise: Promise<void>
  resolve: () => void
  reject: (error: unknown) => void
}

function createCompletion(): Completion {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

export function createLatestWriteQueue<T>(
  write: (value: T) => Promise<void>,
): LatestWriteQueue<T> {
  let disposed = false
  let running = false
  let hasPending = false
  let pendingValue: T | undefined
  let completion: Completion | null = null

  const drain = async () => {
    running = true
    let firstError: unknown

    while (!disposed && hasPending) {
      const value = pendingValue as T
      hasPending = false
      pendingValue = undefined

      try {
        await write(value)
      } catch (error) {
        firstError ??= error
      }
    }

    running = false
    const finishedCompletion = completion
    completion = null

    if (firstError !== undefined) {
      finishedCompletion?.reject(firstError)
    } else {
      finishedCompletion?.resolve()
    }
  }

  return {
    enqueue(value) {
      if (disposed) {
        return
      }

      pendingValue = value
      hasPending = true
      completion ??= createCompletion()

      if (!running) {
        void drain()
      }
    },

    flush() {
      return completion?.promise ?? Promise.resolve()
    },

    dispose() {
      disposed = true
      hasPending = false
      pendingValue = undefined

      if (!running) {
        completion?.resolve()
        completion = null
      }
    },
  }
}
