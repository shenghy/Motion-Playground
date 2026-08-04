export interface FramePipelineOptions {
  totalFrames: number
  windowSize: number
  maxBufferedBytes: number
  bufferedAmount(): number
  waitForWritable(): Promise<void>
  renderFrame(index: number): Uint8ClampedArray | Promise<Uint8ClampedArray>
  sendFrame(index: number, pixels: Uint8ClampedArray): void
  nextAcknowledgement(): Promise<number>
  onAcknowledged(completedFrames: number): void
  signal: AbortSignal
}

function createAbortError() {
  return new DOMException('导出已取消', 'AbortError')
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw createAbortError()
}

async function waitWithAbort<T>(promise: Promise<T>, signal: AbortSignal) {
  throwIfAborted(signal)

  let rejectForAbort!: (reason: unknown) => void
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectForAbort = reject
  })
  const onAbort = () => rejectForAbort(createAbortError())
  signal.addEventListener('abort', onAbort, { once: true })

  try {
    return await Promise.race([promise, aborted])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

export async function runFramePipeline(options: FramePipelineOptions) {
  const {
    totalFrames,
    windowSize,
    maxBufferedBytes,
    bufferedAmount,
    waitForWritable,
    renderFrame,
    sendFrame,
    nextAcknowledgement,
    onAcknowledged,
    signal,
  } = options

  if (!Number.isInteger(totalFrames) || totalFrames < 0) {
    throw new Error('总帧数必须是非负整数')
  }
  if (!Number.isInteger(windowSize) || windowSize < 1) {
    throw new Error('流水线窗口必须是正整数')
  }

  const inFlight = new Map<number, Uint8ClampedArray>()
  let nextToSend = 0
  let nextToAcknowledge = 0

  while (nextToAcknowledge < totalFrames) {
    throwIfAborted(signal)

    while (nextToSend < totalFrames && inFlight.size < windowSize) {
      throwIfAborted(signal)

      if (bufferedAmount() > maxBufferedBytes) {
        await waitWithAbort(waitForWritable(), signal)
        continue
      }

      const frameIndex = nextToSend
      const pixels = await waitWithAbort(
        Promise.resolve(renderFrame(frameIndex)),
        signal,
      )
      throwIfAborted(signal)

      inFlight.set(frameIndex, pixels)
      sendFrame(frameIndex, pixels)
      nextToSend += 1
    }

    if (inFlight.size === 0) continue

    const acknowledgedFrame = await waitWithAbort(
      nextAcknowledgement(),
      signal,
    )
    if (
      acknowledgedFrame !== nextToAcknowledge ||
      !inFlight.has(acknowledgedFrame)
    ) {
      throw new Error(
        `服务端确认帧不连续：期望 ${nextToAcknowledge}，收到 ${acknowledgedFrame}`,
      )
    }

    inFlight.delete(acknowledgedFrame)
    nextToAcknowledge += 1
    onAcknowledged(nextToAcknowledge)
  }
}
