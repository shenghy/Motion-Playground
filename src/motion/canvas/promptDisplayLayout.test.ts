import { describe, expect, it, vi } from 'vitest'
import {
  layoutPromptText,
  parsePromptKeywords,
  segmentPromptGraphemes,
} from './promptDisplayLayout'

function context() {
  return {
    font: '',
    measureText: vi.fn((text: string) => ({
      width: Array.from(text).reduce((width, character) => (
        width + (/\p{Script=Han}/u.test(character) ? 42 : 24)
      ), 0),
    })),
  } as unknown as CanvasRenderingContext2D
}

describe('prompt display layout', () => {
  it('segments emoji and joined characters as complete graphemes', () => {
    expect(segmentPromptGraphemes('A👨‍💻中').map(({ text }) => text))
      .toEqual(['A', '👨‍💻', '中'])
  })

  it('normalizes keywords with longer matches first', () => {
    expect(parsePromptKeywords('电影级|电影级写实|不存在|电影级'))
      .toEqual(['电影级写实', '电影级', '不存在'])
  })

  it('wraps by measured width and preserves explicit line breaks', () => {
    const layout = layoutPromptText(
      context(),
      '电影级写实画面\n冷暖光线对比',
      '电影级写实|冷暖光线对比',
      '600 42px sans-serif',
      168,
    )

    expect(layout.lines.length).toBeGreaterThan(2)
    expect(layout.lines.every((line) => line.width <= 168)).toBe(true)
    expect(layout.lines.some(({ forcedBreakAfter }) => forcedBreakAfter)).toBe(true)
    expect(layout.glyphs.filter(({ highlighted }) => highlighted)
      .map(({ text }) => text).join(''))
      .toBe('电影级写实冷暖光线对比')
  })

  it('highlights every repeated occurrence and prefers longer overlaps', () => {
    const layout = layoutPromptText(
      context(),
      '电影级写实，电影级写实。',
      '电影级|电影级写实',
      '600 42px sans-serif',
      580,
    )

    const highlighted = layout.glyphs.filter(({ highlighted }) => highlighted)
      .map(({ text }) => text).join('')
    expect(highlighted).toBe('电影级写实电影级写实')
    expect(layout.lines[0].startRevealIndex).toBe(0)
  })
})
