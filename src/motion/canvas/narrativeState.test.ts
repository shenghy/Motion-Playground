import { describe, expect, it } from 'vitest'
import type { NarrativeParams } from '../types'
import { getNarrativeState } from './narrativeState'

const params: NarrativeParams = {
  line1: '第一排',
  line2: '第二排',
  explanation: '解释',
  keywords: '',
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

  it('plays once and holds every layer visible after completion', () => {
    const completed = getNarrativeState(params, 12)

    expect(completed.time).toBe(5.2)
    expect(completed.line1.opacity).toBe(1)
    expect(completed.line2.opacity).toBe(1)
    expect(completed.ruleProgress).toBe(1)
    expect(completed.explanation.opacity).toBe(1)
  })
})
