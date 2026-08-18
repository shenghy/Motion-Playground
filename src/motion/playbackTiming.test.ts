import { describe, expect, it } from 'vitest'
import {
  fitPlaybackTimeToCard,
  getCardPlaybackTime,
  getNominalPlaybackDuration,
} from './playbackTiming'

describe('subtitle card playback timing', () => {
  it('compresses a long animation into the first 80 percent of a short card', () => {
    expect(fitPlaybackTimeToCard(0.16, 0.2, 5.2)).toBeCloseTo(5.2)
    expect(fitPlaybackTimeToCard(0.19, 0.2, 5.2)).toBeCloseTo(5.2)
  })

  it('keeps the original pace when the animation already fits', () => {
    expect(fitPlaybackTimeToCard(1.5, 4, 1.4)).toBe(1.5)
  })

  it('derives a complete step-flow duration from its real steps', () => {
    expect(getNominalPlaybackDuration('step-flow', {
      step1: '一', step2: '二', step3: '三', step4: '', step5: '', step6: '', step7: '',
      stepDuration: 1.1,
    })).toBeCloseTo(4.4)
  })

  it('includes the delayed lower count in compare-split completion time', () => {
    const nominal = getNominalPlaybackDuration('compare-split', { duration: 1.5 })

    expect(nominal).toBe(2)
    expect(fitPlaybackTimeToCard(1.6, 2, nominal)).toBe(2)
  })

  it('uses a useful rail-preview duration for prompt display', () => {
    expect(getNominalPlaybackDuration('prompt-display', {
      holdDuration: 2,
      exitDuration: 0.18,
    })).toBeCloseTo(8.18)
  })

  it('preserves exact subtitle-local time for prompt display cards', () => {
    expect(getCardPlaybackTime('prompt-display', {}, 7.25, 12)).toBe(7.25)
    expect(getCardPlaybackTime('prompt-display', {}, -1, 12)).toBe(0)
  })
})
