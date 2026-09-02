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
  'prompt-display': '#4F9BC6',
  'diary-date': '#D8656B',
  'mind-map': '#9B7BD8',
  'spotlight': '#F2C14E',
  'key-points': '#5FA8D3',
  'flow-chain': '#7BC8A4',
  'timeline-reveal': '#E58C6A',
  'category-matrix': '#C9A2DC',
  'pyramid': '#F5B17B',
  'item-grid': '#6EC6C9',
}

describe('motion registry timeline colors', () => {
  it('assigns the approved unique color to every registered motion', () => {
    const actualColors = Object.fromEntries(
      motionRegistry.map(({ id, timelineColor }) => [id, timelineColor]),
    )
    const colors = Object.values(actualColors)

    expect(actualColors).toEqual(expectedColors)
    expect(colors).toHaveLength(18)
    expect(new Set(colors).size).toBe(18)
    expect(colors.every((color) => /^#[0-9A-F]{6}$/.test(color))).toBe(true)
  })

  it('registers prompt display with complete JSON defaults and a multiline editor', () => {
    const promptDisplay = motionRegistry.find(({ id }) => id === 'prompt-display')

    expect(promptDisplay?.defaults).toEqual({
      eyebrow: 'AI PROMPT / 01',
      prompt: '请生成一张电影级写实的数据中心画面，突出冷暖光线对比。',
      keywords: '电影级写实|冷暖光线对比',
      holdDuration: 2,
      exitDuration: 0.18,
    })
    expect(promptDisplay?.controls).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'textarea', key: 'prompt', maxLength: 2000 }),
    ]))
  })

  it('creates step flows from step one without exposing another start point', () => {
    const stepFlow = motionRegistry.find(({ id }) => id === 'step-flow')

    expect(stepFlow?.defaults.focusStep).toBe('1')
    expect(stepFlow?.controls).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'focusStep' }),
    ]))
  })
})
