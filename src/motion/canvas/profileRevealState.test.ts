import { describe, expect, it } from 'vitest'
import { getProfileRevealState } from './profileRevealState'

const params = {
  category: 'Creator', descriptor: 'Builder', overline: 'Public build',
  title: 'Maker', fact1: 'One', fact1Note: 'A', fact2: 'Two', fact2Note: 'B',
  fact3: 'Three', fact3Note: 'C', status: 'Confirmed', duration: 6.4,
}

describe('getProfileRevealState', () => {
  it('reveals facts in staggered order', () => {
    const early = getProfileRevealState(params, 1.7)
    expect(early.facts[0].opacity).toBeGreaterThan(0)
    expect(early.facts[1].opacity).toBe(0)
  })

  it('plays once and holds the complete profile', () => {
    const completed = getProfileRevealState(params, 12)
    expect(completed.time).toBe(6.4)
    expect(completed.card.opacity).toBe(1)
    expect(completed.identity.opacity).toBe(1)
    expect(completed.facts.every((fact) => fact.opacity === 1)).toBe(true)
    expect(completed.footer.opacity).toBe(1)
  })
})
