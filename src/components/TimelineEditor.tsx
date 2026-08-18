import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { isMotionId, type MotionId } from '../motion/types'
import { MIN_CARD_DURATION } from '../timeline/project'
import type { OverlayCard } from '../timeline/types'

const OVERLAY_MOTION_TYPE = 'application/x-overlay-motion'
const FALLBACK_TIMELINE_COLOR = '#777A7D'
const WHEEL_ZOOM_FACTOR = 0.8
const MIN_VIEW_SPAN = 1
const MAX_TICK_COUNT = 12
const TICK_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800]

interface TimelineView {
  start: number
  span: number
}

interface TimelineEditorProps {
  cards: OverlayCard[]
  duration: number
  currentTime: number
  selectedCardId: string | null
  motionNames: Partial<Record<MotionId, string>>
  motionColors: Partial<Record<MotionId, string>>
  onDropMotion: (motionId: MotionId, startTime: number) => void
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
  pointerId: number
  initialClientX: number
  initialTime: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function normalizeView(view: TimelineView | null, duration: number): TimelineView {
  if (
    !view ||
    !Number.isFinite(view.start) ||
    !Number.isFinite(view.span) ||
    view.span >= duration
  ) {
    return { start: 0, span: duration }
  }

  const span = Math.max(view.span, Math.min(MIN_VIEW_SPAN, duration))
  return { span, start: clamp(view.start, 0, duration - span) }
}

function percentage(time: number, view: TimelineView) {
  if (!Number.isFinite(time) || !Number.isFinite(view.span) || view.span <= 0) {
    return 0
  }

  return clamp(((time - view.start) / view.span) * 100, 0, 100)
}

function getTickStep(span: number) {
  for (const step of TICK_STEPS) {
    if (span / step <= MAX_TICK_COUNT) {
      return step
    }
  }

  return TICK_STEPS[TICK_STEPS.length - 1] ?? 1
}

function formatTimeLabel(time: number, step: number) {
  if (time < 60) {
    const decimals = step < 1 || !Number.isInteger(time) ? 1 : 0
    return `${time.toFixed(decimals)}s`
  }

  const minutes = Math.floor(time / 60)
  const seconds = Math.round(time % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function getTimelineTicks(view: TimelineView) {
  const step = getTickStep(view.span)
  const ticks: { key: string; position: number; label: string }[] = []
  const first = Math.ceil(view.start / step) * step
  const last = view.start + view.span

  for (let time = first; time <= last + step / 1000; time += step) {
    const safeTime = Math.round(time * 1000) / 1000
    ticks.push({
      key: safeTime.toFixed(3),
      position: percentage(safeTime, view),
      label: formatTimeLabel(safeTime, step),
    })
  }

  return ticks
}

export function TimelineEditor({
  cards,
  duration,
  currentTime,
  selectedCardId,
  motionNames,
  motionColors,
  onDropMotion,
  onSelectCard,
  onMoveCard,
  onResizeCard,
  onSeek,
  onDeleteCard,
}: TimelineEditorProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const pointerGestureRef = useRef<PointerGesture | null>(null)
  const [viewState, setViewState] = useState<{
    forDuration: number
    view: TimelineView | null
  }>({ forDuration: Number.NaN, view: null })
  const selectedCard = cards.find((card) => card.id === selectedCardId)
  const hasUsableDuration =
    Number.isFinite(duration) && duration >= MIN_CARD_DURATION
  const requestedView =
    viewState.forDuration === duration ? viewState.view : null
  const view = hasUsableDuration
    ? normalizeView(requestedView, duration)
    : { start: 0, span: 0 }
  const isZoomed = hasUsableDuration && view.span < duration - 1e-6
  const ticks = hasUsableDuration ? getTimelineTicks(view) : []

  const applyView = (next: TimelineView | null) => {
    setViewState({ forDuration: duration, view: next })
  }

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      const track = trackRef.current
      if (!track || !hasUsableDuration) {
        return
      }

      const bounds = track.getBoundingClientRect()
      if (!Number.isFinite(bounds.width) || bounds.width <= 0) {
        return
      }

      event.preventDefault()
      setViewState((current) => {
        const previous =
          current.forDuration === duration ? current.view : null
        const base = normalizeView(previous, duration)
        const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY)

        if (horizontal || event.shiftKey) {
          const panDelta = horizontal ? event.deltaX : event.deltaY
          const offset = (panDelta / bounds.width) * base.span
          return {
            forDuration: duration,
            view: {
              span: base.span,
              start: clamp(base.start + offset, 0, duration - base.span),
            },
          }
        }

        const zoomIn = event.deltaY < 0
        const pointerRatio = clamp(
          (event.clientX - bounds.left) / bounds.width,
          0,
          1,
        )
        const anchorTime = base.start + pointerRatio * base.span
        const nextSpan = clamp(
          base.span * (zoomIn ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR),
          Math.min(MIN_VIEW_SPAN, duration),
          duration,
        )

        if (nextSpan >= duration) {
          return { forDuration: duration, view: null }
        }

        return {
          forDuration: duration,
          view: {
            span: nextSpan,
            start: clamp(
              anchorTime - pointerRatio * nextSpan,
              0,
              duration - nextSpan,
            ),
          },
        }
      })
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [duration, hasUsableDuration])

  const timeAtClientX = (clientX: number) => {
    const track = trackRef.current
    if (!track || !hasUsableDuration) {
      return null
    }

    const bounds = track.getBoundingClientRect()
    if (!Number.isFinite(bounds.width) || bounds.width <= 0) {
      return null
    }

    return clamp(
      ((clientX - bounds.left) / bounds.width) * view.span + view.start,
      0,
      duration,
    )
  }

  const startPointerGesture = (
    event: React.PointerEvent<HTMLElement>,
    gesture: PointerGesture,
  ) => {
    if (
      !hasUsableDuration ||
      (pointerGestureRef.current !== null &&
        pointerGestureRef.current.pointerId !== gesture.pointerId)
    ) {
      return
    }

    pointerGestureRef.current = gesture
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = pointerGestureRef.current
    const track = trackRef.current
    if (
      !gesture ||
      gesture.pointerId !== event.pointerId ||
      !track ||
      !hasUsableDuration
    ) {
      return
    }

    const bounds = track.getBoundingClientRect()
    if (!Number.isFinite(bounds.width) || bounds.width <= 0) {
      return
    }

    const deltaTime =
      ((event.clientX - gesture.initialClientX) / bounds.width) * view.span
    const targetTime = clamp(gesture.initialTime + deltaTime, 0, duration)

    if (gesture.mode === 'move') {
      onMoveCard(gesture.cardId, targetTime)
      return
    }

    onResizeCard(gesture.cardId, gesture.mode, targetTime)
  }

  const clearPointerGesture = (pointerId: number) => {
    if (pointerGestureRef.current?.pointerId === pointerId) {
      pointerGestureRef.current = null
    }
  }

  const handleResizeKey = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    card: OverlayCard,
    edge: 'start' | 'end',
  ) => {
    if (
      !hasUsableDuration ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    ) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const step = Math.max(0.1, duration / 100)
    const direction = event.key === 'ArrowLeft' ? -1 : 1
    const current = edge === 'start' ? card.start : card.end
    onResizeCard(card.id, edge, clamp(current + direction * step, 0, duration))
  }

