import { describe, expect, it } from 'vitest'
import { getBarCompareState } from './barCompareState'

const params = {
  eyebrow: 'Data', title: 'Growth', item1Label: '', item1Value: -4,
  item2Label: '', item2Value: 50, item3Label: '', item3Value: 80,
  item4Label: '', item4Value: 200, suffix: '%',
  resultLabel: 'Best', resultNote: 'Q4', duration: 5.8,
  focusIndex: '9' as unknown as '1',
}

describe('getBarCompareState', () => {
  it('uses fallback items and normalized heights', () => {
    const state = getBarCompareState(params, 3)
    expect(state.items.map((item) => item.label)).toEqual(['A', 'B'])
    expect(state.items.map((item) => item.height)).toEqual([42 / 86, 1])
    expect(state.focusIndex).toBe(1)
  })

  it('plays once and holds the complete chart', () => {
    const completed = getBarCompareState(params, 12)
    expect(completed.time).toBe(5.8)
    expect(completed.headerOpacity).toBe(1)
    expect(completed.baselineReveal).toBe(1)
    expect(completed.resultOpacity).toBe(1)
    expect(completed.items.every((item) => item.barReveal === 1)).toBe(true)
  })
})
