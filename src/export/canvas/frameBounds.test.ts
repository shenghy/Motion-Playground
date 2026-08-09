import { describe, expect, it } from 'vitest'
import { motionRegistry, resolveMotionBounds } from '../../motion/registry'
import type { OverlayCard } from '../../timeline/types'
import {
  EMPTY_CANVAS_FRAME_RECT,
  resolveCanvasFrameBounds,
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
  })

  it('returns an empty rectangle when no card is active', () => {
    expect(resolveCanvasFrameBounds(
      [card()],
      0.5,
      () => ({ x: 20, y: 30, width: 100, height: 80 }),
    )).toEqual(EMPTY_CANVAS_FRAME_RECT)
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
})
