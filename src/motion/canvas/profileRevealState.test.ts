import { describe, expect, it } from 'vitest'
import { getProfileRevealState } from './profileRevealState'

const params = {
  category: 'Creator', descriptor: 'Builder', overline: 'Public build',
  title: 'Maker', fact1: 'One', fact1Note: 'A', fact2: 'Two', fact2Note: 'B',
  fact3: 'Three', fact3Note: 'C', status: 'Confirmed', duration: 6.4,
}

describe('getProfileRevealState', () => {
  it('reveals facts in staggered order and then exits', () => {
    const early = getProfileRevealState(params, 1.7)
    expect(early.facts[0].opacity).toBeGreaterThan(0)
    expect(early.facts[1].opacity).toBe(0)
    expect(getProfileRevealState(params, 6.4).card.opacity).toBe(0)
  })

  it('repeats after its cycle and repeat delay', () => {
    expect(getProfileRevealState(params, 2)).toEqual(
      getProfileRevealState(params, 2 + 6.4 + 0.72),
    )
  })
})
