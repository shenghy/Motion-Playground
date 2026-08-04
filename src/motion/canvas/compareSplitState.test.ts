import { describe, expect, it } from 'vitest'
import { getCompareSplitState } from './compareSplitState'

const base = {
  title: 'Conversion', leftLabel: 'Before', leftValue: 42,
  rightLabel: 'After', rightValue: 86, suffix: '%', conclusion: 'Better',
  emphasis: 'right' as const, split: 50, duration: 1.5,
}

describe('getCompareSplitState', () => {
  it('clamps split and maps it into the primary width', () => {
    expect(getCompareSplitState({ ...base, split: 0 }, 2).primaryWidth).toBe(27)
    expect(getCompareSplitState({ ...base, split: 100 }, 2).primaryWidth).toBe(34)
  })

  it('counts both values deterministically and preserves emphasis', () => {
    const state = getCompareSplitState(base, 1.5)
    expect(state.leftValue).toBe('42')
    expect(state.rightValue).toBe('86')
    expect(state.emphasis).toBe('right')
  })
})
