import { describe, expect, it } from 'vitest'
import { sampleOnce, samplePencilEase } from './timing'

describe('canvas export timing', () => {
  it('samples the pencil cubic-bezier deterministically', () => {
    expect(samplePencilEase(0)).toBe(0)
    expect(samplePencilEase(1)).toBe(1)
    expect(samplePencilEase(0.5)).toBeCloseTo(0.961, 2)
    expect(samplePencilEase(Number.NaN)).toBe(0)
  })

  it('plays once and holds the completed time without wrapping', () => {
    expect(sampleOnce(5.5, 6)).toBeCloseTo(5.5, 5)
    expect(sampleOnce(6.2, 6)).toBe(6)
    expect(sampleOnce(7.2, 6)).toBe(6)
    expect(sampleOnce(-1, 6)).toBe(0)
    expect(sampleOnce(Number.NaN, 6)).toBe(0)
  })
})
