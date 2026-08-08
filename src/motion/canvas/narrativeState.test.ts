import { describe, expect, it } from 'vitest'
import type { NarrativeParams } from '../types'
import { getNarrativeState } from './narrativeState'

const params: NarrativeParams = {
  line1: '第一排',
  line2: '第二排',
  explanation: '解释',
  duration: 5.2,
}

describe('getNarrativeState', () => {
  it('reveals line1, line2, rule, then explanation', () => {
    const early = getNarrativeState(params, 0.5)
    const middle = getNarrativeState(params, 1.3)

    expect(early.line1.opacity).toBeGreaterThan(early.line2.opacity)
    expect(middle.line2.opacity).toBeGreaterThan(0)
    expect(middle.ruleProgress).toBeGreaterThan(0)
    expect(middle.explanation.opacity).toBeLessThanOrEqual(
      middle.line2.opacity,
    )
  })

  it('fades all layers near the cycle end', () => {
    const held = getNarrativeState(params, 3)
    const exiting = getNarrativeState(params, 5.05)

    expect(exiting.line1.opacity).toBeLessThan(held.line1.opacity)
    expect(exiting.explanation.opacity).toBeLessThan(
      held.explanation.opacity,
    )
  })
})
