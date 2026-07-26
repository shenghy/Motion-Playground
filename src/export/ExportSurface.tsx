import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { toBlob } from 'html-to-image'
import { getMotionDefinition } from '../motion/registry'
import type {
  MotionDefinition,
  ParameterValues,
} from '../motion/types'
import type { OverlayCard } from '../timeline/types'
import {
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
  getCardPlaybackState,
} from './frameMath'

export interface ExportSurfaceHandle {
  prepareFrame(time: number): Promise<void>
  capturePng(): Promise<Blob>
}

interface ExportSurfaceProps {
  cards: OverlayCard[]
}

function nextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

export const ExportSurface = forwardRef<
  ExportSurfaceHandle,
  ExportSurfaceProps
>(function ExportSurface({ cards }, ref) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [frameTime, setFrameTime] = useState<number | null>(null)
  const activeCards =
    frameTime === null
      ? []
      : cards
          .filter((card) => getCardPlaybackState(card, frameTime).active)
          .sort((left, right) => left.zIndex - right.zIndex)

  useImperativeHandle(ref, () => ({
    async prepareFrame(time) {
      setFrameTime(Number.isFinite(time) ? Math.max(0, time) : 0)
      await nextPaint()
      await nextPaint()
      await document.fonts?.ready

      rootRef.current
        ?.querySelectorAll<HTMLElement>('[data-export-card="true"]')
        .forEach((element) => {
          const localTime = Number(element.dataset.playbackTime ?? 0)
          element.getAnimations?.({ subtree: true }).forEach((animation) => {
            animation.pause()
            animation.currentTime = localTime * 1000
          })
        })
    },
    async capturePng() {
      if (!rootRef.current) {
        throw new Error('透明导出舞台尚未准备完成')
      }
      const blob = await toBlob(rootRef.current, {
        width: EXPORT_WIDTH,
        height: EXPORT_HEIGHT,
        pixelRatio: 1,
        backgroundColor: 'transparent',
        cacheBust: false,
      })
      if (!blob) {
        throw new Error('生成透明 PNG 帧失败')
      }
      return blob
    },
  }), [])

  return (
    <div className="export-surface-host" aria-hidden="true">
      <div
        ref={rootRef}
        className="export-surface"
        data-testid="export-surface"
        data-background="transparent"
      >
        {activeCards.map((card) => {
          const definition = getMotionDefinition(
            card.motionId,
          ) as unknown as MotionDefinition<ParameterValues>
          const MotionComponent = definition.component
          const { localTime } = getCardPlaybackState(card, frameTime ?? 0)

          return (
            <div
              key={card.id}
              className="export-card"
              data-testid={`export-card-${card.id}`}
              data-card-id={card.id}
              data-export-card="true"
              data-playback-time={localTime}
              style={{
                transform: `translate(${card.position.x}%, ${card.position.y}%)`,
                zIndex: card.zIndex,
              }}
            >
              <MotionComponent
                params={card.params}
                playbackTime={localTime}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
})
