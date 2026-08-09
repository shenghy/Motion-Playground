import { describe, expect, it } from 'vitest'
import { motionRegistry } from '../motion/registry'
import type { MotionId, ParameterValues } from '../motion/types'
import type { OverlayCard } from '../timeline/types'
import {
  cloneOverlayCards,
  createUniqueCardId,
  createWorkspaceSnapshot,
  exportFingerprint,
} from './workbenchModel'

const card: OverlayCard = {
  id: 'card-1', motionId: 'narrative', start: 0, end: 2,
  position: { x: 1, y: 2 }, zIndex: 0,
  params: { ...motionRegistry[0].defaults },
}

describe('workbench model', () => {
  it('creates a unique card id and deep-clones mutable card fields', () => {
    expect(createUniqueCardId([card], () => 'card-2')).toBe('card-2')
    const clone = cloneOverlayCards([card])
    expect(clone).toEqual([card])
    expect(clone[0].position).not.toBe(card.position)
    expect(clone[0].params).not.toBe(card.params)
  })

  it('fingerprints exports and creates a versioned workspace snapshot', () => {
    const parameters = Object.fromEntries(motionRegistry.map((definition) => (
      [definition.id, { ...definition.defaults }]
    ))) as unknown as Record<MotionId, ParameterValues>
    expect(exportFingerprint([card], 2)).toBe(JSON.stringify({ duration: 2, cards: [card] }))
    expect(createWorkspaceSnapshot(
      [card], parameters, 'narrative', true, null,
    )).toMatchObject({
      version: 1,
      activeId: 'narrative',
      showSafeArea: true,
      video: { present: false },
      project: { version: 1, canvas: { width: 1920, height: 1080 } },
    })
  })
})

