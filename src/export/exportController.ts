import {
  calculateFrameCount,
  calculateFrameTime,
  EXPORT_FPS,
} from './frameMath'
import type {
  OverlayFileSystemDirectoryHandle,
} from './fileSystemAccess'

export interface ExportProgress {
  phase: 'rendering' | 'encoding' | 'saving'
  completedFrames: number
  totalFrames: number
}

export interface ExportResult {
  status: 'completed' | 'cancelled'
  completedFrames: number
  totalFrames: number
  outputName?: string
}

function timestamp(date: Date) {
  const value = (number: number) => String(number).padStart(2, '0')
  return [
    date.getFullYear(),
    value(date.getMonth() + 1),
    value(date.getDate()),
    '-',
    value(date.getHours()),
    value(date.getMinutes()),
    value(date.getSeconds()),
  ].join('')
}

export async function exportPngSequence({
  duration,
  captureFrame,
  chooseDirectory,
  signal,
  onProgress,
  now = () => new Date(),
}: {
  duration: number
  captureFrame(time: number): Promise<Blob>
  chooseDirectory(): Promise<OverlayFileSystemDirectoryHandle>
  signal: AbortSignal
  onProgress(progress: ExportProgress): void
  now?: () => Date
}): Promise<ExportResult> {
  const totalFrames = calculateFrameCount(duration)
  let parent: OverlayFileSystemDirectoryHandle
  try {
    parent = await chooseDirectory()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { status: 'cancelled', completedFrames: 0, totalFrames }
    }
    throw error
  }

  const outputName = `Overlay-PNG-${timestamp(now())}`
  const directory = await parent.getDirectoryHandle(outputName, {
    create: true,
  })
  let completedFrames = 0

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
    if (signal.aborted) break

    const blob = await captureFrame(
      calculateFrameTime(frameIndex, EXPORT_FPS),
    )
    const fileName = `frame_${String(frameIndex + 1).padStart(6, '0')}.png`
    const handle = await directory.getFileHandle(fileName, { create: true })
    const writable = await handle.createWritable()
    try {
      await writable.write(blob)
      await writable.close()
    } catch (error) {
      await writable.abort?.()
      throw error
    }

    completedFrames += 1
    onProgress({
      phase: 'rendering',
      completedFrames,
      totalFrames,
    })
  }

  return {
    status: completedFrames === totalFrames ? 'completed' : 'cancelled',
    completedFrames,
    totalFrames,
    outputName,
  }
}
