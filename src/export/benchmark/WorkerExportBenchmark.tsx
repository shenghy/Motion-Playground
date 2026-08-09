/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react'
import { motionRegistry, resolveMotionBounds } from '../../motion/registry'
import type { OverlayCard } from '../../timeline/types'
import { createCanvasExportSession } from '../canvas/CanvasExportSurface'
import { resolveCanvasRenderer } from '../canvas/rendererRegistry'
import {
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
} from '../frameMath'
import { loadWorkerFonts } from '../worker/fonts'
import { createExportPerformance } from '../exportPerformance'
import { renderTransparentMovWorker } from '../worker/workerMovClient'
import {
  findVisiblePixelBounds,
  unionCanvasFrameRects,
} from '../canvas/frameBounds'
import type { CanvasFrameRect } from '../canvas/types'

export type BenchmarkMode = 'short' | 'long'

const FRAME_COUNTS: Record<BenchmarkMode, number> = {
  short: 300,
  long: 11_248,
}

function shortTiming(index: number) {
  const start = (index * 1.5) % 8
  return { start, end: Math.min(10, start + 2.5) }
}

interface BenchmarkState {
  status: 'running' | 'completed' | 'error'
  mode: BenchmarkMode
  stage: string
  completedFrames?: number
  totalFrames: number
  jobId?: string
  size?: number
  encodingMs?: number
  elapsedMs?: number
  fps?: number
  phases?: unknown
  paritySamples?: number
  parityDiff?: {
    maxChangedRatio: number
    maxMeanAbsoluteError: number
    maxChannelDelta: number
  }
  observedBounds?: Record<string, CanvasFrameRect>
  pipelineWindow: 3
  message?: string
}

declare global {
  interface Window {
    __WORKER_EXPORT_BENCHMARK__?: BenchmarkState
  }
}

export function resolveBenchmarkMode(params: URLSearchParams): BenchmarkMode {
  return params.get('mode') === 'long' ? 'long' : 'short'
}

export function benchmarkFrameCount(mode: BenchmarkMode) {
  return FRAME_COUNTS[mode]
}

export function createBenchmarkCards(mode: BenchmarkMode): OverlayCard[] {
  const cards = motionRegistry.map((definition, index) => {
    const timing = shortTiming(index)
    return {
      id: `benchmark-${definition.id}`,
      motionId: definition.id,
      start: timing.start,
      end: timing.end,
      position: {
        x: index % 2 === 0 ? -1 : 1,
        y: index % 3 === 0 ? -1 : 1,
      },
      zIndex: index,
      params: { ...definition.defaults },
    }
  })

  if (mode === 'long') {
    const definition = motionRegistry[0]
    cards.push({
      id: 'benchmark-persistent-metric',
      motionId: definition.id,
      start: 10,
      end: FRAME_COUNTS.long / 30,
      position: { x: 0, y: 0 },
      zIndex: 0,
      params: { ...definition.defaults },
    })
  }
  return cards
}

function nextWorkerMessage(worker: Worker) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
    }
    const onMessage = (event: MessageEvent<unknown>) => {
      cleanup()
      resolve(event.data as Record<string, unknown>)
    }
    const onError = () => {
      cleanup()
      reject(new Error('Canvas 一致性 Worker 失败'))
    }
    worker.addEventListener('message', onMessage, { once: true })
    worker.addEventListener('error', onError, { once: true })
  })
}

function requireAlpha(pixels: Uint8ClampedArray, label: string) {
  let visible = false
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] !== 0) {
      visible = true
      break
    }
  }
  if (!visible) throw new Error(`Canvas 一致性样本没有可见 Alpha：${label}`)
  const cornerAlpha = [
    3,
    (EXPORT_WIDTH - 1) * 4 + 3,
    (EXPORT_HEIGHT - 1) * EXPORT_WIDTH * 4 + 3,
    (EXPORT_HEIGHT * EXPORT_WIDTH - 1) * 4 + 3,
  ]
  if (cornerAlpha.some((index) => pixels[index] !== 0)) {
    throw new Error(`Canvas 一致性样本四角必须透明：${label}`)
  }
}

