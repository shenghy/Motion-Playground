import { describe, expect, it } from 'vitest'
import { getStepFlowState } from './stepFlowState'

const params = {
  eyebrow: 'Flow', title: 'Release', step1: 'One', step2: 'Two',
  step3: 'Three', step4: 'Four', step5: 'Five', focusStep: '3' as const,
  statusLabel: 'Current', statusNote: 'Working', stepDuration: 1,
}

describe('getStepFlowState', () => {
  it('cycles in focus-step order', () => {
    const state = getStepFlowState(params, 0)
    expect(state.orderedIndexes).toEqual([2, 3, 4, 0, 1])
    expect(state.focusIndex).toBe(2)
  })

  it('repeats after the active cycle and repeat delay', () => {
    const cycle = 5 * 1 + 1.1
    expect(getStepFlowState(params, 1.7)).toEqual(
      getStepFlowState(params, 1.7 + cycle + 0.72),
    )
  })
})
