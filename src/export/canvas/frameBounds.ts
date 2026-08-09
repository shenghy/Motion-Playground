import type { MotionId } from '../../motion/types'
import type { OverlayCard } from '../../timeline/types'
import { EXPORT_HEIGHT, EXPORT_WIDTH, getCardPlaybackState } from '../frameMath'
import type { CanvasFrameRect } from './types'

export const EMPTY_CANVAS_FRAME_RECT: CanvasFrameRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
}

const FULL_CANVAS_FRAME_RECT: CanvasFrameRect = {
  x: 0,
  y: 0,
  width: EXPORT_WIDTH,
  height: EXPORT_HEIGHT,
}

function translatedAndClamped(
  rect: CanvasFrameRect,
  card: OverlayCard,
): CanvasFrameRect {
  const offsetX = card.position.x * (EXPORT_WIDTH / 100)
  const offsetY = card.position.y * (EXPORT_HEIGHT / 100)
  const left = Math.max(0, Math.min(EXPORT_WIDTH, Math.floor(rect.x + offsetX)))
  const top = Math.max(0, Math.min(EXPORT_HEIGHT, Math.floor(rect.y + offsetY)))
  const right = Math.max(0, Math.min(
    EXPORT_WIDTH,
    Math.ceil(rect.x + rect.width + offsetX),
  ))
  const bottom = Math.max(0, Math.min(
    EXPORT_HEIGHT,
    Math.ceil(rect.y + rect.height + offsetY),
  ))
  if (right <= left || bottom <= top) return EMPTY_CANVAS_FRAME_RECT
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function resolveCanvasFrameBounds(
  cards: OverlayCard[],
  time: number,
  resolveBounds: (motionId: MotionId) => CanvasFrameRect | undefined,
): CanvasFrameRect {
  let left = EXPORT_WIDTH
  let top = EXPORT_HEIGHT
  let right = 0
  let bottom = 0
  let visible = false

  for (const card of cards) {
    if (!getCardPlaybackState(card, time).active) continue
    const rect = translatedAndClamped(
      resolveBounds(card.motionId) ?? FULL_CANVAS_FRAME_RECT,
      card,
    )
    if (rect.width === 0 || rect.height === 0) continue
    visible = true
    left = Math.min(left, rect.x)
    top = Math.min(top, rect.y)
    right = Math.max(right, rect.x + rect.width)
    bottom = Math.max(bottom, rect.y + rect.height)
  }

  return visible
    ? { x: left, y: top, width: right - left, height: bottom - top }
    : EMPTY_CANVAS_FRAME_RECT
}

export function canvasFrameAreaRatio(rect: CanvasFrameRect) {
  return (rect.width * rect.height) / (EXPORT_WIDTH * EXPORT_HEIGHT)
}
