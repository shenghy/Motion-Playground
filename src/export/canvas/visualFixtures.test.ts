import { describe, expect, it } from 'vitest'
import { MOTION_IDS } from '../../motion/types'
import { canvasVisualFixtures } from './visualFixtures'

describe('canvas visual fixtures', () => {
  it('defines four ordered samples for every motion', () => {
    expect(canvasVisualFixtures).toHaveLength(MOTION_IDS.length * 4)
    for (const motionId of MOTION_IDS) {
      const samples = canvasVisualFixtures.filter((fixture) => fixture.motionId === motionId)
      expect(samples.map((fixture) => fixture.phase)).toEqual([
        'entrance', 'expansion', 'stable', 'exit',
      ])
      expect(samples.every((fixture) => fixture.localTime >= 0)).toBe(true)
    }
  })

  it('keeps fixture bounds inside the export canvas', () => {
    for (const fixture of canvasVisualFixtures) {
      expect(fixture.expectedBounds.left).toBeGreaterThanOrEqual(0)
      expect(fixture.expectedBounds.top).toBeGreaterThanOrEqual(0)
      expect(fixture.expectedBounds.right).toBeLessThan(1920)
      expect(fixture.expectedBounds.bottom).toBeLessThan(1080)
    }
  })
})
