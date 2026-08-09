import { describe, expect, it } from 'vitest'
import {
  calculateFrameCount,
  calculateFrameTime,
  delayedProgress,
  easeOutQuart,
  getCardPlaybackState,
  interpolateKeyframes,
} from './frameMath'

describe('transparent export frame math', () => {
  it('covers the complete duration at 30fps', () => {
    expect(calculateFrameCount(10.01, 30)).toBe(301)
    expect(calculateFrameTime(300, 30)).toBe(10)
    expect(calculateFrameCount(Number.NaN, 30)).toBe(0)
  })

  it('uses half-open card timing and local card time', () => {
    expect(getCardPlaybackState({ start: 2, end: 5 }, 1.99)).toEqual({
      active: false,
      localTime: 0,
    })
    expect(getCardPlaybackState({ start: 2, end: 5 }, 2.5)).toEqual({
      active: true,
      localTime: 0.5,
    })
    expect(getCardPlaybackState({ start: 2, end: 5 }, 5)).toEqual({
      active: false,
      localTime: 3,
    })
  })

  it('calculates deterministic easing, delay and keyframe values', () => {
    expect(delayedProgress(0.5, 0.2, 0.6)).toBeCloseTo(0.5)
    expect(easeOutQuart(0)).toBe(0)
    expect(easeOutQuart(1)).toBe(1)
    expect(interpolateKeyframes(0.5, [0, 1, 0], [0, 0.5, 1])).toBe(1)
  })
})