async function verifyCanvasParity() {
  const worker = new Worker(
    new URL('./canvasParity.worker.ts', import.meta.url),
    { type: 'module', name: 'canvas-export-parity' },
  )
  try {
    const readyPromise = nextWorkerMessage(worker)
    worker.postMessage({ type: 'prepare' })
    const ready = await readyPromise
    if (ready.type !== 'ready') throw new Error('Canvas 一致性 Worker 未准备')
    const resources = await loadWorkerFonts(document.fonts, FontFace)
    const samples = motionRegistry.flatMap((definition) => {
      const duration = typeof definition.defaults.duration === 'number'
        ? definition.defaults.duration
        : 3
      return [
        0.25,
        Math.max(0.8, duration * 0.25),
        Math.max(1.8, duration * 0.65),
        Math.max(2.5, duration - 0.3),
      ]
        .map((time) => ({
          card: {
            id: `parity-${definition.id}-${time}`,
            motionId: definition.id,
            start: 0,
            end: Math.max(10, duration + 1),
            position: { x: 0, y: 0 },
            zIndex: 0,
            params: { ...definition.defaults },
          } satisfies OverlayCard,
          time,
        }))
    })

    const parityDiff = {
      maxChangedRatio: 0,
      maxMeanAbsoluteError: 0,
      maxChannelDelta: 0,
    }
    const observedBounds: Record<string, CanvasFrameRect> = {}
    for (let id = 0; id < samples.length; id += 1) {
      const sample = samples[id]
      const canvas = document.createElement('canvas')
      const session = createCanvasExportSession({
        canvas,
        cards: [sample.card],
        resolveRenderer: resolveCanvasRenderer,
        fontReady: async () => undefined,
        resources,
      })
      await session.begin()
      session.renderFrame(sample.time)
      const htmlPixels = session.readRgba()
      const sampleLabel = `${sample.card.motionId}@${sample.time}`
      requireAlpha(htmlPixels, `HTML ${sampleLabel}`)
      const observed = findVisiblePixelBounds(
        htmlPixels,
        EXPORT_WIDTH,
        EXPORT_HEIGHT,
      )
      const predicted = resolveMotionBounds(sample.card.motionId)
      if (
        observed.x < predicted.x
        || observed.y < predicted.y
        || observed.x + observed.width > predicted.x + predicted.width
        || observed.y + observed.height > predicted.y + predicted.height
      ) {
        throw new Error(`Canvas ROI 边界没有覆盖可见像素：${sampleLabel}`)
      }
      observedBounds[sample.card.motionId] = observedBounds[sample.card.motionId]
        ? unionCanvasFrameRects(observedBounds[sample.card.motionId], observed)
        : observed

      const responsePromise = nextWorkerMessage(worker)
      worker.postMessage({ type: 'render', id, ...sample })
      const response = await responsePromise
      if (response.type === 'error') throw new Error(String(response.message))
      if (response.type !== 'frame' || response.id !== id || !(response.pixels instanceof ArrayBuffer)) {
        throw new Error('Canvas 一致性 Worker 返回无效帧')
      }
      const workerPixels = new Uint8ClampedArray(response.pixels)
      requireAlpha(workerPixels, `Worker ${sampleLabel}`)
      if (workerPixels.length !== htmlPixels.length) {
        throw new Error('HTML/Worker Canvas 像素长度不一致')
      }
      let changedBytes = 0
      let absoluteError = 0
      let maxChannelDelta = 0
      for (let index = 0; index < htmlPixels.length; index += 1) {
        const delta = Math.abs(htmlPixels[index] - workerPixels[index])
        if (delta !== 0) changedBytes += 1
        absoluteError += delta
        maxChannelDelta = Math.max(maxChannelDelta, delta)
      }
      const changedRatio = changedBytes / htmlPixels.length
      const meanAbsoluteError = absoluteError / htmlPixels.length
      parityDiff.maxChangedRatio = Math.max(
        parityDiff.maxChangedRatio,
        changedRatio,
      )
      parityDiff.maxMeanAbsoluteError = Math.max(
        parityDiff.maxMeanAbsoluteError,
        meanAbsoluteError,
      )
      parityDiff.maxChannelDelta = Math.max(
        parityDiff.maxChannelDelta,
        maxChannelDelta,
      )
      if (changedRatio > 0.005 || meanAbsoluteError > 0.5) {
        throw new Error(
          `HTML/Worker Canvas 差异超限：样本 ${id}，变化字节 `
          + `${(changedRatio * 100).toFixed(4)}%，平均误差 `
          + `${meanAbsoluteError.toFixed(4)}`,
        )
      }
      session.end()
    }
    return { samples: samples.length, parityDiff, observedBounds }
  } finally {
    worker.terminate()
  }
}

export function WorkerExportBenchmark() {
  const search = new URLSearchParams(window.location.search)
  const mode = resolveBenchmarkMode(search)
  const requestedFrames = Number(search.get('frames'))
  const totalFrames = Number.isInteger(requestedFrames) && requestedFrames > 0
    ? requestedFrames
    : benchmarkFrameCount(mode)
  const [state, setState] = useState<BenchmarkState>({
    status: 'running',
    mode,
    stage: 'parity',
    totalFrames,
    pipelineWindow: 3,
  })

  useEffect(() => {
    let active = true
    const publish = (next: BenchmarkState) => {
      window.__WORKER_EXPORT_BENCHMARK__ = next
      if (active) setState(next)
    }
    publish(state)

    void (async () => {
      try {
        const parity = await verifyCanvasParity()
        const paritySamples = parity.samples
        const started = performance.now()
        const performanceTracker = createExportPerformance()
        const duration = totalFrames / 30
        publish({
          status: 'running', mode, stage: 'export', totalFrames,
          paritySamples, parityDiff: parity.parityDiff, pipelineWindow: 3,
          observedBounds: parity.observedBounds,
        })
        const result = await renderTransparentMovWorker({
          cards: createBenchmarkCards(mode),
          duration,
          signal: new AbortController().signal,
          performance: performanceTracker,
          onProgress: (progress) => publish({
            status: 'running', mode, stage: progress.phase,
            completedFrames: progress.completedFrames,
            totalFrames, paritySamples, parityDiff: parity.parityDiff,
            observedBounds: parity.observedBounds,
            pipelineWindow: 3,
            phases: progress.performance?.phases,
          }),
        })
        if (result.status !== 'completed' || !result.jobId) {
          throw new Error('Worker 基准导出被取消')
        }
        const elapsedMs = performance.now() - started
        const snapshot = performanceTracker.snapshot()
        publish({
          status: 'completed', mode, stage: 'completed',
          completedFrames: result.completedFrames,
          totalFrames, jobId: result.jobId, size: result.size,
          encodingMs: result.encodingMs, elapsedMs,
          fps: totalFrames / (elapsedMs / 1000),
          phases: snapshot.phases, paritySamples,
          parityDiff: parity.parityDiff, pipelineWindow: 3,
          observedBounds: parity.observedBounds,
        })
      } catch (error) {
        publish({
          status: 'error', mode, stage: 'error', totalFrames,
          pipelineWindow: 3,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    })()

    return () => {
      active = false
    }
    // The benchmark intentionally runs once for the immutable query snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <pre data-testid="worker-export-benchmark">{JSON.stringify(state, null, 2)}</pre>
}
