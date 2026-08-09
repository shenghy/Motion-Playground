import { describe, expect, it } from 'vitest'
import { getCompareSplitState } from './compareSplitState'

const base = {
  title: 'Conversion', leftLabel: 'Before', leftValue: 42,
  rightLabel: 'After', rightValue: 86, suffix: '%', conclusion: 'Better',
  emphasis: 'right' as const, split: 50, duration: 1.5,
}

describe('getCompareSplitState', () => {
  it('clamps split into a vertical divider percentage', () => {
    expect(getCompareSplitState({ ...base, split: 0 }, 2).verticalSplit).toBe(32)
    expect(getCompareSplitState({ ...base, split: 100 }, 2).verticalSplit).toBe(68)
    expect(getCompareSplitState({ ...base, split: Number.NaN }, 2).verticalSplit)
      .toBe(50)
  })

  it('samples the ordered entrance and counts both values deterministically', () => {
    const entering = getCompareSplitState(base, 0.25)
    const scanning = getCompareSplitState(base, 0.9)
    const stable = getCompareSplitState(base, 2.4)

    expect(entering.headerOpacity).toBeGreaterThan(0)
    expect(entering.upperOpacity).toBe(0)
    expect(scanning.scanProgress).toBeGreaterThan(0)
    expect(scanning.scanProgress).toBeLessThanOrEqual(1)
    expect(stable.upperValue).toBe('42')
    expect(stable.lowerValue).toBe('86')
    expect(stable.resultOpacity).toBe(1)
    expect(stable.lowerHighlight).toBe(0)
    expect(stable.verticalSplit).toBe(50)
    expect(stable.panelOpacity).toBe(1)
    expect(stable.emphasis).toBe('right')
  })

  it('runs one restrained highlight pulse and then remains stable', () => {
    expect(getCompareSplitState(base, 1.2).lowerHighlight).toBe(0)
    expect(getCompareSplitState(base, 1.56).lowerHighlight).toBeCloseTo(1, 5)
    expect(getCompareSplitState(base, 1.93).lowerHighlight).toBe(0)
    expect(getCompareSplitState(base, 2.5).lowerHighlight).toBe(0)
  })

  it('fades the complete panel at exit and restarts after the repeat delay', () => {
    expect(getCompareSplitState(base, 3.1).panelOpacity).toBeLessThan(1)
    expect(getCompareSplitState(base, 3.3).panelOpacity).toBe(0)
    expect(getCompareSplitState(base, 3.9).panelOpacity).toBeGreaterThan(0)
  })

  it('falls back from non-finite timing inputs', () => {
    const state = getCompareSplitState(
      { ...base, duration: Number.NaN },
      Number.NaN,
    )

    expect(state.cycle).toBe(3.3)
    expect(state.time).toBe(0)
    expect(state.headerOpacity).toBe(0)
    expect(state.emphasis).toBe('right')
  })
})
