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

  it('uses two stable fallback choices only when all options are empty', () => {
    const empty = getAudiencePollState({
      ...params, option1: '', option2: '', option3: '', option4: '',
    }, 2)

    expect(empty.options.map((option) => option.label)).toEqual(['选项一', '选项二'])
  })

  it.each([
    ['option1', { option1: '保留第一项', option2: '', option3: '', option4: '' }],
    ['option3', { option1: '', option2: '', option3: '保留第三项', option4: '' }],
  ])('preserves a sole %s value and appends a deterministic placeholder', (_label, options) => {
    const state = getAudiencePollState({ ...params, ...options }, 2)

    expect(state.options.map((option) => option.label)).toEqual([
      Object.values(options).find(Boolean),
      '待补充选项',
    ])
    expect(state.options).toHaveLength(2)
  })

  it('reveals header, options in sequence, then the call to action', () => {
    const entrance = getAudiencePollState(params, 0.3)
    const sequence = getAudiencePollState(params, 1.4)
    const stable = getAudiencePollState(params, 3.4)

    expect(entrance.header.opacity).toBeGreaterThan(entrance.options[0].opacity)
    expect(sequence.options[0].opacity).toBeGreaterThan(sequence.options[2].opacity)
    expect(sequence.options.filter((option) => option.current)).toHaveLength(1)
    expect(stable.cta.opacity).toBeGreaterThan(0.9)
  })

  it('plays once and holds the complete poll visible', () => {
    const completed = getAudiencePollState(params, 12)
    expect(completed.time).toBe(6.2)
    expect(completed.panelOpacity).toBe(1)
    expect(completed.header.opacity).toBe(1)
    expect(completed.title.opacity).toBe(1)
    expect(completed.options.every((option) => option.opacity === 1)).toBe(true)
    expect(completed.cta.opacity).toBe(1)
  })

  it('runs one restrained CTA pulse and then remains at rest', () => {
    const before = getAudiencePollState(params, 2.06).cta.scale
    const peak = getAudiencePollState(params, 2.46).cta.scale
    const settled = [2.86, 3.26, 3.66, 4.06]
      .map((time) => getAudiencePollState(params, time).cta.scale)

    expect(before).toBeCloseTo(1, 5)
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThanOrEqual(1.012)
    expect(settled).toEqual([1, 1, 1, 1])
  })
})