  return (
    <section className="timeline-editor" aria-label="叠加动效时间轴">
      <header className="timeline-editor__header">
        <h2>动效时间轴</h2>
        <div className="timeline-editor__header-actions">
          {isZoomed ? (
            <>
              <span
                className="timeline-editor__zoom-label"
                data-testid="timeline-zoom-label"
              >
                {formatTimeLabel(view.start, view.span)} –{' '}
                {formatTimeLabel(view.start + view.span, view.span)}
              </span>
              <button
                type="button"
                className="timeline-editor__zoom-reset"
                onClick={() => applyView(null)}
              >
                重置缩放
              </button>
            </>
          ) : null}
          {selectedCard ? (
            <button
              type="button"
              className="timeline-editor__delete"
              onClick={() => onDeleteCard(selectedCard.id)}
            >
              删除选中片段
            </button>
          ) : null}
        </div>
      </header>

      <div
        ref={viewportRef}
        className="timeline-editor__viewport"
        title="滚轮缩放时间刻度 · Shift+滚轮平移"
      >
        <div
          className="timeline-editor__ruler"
          data-testid="timeline-ruler"
          aria-hidden="true"
        >
          {ticks.map((tick) => (
            <div
              key={tick.key}
              className="timeline-editor__tick"
              style={{ left: `${tick.position}%` }}
            >
              <span>{tick.label}</span>
            </div>
          ))}
        </div>

      {!hasUsableDuration ? (
        <p className="timeline-editor__status" role="status" aria-live="polite">
          {Number.isFinite(duration) && duration > 0
            ? '视频时长不足，无法添加动效'
            : '请先导入视频'}
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
          if (!Array.from(event.dataTransfer.types).includes(OVERLAY_MOTION_TYPE)) {
            return
          }

          const motionId = event.dataTransfer.getData(OVERLAY_MOTION_TYPE)
          if (!isMotionId(motionId)) {
            return
          }

          event.preventDefault()
          const startTime = timeAtClientX(event.clientX)
          if (startTime !== null) {
            onDropMotion(motionId, startTime)
          }
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => {
          clearPointerGesture(event.pointerId)
        }}
        onPointerCancel={(event) => {
          clearPointerGesture(event.pointerId)
        }}
        onLostPointerCapture={(event) => {
          clearPointerGesture(event.pointerId)
        }}
      >
        {cards.map((card) => {
          const motionName = motionNames[card.motionId] ?? card.motionId
          const left = percentage(card.start, view)
          const right = percentage(card.end, view)

          return (
            <div
              key={card.id}
              className={`timeline-editor__card${
                selectedCardId === card.id ? ' timeline-editor__card--selected' : ''
              }`}
              style={{
                left: `${left}%`,
                width: `${Math.max(0, right - left)}%`,
                '--timeline-card-color':
                  motionColors[card.motionId] ?? FALLBACK_TIMELINE_COLOR,
              } as CSSProperties}
            >
              <button
                type="button"
                className="timeline-editor__handle timeline-editor__handle--start"
                aria-label={`调整${motionName}片段开始时间`}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => handleResizeKey(event, card, 'start')}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  startPointerGesture(event, {
                    cardId: card.id,
                    mode: 'start',
                    pointerId: event.pointerId,
                    initialClientX: event.clientX,
                    initialTime: card.start,
                  })
                }}
              />
              <button
                type="button"
                className="timeline-editor__card-body"
                aria-label={`选择${motionName}片段，可用左右方向键微调时间`}
                title="左右方向键微调 0.1 秒，按住 Shift 微调 0.5 秒"
                aria-pressed={selectedCardId === card.id}
                onClick={() => onSelectCard(card.id)}
                onKeyDown={(event) => {
                  if (
                    hasUsableDuration &&
                    (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
                  ) {
                    event.preventDefault()
                    const direction = event.key === 'ArrowLeft' ? -1 : 1
                    const step = event.shiftKey ? 0.5 : 0.1
                    onMoveCard(card.id, card.start + direction * step)
                    return
                  }

                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectCard(card.id)
                  }
                }}
                onPointerDown={(event) => {
                  startPointerGesture(event, {
                    cardId: card.id,
                    mode: 'move',
                    pointerId: event.pointerId,
                    initialClientX: event.clientX,
                    initialTime: card.start,
                  })
                }}
              >
                <span className="timeline-editor__card-label">{motionName}</span>
              </button>
              <button
                type="button"
                className="timeline-editor__handle timeline-editor__handle--end"
                aria-label={`调整${motionName}片段结束时间`}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => handleResizeKey(event, card, 'end')}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  startPointerGesture(event, {
                    cardId: card.id,
                    mode: 'end',
                    pointerId: event.pointerId,
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
          style={{ left: `${percentage(currentTime, view)}%` }}
          aria-hidden="true"
        />
      </div>
      </div>
    </section>
  )
}
