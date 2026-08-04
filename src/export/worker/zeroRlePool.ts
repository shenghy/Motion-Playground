interface CompressionWorker {
  postMessage(message: unknown, transfer: Transferable[]): void
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  terminate(): void
}

const browserWorkerFactory = (): CompressionWorker => new Worker(
  new URL('./zeroRleCompression.worker.ts', import.meta.url),
  { type: 'module', name: 'rgba-rle-compressor' },
)

export function createZeroRleWorkerPool(
  size = 2,
  createWorker: () => CompressionWorker = browserWorkerFactory,
) {
  const workers = Array.from({ length: size }, createWorker)
  const pending = new Map<number, {
    resolve(value: Uint8Array<ArrayBuffer>): void
    reject(reason: unknown): void
  }>()
  let nextId = 0
  let nextWorker = 0

  for (const worker of workers) {
    worker.addEventListener('message', (event: MessageEvent<{
      id: number
      compressed: ArrayBuffer
      error?: string
    }>) => {
      const operation = pending.get(event.data.id)
      if (!operation) return
      pending.delete(event.data.id)
      if (event.data.error) operation.reject(new Error(event.data.error))
      else operation.resolve(new Uint8Array(event.data.compressed))
    })
  }

  return {
    compress(pixels: Uint8ClampedArray) {
      const id = nextId++
      const worker = workers[nextWorker]
      nextWorker = (nextWorker + 1) % workers.length
      return new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
        pending.set(id, { resolve, reject })
        worker.postMessage({ id, pixels: pixels.buffer }, [pixels.buffer])
      })
    },
    close() {
      for (const worker of workers) worker.terminate()
      for (const operation of pending.values()) {
        operation.reject(new Error('RGBA RLE 压缩池已关闭'))
      }
      pending.clear()
    },
  }
}
