import { clampDataValue, normalizeShares, resolveFocusIndex } from './dataMath'

describe('dataMath', () => {
  it('clamps invalid data values into a safe range', () => {
    expect(clampDataValue(-2, 100)).toBe(0)
    expect(clampDataValue(140, 100)).toBe(100)
    expect(clampDataValue(Number.NaN, 100)).toBe(0)
  })

  it('normalizes shares and evenly divides an all-zero set', () => {
    expect(normalizeShares([60, 30, 10])).toEqual([60, 30, 10])
    expect(normalizeShares([0, 0])).toEqual([50, 50])
  })

  it('uses the requested focus or falls back to the largest value', () => {
    expect(resolveFocusIndex([20, 70, 10], '2')).toBe(1)
    expect(resolveFocusIndex([20, 70, 10], '9')).toBe(1)
  })
})
