import { useRef } from 'react'
import type { OverlayCard } from '../timeline/types'

const OVERLAY_MOTION_TYPE = 'application/x-overlay-motion'

interface TimelineEditorProps {
  cards: OverlayCard[]
  duration: number
  currentTime: number
  selectedCardId: string | null
  motionNames: Record<string, string>
  onDropMotion: (motionId: string, startTime: number) => void
  onSelectCard: (cardId: string) => void
  onMoveCard: (cardId: string, startTime: number) => void
  onResizeCard: (
    cardId: string,
    edge: 'start' | 'end',
    time: number,
  ) => void
  onSeek: (time: number) => void
  onDeleteCard: (cardId: string) => void
}

interface PointerGesture {
  cardId: string
  mode: 'move' | 'start' | 'end'
  initialClientX: number
  initialTime: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function percentage(time: number, duration: number) {
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) {
    return 0
  }

  return clamp((time / duration) * 100, 0, 100)
}

export function TimelineEditor({
  cards,
  duration,
  currentTime,
  selectedCardId,
  motionNames,
  onDropMotion,
  onSelectCard,
  onMoveCard,
  onResizeCard,
  onSeek,
  onDeleteCard,
}: TimelineEditorProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pointerGestureRef = useRef<PointerGesture | null>(null)
  const selectedCard = cards.find((card) => card.id === selectedCardId)

  const timeAtClientX = (clientX: number) => {
    const track = trackRef.current
    if (!track || !Number.isFinite(duration) || duration <= 0) {
      return null
    }

    const bounds = track.getBoundingClientRect()
    if (!Number.isFinite(bounds.width) || bounds.width <= 0) {
      return null
    }

    return clamp(((clientX - bounds.left) / bounds.width) * duration, 0, duration)
  }

  const startPointerGesture = (
    event: React.PointerEvent<HTMLElement>,
    gesture: PointerGesture,
  ) => {
    pointerGestureRef.current = gesture
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = pointerGestureRef.current
    const track = trackRef.current
    if (!gesture || !track || !Number.isFinite(duration) || duration <= 0) {
      return
    }

    const bounds = track.getBoundingClientRect()
    if (!Number.isFinite(bounds.width) || bounds.width <= 0) {
      return
    }

    const deltaTime =
      ((event.clientX - gesture.initialClientX) / bounds.width) * duration
    const targetTime = clamp(gesture.initialTime + deltaTime, 0, duration)

    if (gesture.mode === 'move') {
      onMoveCard(gesture.cardId, targetTime)
      return
    }

    onResizeCard(gesture.cardId, gesture.mode, targetTime)
  }

  return (
    <section className="timeline-editor" aria-label="叠加动效时间轴">
      <header className="timeline-editor__header">
        <h2>动效时间轴</h2>
        {selectedCard ? (
          <button
            type="button"
            className="timeline-editor__delete"
            onClick={() => onDeleteCard(selectedCard.id)}
          >
            删除选中片段
          </button>
        ) : null}
      </header>

      {duration <= 0 ? (
        <p className="timeline-editor__status" role="status" aria-live="polite">
          请先导入视频
        </p>
      ) : null}

      <div
        ref={trackRef}
        className="timeline-editor__track"
        data-testid="timeline-track"
        onClick={(event) => {
          if (event.target !== event.currentTarget) {
            return
          }

          const time = timeAtClientX(event.clientX)
          if (time !== null) {
            onSeek(time)
          }
        }}
        onDragOver={(event) => {
          if (Array.from(event.dataTransfer.types).includes(OVERLAY_MOTION_TYPE)) {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }
        }}
        onDrop={(event) => {
          const motionId = event.dataTransfer.getData(OVERLAY_MOTION_TYPE)
          if (!motionId) {
            return
          }

          event.preventDefault()
          const startTime = timeAtClientX(event.clientX)
          if (startTime !== null) {
            onDropMotion(motionId, startTime)
          }
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={() => {
          pointerGestureRef.current = null
        }}
        onPointerCancel={() => {
          pointerGestureRef.current = null
        }}
      >
        {cards.map((card) => {
          const motionName = motionNames[card.motionId] ?? card.motionId
          const left = percentage(card.start, duration)
          const right = percentage(card.end, duration)

          return (
            <div
              key={card.id}
              className={`timeline-editor__card${
                selectedCardId === card.id ? ' timeline-editor__card--selected' : ''
              }`}
              style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}
              role="button"
              tabIndex={0}
              aria-label={`选择${motionName}片段`}
              aria-pressed={selectedCardId === card.id}
              onClick={() => onSelectCard(card.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectCard(card.id)
                }
              }}
              onPointerDown={(event) => {
                startPointerGesture(event, {
                  cardId: card.id,
                  mode: 'move',
                  initialClientX: event.clientX,
                  initialTime: card.start,
                })
              }}
            >
              <button
                type="button"
                className="timeline-editor__handle timeline-editor__handle--start"
                aria-label={`调整${motionName}片段开始时间`}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  startPointerGesture(event, {
                    cardId: card.id,
                    mode: 'start',
                    initialClientX: event.clientX,
                    initialTime: card.start,
                  })
                }}
              />
              <span className="timeline-editor__card-label">{motionName}</span>
              <button
                type="button"
                className="timeline-editor__handle timeline-editor__handle--end"
                aria-label={`调整${motionName}片段结束时间`}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  startPointerGesture(event, {
                    cardId: card.id,
                    mode: 'end',
                    initialClientX: event.clientX,
                    initialTime: card.end,
                  })
                }}
              />
            </div>
          )
        })}

        <div
          className="timeline-editor__playhead"
          data-testid="timeline-playhead"
          style={{ left: `${percentage(currentTime, duration)}%` }}
          aria-hidden="true"
        />
      </div>
    </section>
  )
}
