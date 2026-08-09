import { describe, expect, it } from 'vitest'
import { motionRegistry, resolveMotionBounds } from '../../motion/registry'
import type { OverlayCard } from '../../timeline/types'
import {
  EMPTY_CANVAS_FRAME_RECT,
  findVisiblePixelBounds,
  resolveCanvasExportBounds,
  resolveCanvasFrameBounds,
  unionCanvasFrameRects,
} from './frameBounds'

function card(overrides: Partial<OverlayCard> = {}): OverlayCard {
  return {
    id: 'card',
    motionId: 'metric-focus',
    start: 1,
    end: 5,
    position: { x: 0, y: 0 },
    zIndex: 0,
    params: {},
    ...overrides,
  }
}

describe('canvas frame bounds', () => {
  it('requires one conservative rectangle for every registered motion', () => {
    expect(motionRegistry.every((definition) => {
      const bounds = resolveMotionBounds(definition.id)
      return bounds.width > 0 && bounds.height > 0
    })).toBe(true)
    const areas = motionRegistry.map(({ canvasBounds }) => (
      canvasBounds.width * canvasBounds.height / (1920 * 1080)
    ))
    expect(Math.max(...areas)).toBeLessThan(0.3)
    expect(new Set(areas).size).toBeGreaterThan(2)
  })

  it('returns an empty rectangle when no card is active', () => {
    expect(resolveCanvasFrameBounds(
      [card()],
      0.5,
      () => ({ x: 20, y: 30, width: 100, height: 80 }),
    )).toEqual(EMPTY_CANVAS_FRAME_RECT)
  })

  it('includes positioned cards in one export-wide ROI', () => {
    expect(resolveCanvasExportBounds(
      [card({ position: { x: 10, y: -10 } })],
      () => ({ x: 100, y: 100, width: 200, height: 300 }),
    )).toEqual({ x: 292, y: 0, width: 200, height: 292 })
  })

  it('translates, unions, rounds outward, and clamps active bounds', () => {
    const cards = [
      card({ id: 'left', position: { x: 10, y: 5 } }),
      card({ id: 'edge', position: { x: 94, y: 90 } }),
    ]
    const bounds = resolveCanvasFrameBounds(cards, 2, (motionId) => (
      motionId === 'metric-focus'
        ? { x: 20.2, y: 30.2, width: 100.2, height: 80.2 }
        : undefined
    ))

    expect(bounds).toEqual({ x: 212, y: 84, width: 1708, height: 996 })
  })

  it('finds and unions exact visible alpha bounds', () => {
    const pixels = new Uint8ClampedArray(4 * 3 * 4)
    pixels[(1 * 4 + 2) * 4 + 3] = 255
    pixels[(2 * 4 + 3) * 4 + 3] = 128

    expect(findVisiblePixelBounds(pixels, 4, 3)).toEqual({
      x: 2, y: 1, width: 2, height: 2,
    })
    expect(unionCanvasFrameRects(
      { x: 2, y: 1, width: 2, height: 2 },
      { x: 0, y: 0, width: 1, height: 1 },
    )).toEqual({ x: 0, y: 0, width: 4, height: 3 })
    expect(findVisiblePixelBounds(new Uint8ClampedArray(16), 2, 2))
      .toEqual(EMPTY_CANVAS_FRAME_RECT)
  })
})
