import { describe, expect, it } from 'vitest'
import type { AudiencePollParams } from '../types'
import { getAudiencePollState } from './audiencePollState'

const params: AudiencePollParams = {
  eyebrow: '08 / LIVE POLL',
  title: '你更看好哪种开发方式？',
  option1: 'AI 辅助开发',
  option2: '传统手写代码',
  option3: '两者结合',
  option4: '',
  callToAction: '把编号打在弹幕或评论区，告诉我你的选择',
  duration: 6.2,
}

describe('getAudiencePollState', () => {
  it('filters blank options and preserves their stable order', () => {
    const state = getAudiencePollState({
      ...params,
      option1: '  第一项  ',
      option2: '',
      option3: '第三项',
      option4: '   ',
    }, 2)

    expect(state.options.map((option) => option.label)).toEqual(['第一项', '第三项'])
  })

  it('uses two stable fallback choices when fewer than two options remain', () => {
    const empty = getAudiencePollState({ ...params, option1: '', option2: '', option3: '', option4: '' }, 2)
    const single = getAudiencePollState({ ...params, option1: '仅一个', option2: '', option3: '', option4: '' }, 2)

    expect(empty.options.map((option) => option.label)).toEqual(['选项一', '选项二'])
    expect(single.options.map((option) => option.label)).toEqual(['选项一', '选项二'])
  })

  it('reveals header, options in sequence, then the call to action before a full exit', () => {
    const entrance = getAudiencePollState(params, 0.3)
    const sequence = getAudiencePollState(params, 1.4)
    const stable = getAudiencePollState(params, 3.4)
    const exit = getAudiencePollState(params, 6)

    expect(entrance.header.opacity).toBeGreaterThan(entrance.options[0].opacity)
    expect(sequence.options[0].opacity).toBeGreaterThan(sequence.options[2].opacity)
    expect(sequence.options.filter((option) => option.current)).toHaveLength(1)
    expect(stable.cta.opacity).toBeGreaterThan(0.9)
    expect(exit.header.opacity).toBeLessThan(stable.header.opacity)
    expect(exit.options.every((option) => option.opacity < stable.options[0].opacity)).toBe(true)
    expect(exit.cta.opacity).toBeLessThan(stable.cta.opacity)
  })
})
