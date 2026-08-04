import { describe, expect, it } from 'vitest'
import { getShareRingState } from './shareRingState'

const params = {
  eyebrow: 'Share', title: 'Users', item1Label: 'A', item1Value: 1,
  item2Label: 'B', item2Value: 1, item3Label: 'C', item3Value: 1,
  item4Label: 'D', item4Value: 1, focusIndex: '3' as const, centerLabel: 'Core',
  resultLabel: 'Main', resultNote: 'Rank', duration: 6,
}

describe('getShareRingState', () => {
  it('normalizes shares to 100 and preserves focus', () => {
    const state = getShareRingState(params, 3)
    expect(state.items.reduce((sum, item) => sum + item.percentage, 0)).toBeCloseTo(100)
    expect(state.focusIndex).toBe(2)
    expect(state.focusPercentage).toBe(25)
  })

  it('repeats after the active cycle and repeat delay', () => {
    expect(getShareRingState(params, 1.2)).toEqual(
      getShareRingState(params, 1.2 + 6 + 0.75),
    )
  })
})
