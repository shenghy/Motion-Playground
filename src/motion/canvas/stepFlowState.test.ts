import { describe, expect, it } from 'vitest'
import { getStepFlowState } from './stepFlowState'

const params = {
  eyebrow: 'Flow', title: 'Release', step1: 'One', step2: 'Two',
  step3: 'Three', step4: 'Four', step5: 'Five', step6: 'Six', step7: 'Seven',
  focusStep: '3' as const,
  statusLabel: 'Current', statusNote: 'Working', stepDuration: 1,
}

describe('getStepFlowState', () => {
  it('supports seven steps and wraps focus order from step six', () => {
    const sevenStepParams = {
      ...params,
      step6: 'Six',
      step7: 'Seven',
      focusStep: '6',
    } as unknown as Parameters<typeof getStepFlowState>[0]

    const state = getStepFlowState(sevenStepParams, 0)

    expect(state.steps).toHaveLength(7)
    expect(state.orderedIndexes).toEqual([5, 6, 0, 1, 2, 3, 4])
  })

  it('retains a completed state after the focus moves forward', () => {
    const state = getStepFlowState(params, 1.65)

    expect(state.items[2]).toMatchObject({ completed: true })
    expect(state.items[3]).toMatchObject({ completed: false })
  })

  it('cycles in focus-step order', () => {
    const state = getStepFlowState({ ...params, step6: '', step7: '' }, 0)
    expect(state.orderedIndexes).toEqual([2, 3, 4, 0, 1])
    expect(state.focusIndex).toBe(2)
  })

  it('plays once and holds every step completed', () => {
    const cycle = 5 * 1 + 1.1
    const fiveStepParams = { ...params, step6: '', step7: '' }
    const completed = getStepFlowState(fiveStepParams, cycle + 8)
    expect(completed.time).toBe(cycle)
    expect(completed.headerOpacity).toBe(1)
    expect(completed.connectorReveal).toBe(1)
    expect(completed.items.every((item) => item.completed)).toBe(true)
  })
})
