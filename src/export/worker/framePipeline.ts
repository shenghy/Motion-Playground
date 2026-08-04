export interface FramePipelineOptions<TFrame extends ArrayBufferView = Uint8ClampedArray> {
  totalFrames: number
  windowSize: number
  maxBufferedBytes: number
  bufferedAmount(): number
  waitForWritable(): Promise<void>
  renderFrame(index: number): TFrame | Promise<TFrame>
  sendFrame(index: number, pixels: TFrame): void
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

export async function runFramePipeline<TFrame extends ArrayBufferView>(
  options: FramePipelineOptions<TFrame>,
) {
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

  const pendingFrames = new Map<number, Promise<TFrame>>()
  const inFlight = new Map<number, TFrame>()
  let nextToRender = 0
  let nextToSend = 0
  let nextToAcknowledge = 0

  while (nextToAcknowledge < totalFrames) {
    throwIfAborted(signal)

    while (
      nextToRender < totalFrames
      && pendingFrames.size + inFlight.size < windowSize
    ) {
      throwIfAborted(signal)

      if (bufferedAmount() > maxBufferedBytes) {
        if (pendingFrames.size === 0 && inFlight.size === 0) {
          await waitWithAbort(waitForWritable(), signal)
          continue
        }
        break
      }

      const frameIndex = nextToRender
      pendingFrames.set(frameIndex, Promise.resolve(renderFrame(frameIndex)))
      nextToRender += 1
    }

    while (pendingFrames.has(nextToSend) && inFlight.size < windowSize) {
      const frameIndex = nextToSend
      const pixels = await waitWithAbort(pendingFrames.get(frameIndex)!, signal)
      throwIfAborted(signal)
      pendingFrames.delete(frameIndex)
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
