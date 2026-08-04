import { describe, expect, it } from 'vitest'
import { sampleCycle, samplePencilEase } from './timing'

describe('canvas export timing', () => {
  it('samples the pencil cubic-bezier deterministically', () => {
    expect(samplePencilEase(0)).toBe(0)
    expect(samplePencilEase(1)).toBe(1)
    expect(samplePencilEase(0.5)).toBeCloseTo(0.961, 2)
    expect(samplePencilEase(Number.NaN)).toBe(0)
  })

  it('holds through repeat delay and wraps after it', () => {
    expect(sampleCycle(5.5, 6, 0.7)).toBeCloseTo(5.5, 5)
    expect(sampleCycle(6.2, 6, 0.7)).toBe(6)
    expect(sampleCycle(7.2, 6, 0.7)).toBeCloseTo(0.5, 5)
    expect(sampleCycle(-1, 6, 0.7)).toBe(0)
  })
})
