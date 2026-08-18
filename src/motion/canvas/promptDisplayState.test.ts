import { describe, expect, it } from 'vitest'
import type { PromptDisplayParams } from '../types'
import {
  getPromptDisplayState,
  getPromptScrollOffset,
} from './promptDisplayState'

const params: PromptDisplayParams = {
  eyebrow: 'AI PROMPT / 01',
  prompt: '测试提示词',
  keywords: '提示词',
  holdDuration: 2,
  exitDuration: 0.18,
}

describe('prompt display state', () => {
  it('types to the subtitle boundary, holds, then exits', () => {
    expect(getPromptDisplayState(params, 0, 10.18, 100)).toMatchObject({
      visibleGlyphs: 1,
      typingDuration: 8,
      cursorVisible: true,
      phase: 'typing',
    })
    expect(getPromptDisplayState(params, 8, 10.18, 100)).toMatchObject({
      visibleGlyphs: 100,
      cursorVisible: false,
      phase: 'holding',
      opacity: 1,
    })
    expect(getPromptDisplayState(params, 9, 10.18, 100).phase).toBe('holding')
    expect(getPromptDisplayState(params, 10.18, 10.18, 100)).toMatchObject({
      visibleGlyphs: 100,
      cursorVisible: false,
      phase: 'exiting',
      opacity: 0,
    })
  })

  it('falls back safely when timing inputs are invalid', () => {
    const state = getPromptDisplayState({
      ...params,
      holdDuration: Number.NaN,
      exitDuration: 9,
    }, Number.NaN, undefined, 5)

    expect(state.holdDuration).toBe(2)
    expect(state.exitDuration).toBe(0.18)
    expect(state.localDuration).toBeCloseTo(8.18)
    expect(state.visibleGlyphs).toBe(1)
  })

  it('is deterministic for arbitrary timeline seeks', () => {
    expect(getPromptDisplayState(params, 4, 10.18, 100))
      .toEqual(getPromptDisplayState(params, 4, 10.18, 100))
  })

  it('scrolls only after overflow and eases one line at a time', () => {
    const starts = [0, 20, 40, 60, 80]

    expect(getPromptScrollOffset(4.79, 8, 100, starts, 3, 62)).toBe(0)
    const firstMove = getPromptScrollOffset(4.89, 8, 100, starts, 3, 62)
    expect(firstMove).toBeGreaterThan(0)
    expect(firstMove).toBeLessThan(62)
    expect(getPromptScrollOffset(5.1, 8, 100, starts, 3, 62)).toBeCloseTo(62)
    expect(getPromptScrollOffset(6.7, 8, 100, starts, 3, 62)).toBeCloseTo(124)
  })
})
