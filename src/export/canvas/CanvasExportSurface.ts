import type { MotionId, ParameterValues } from '../../motion/types'
import type { OverlayCard } from '../../timeline/types'
import {
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
  getCardPlaybackState,
} from '../frameMath'
import type {
  CanvasMotionRenderer,
  CanvasRenderResources,
} from './types'

export interface CanvasExportSession {
  begin(): Promise<void>
  renderFrame(time: number): void
  readRgba(): Uint8ClampedArray
  capturePng(): Promise<Blob>
  end(): void
}

interface CanvasExportSessionOptions {
  canvas: HTMLCanvasElement
  cards: OverlayCard[]
  resolveRenderer(
    motionId: MotionId,
  ): CanvasMotionRenderer<ParameterValues> | undefined
  fontReady(): Promise<void>
  resources?: CanvasRenderResources
}

export const DEFAULT_CANVAS_RESOURCES: CanvasRenderResources = {
  width: EXPORT_WIDTH,
  height: EXPORT_HEIGHT,
  displayFont: 'Syne Variable, Microsoft YaHei, sans-serif',
  monoFont: 'IBM Plex Mono, Microsoft YaHei, monospace',
  handwritingFont: 'Ma Shan Zheng Local, KaiTi, STKaiti, sans-serif',
}

export function createCanvasExportSession({
  canvas,
  cards,
  resolveRenderer,
  fontReady,
  resources = DEFAULT_CANVAS_RESOURCES,
}: CanvasExportSessionOptions): CanvasExportSession {
  canvas.width = EXPORT_WIDTH
  canvas.height = EXPORT_HEIGHT
  const ctx = canvas.getContext('2d', {
    alpha: true,
    willReadFrequently: true,
  })
  if (!ctx) throw new Error('浏览器无法创建 Canvas 导出舞台')

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
            localTime: playback.localTime,
            resources,
          })
        } finally {
          ctx.restore()
        }
      }
    },
    readRgba() {
      if (!begun) throw new Error('Canvas 导出会话尚未开始')
      return ctx.getImageData(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT).data
    },
    capturePng() {
      if (!begun) {
        return Promise.reject(new Error('Canvas 导出会话尚未开始'))
      }
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
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
