import type { MotionId, ParameterValues } from '../../motion/types'
import { getCardPlaybackTime } from '../../motion/playbackTiming'
import type { OverlayCard } from '../../timeline/types'
import {
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
  getCardPlaybackState,
} from '../frameMath'
import type {
  CanvasFrameRect,
  CanvasMotionRenderer,
  CanvasRenderResources,
} from './types'
import { resolveCanvasFrameBounds } from './frameBounds'

export interface CanvasExportSession {
  begin(): Promise<void>
  renderFrame(time: number): void
  frameBounds(time: number): CanvasFrameRect
  readRgba(): Uint8ClampedArray
  readRgbaRegion(rect: CanvasFrameRect): Uint8ClampedArray
  capturePng(): Promise<Blob>
  end(): void
}

export interface ExportCanvasSource {
  width: number
  height: number
  getContext(
    contextId: '2d',
    options: { alpha: true; willReadFrequently: true },
  ): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  toBlob?(callback: BlobCallback, type?: string): void
  convertToBlob?(options?: ImageEncodeOptions): Promise<Blob>
}

interface CanvasExportSessionOptions {
  canvas: ExportCanvasSource
  cards: OverlayCard[]
  resolveRenderer(
    motionId: MotionId,
  ): CanvasMotionRenderer<ParameterValues> | undefined
  resolveBounds?(motionId: MotionId): CanvasFrameRect | undefined
  fontReady(): Promise<void>
  resources?: CanvasRenderResources
}

export const DEFAULT_CANVAS_RESOURCES: CanvasRenderResources = {
  width: EXPORT_WIDTH,
  height: EXPORT_HEIGHT,
  displayFont: 'Syne Variable, Noto Sans SC Variable, sans-serif',
  monoFont: 'IBM Plex Mono, Noto Sans SC Variable, monospace',
  contentFont: 'Noto Sans SC Variable, sans-serif',
}

export function createCanvasExportSession({
  canvas,
  cards,
  resolveRenderer,
  fontReady,
  resources = DEFAULT_CANVAS_RESOURCES,
  resolveBounds = () => ({
    x: 0,
    y: 0,
    width: EXPORT_WIDTH,
    height: EXPORT_HEIGHT,
  }),
}: CanvasExportSessionOptions): CanvasExportSession {
  canvas.width = EXPORT_WIDTH
  canvas.height = EXPORT_HEIGHT
  const sourceContext = canvas.getContext('2d', {
    alpha: true,
    willReadFrequently: true,
  })
  if (!sourceContext) throw new Error('浏览器无法创建 Canvas 导出舞台')
  const ctx = sourceContext as unknown as CanvasRenderingContext2D

  const orderedCards = cards
    .map((card, sourceIndex) => ({ card, sourceIndex }))
    .sort((left, right) =>
      left.card.zIndex - right.card.zIndex
      || left.sourceIndex - right.sourceIndex)
  let begun = false

  return {
    async begin() {
      if (begun) return
      await fontReady()
      begun = true
    },
    renderFrame(time) {
      if (!begun) throw new Error('Canvas 导出会话尚未开始')
      ctx.clearRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT)
      for (const { card } of orderedCards) {
        const playback = getCardPlaybackState(card, time)
        if (!playback.active) continue
        const renderer = resolveRenderer(card.motionId)
        if (!renderer) {
          throw new Error(`缺少 Canvas 导出渲染器：${card.motionId}`)
        }
        ctx.save()
        try {
          ctx.translate(
            card.position.x * (EXPORT_WIDTH / 100),
            card.position.y * (EXPORT_HEIGHT / 100),
          )
          renderer({
            ctx,
            params: card.params,
            localTime: getCardPlaybackTime(
              card.motionId,
              card.params,
              playback.localTime,
              card.end - card.start,
            ),
            localDuration: card.end - card.start,
            resources,
          })
        } finally {
          ctx.restore()
        }
      }
    },
    frameBounds(time) {
      if (!begun) throw new Error('Canvas 导出会话尚未开始')
      return resolveCanvasFrameBounds(cards, time, resolveBounds)
    },
    readRgba() {
      if (!begun) throw new Error('Canvas 导出会话尚未开始')
      return ctx.getImageData(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT).data
    },
    readRgbaRegion(rect) {
      if (!begun) throw new Error('Canvas 导出会话尚未开始')
      if (rect.width === 0 || rect.height === 0) return new Uint8ClampedArray(0)
      return ctx.getImageData(rect.x, rect.y, rect.width, rect.height).data
    },
    async capturePng() {
      if (!begun) throw new Error('Canvas 导出会话尚未开始')
      if (canvas.convertToBlob) {
        return canvas.convertToBlob({ type: 'image/png' })
      }
      if (!canvas.toBlob) {
        throw new Error('当前 Canvas 不支持 PNG 捕获')
      }
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob?.((blob) => {
          if (blob) resolve(blob)
          else reject(new Error('生成透明 PNG 帧失败'))
        }, 'image/png')
      })
    },
    end() {
      begun = false
    },
  }
}
