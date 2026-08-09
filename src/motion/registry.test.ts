import { describe, expect, it } from 'vitest'
import { motionRegistry } from './registry'

const expectedColors = {
  narrative: '#8B7BD8',
  'metric-focus': '#4D8FD8',
  'compare-split': '#D39A43',
  'profile-reveal': '#C86D91',
  'bar-compare': '#4FA878',
  'share-ring': '#3AA6AD',
  'step-flow': '#CA7045',
  'audience-poll': '#91A84F',
}

describe('motion registry timeline colors', () => {
  it('assigns the approved unique color to every registered motion', () => {
    const actualColors = Object.fromEntries(
      motionRegistry.map(({ id, timelineColor }) => [id, timelineColor]),
    )
    const colors = Object.values(actualColors)

    expect(actualColors).toEqual(expectedColors)
    expect(colors).toHaveLength(8)
    expect(new Set(colors).size).toBe(8)
    expect(colors.every((color) => /^#[0-9A-F]{6}$/.test(color))).toBe(true)
  })
})
