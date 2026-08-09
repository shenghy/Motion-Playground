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

  it('plays once and holds the complete ring', () => {
    const completed = getShareRingState(params, 12)
    expect(completed.time).toBe(6)
    expect(completed.headerOpacity).toBe(1)
    expect(completed.centerOpacity).toBe(1)
    expect(completed.resultOpacity).toBe(1)
    expect(completed.items.every((item) => item.reveal === 1)).toBe(true)
  })
})
