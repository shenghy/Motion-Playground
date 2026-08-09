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

export function resolveCanvasExportBounds(
  cards: OverlayCard[],
  resolveBounds: (motionId: MotionId) => CanvasFrameRect | undefined,
): CanvasFrameRect {
  return cards.reduce((combined, card) => unionCanvasFrameRects(
    combined,
    translatedAndClamped(
      resolveBounds(card.motionId) ?? FULL_CANVAS_FRAME_RECT,
      card,
    ),
  ), EMPTY_CANVAS_FRAME_RECT)
}

export function canvasFrameAreaRatio(rect: CanvasFrameRect) {
  return (rect.width * rect.height) / (EXPORT_WIDTH * EXPORT_HEIGHT)
}

export function unionCanvasFrameRects(
  leftRect: CanvasFrameRect,
  rightRect: CanvasFrameRect,
): CanvasFrameRect {
  if (leftRect.width === 0 || leftRect.height === 0) return { ...rightRect }
  if (rightRect.width === 0 || rightRect.height === 0) return { ...leftRect }
  const x = Math.min(leftRect.x, rightRect.x)
  const y = Math.min(leftRect.y, rightRect.y)
  const right = Math.max(
    leftRect.x + leftRect.width,
    rightRect.x + rightRect.width,
  )
  const bottom = Math.max(
    leftRect.y + leftRect.height,
    rightRect.y + rightRect.height,
  )
  return { x, y, width: right - x, height: bottom - y }
}

export function findVisiblePixelBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): CanvasFrameRect {
  if (pixels.byteLength !== width * height * 4) {
    throw new Error('RGBA 像素尺寸与画面不一致')
  }
  let left = width
  let top = height
  let right = 0
  let bottom = 0
  let visible = false
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue
      visible = true
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x + 1)
      bottom = Math.max(bottom, y + 1)
    }
  }
  return visible
    ? { x: left, y: top, width: right - left, height: bottom - top }
    : EMPTY_CANVAS_FRAME_RECT
}
