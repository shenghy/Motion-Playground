import { describe, expect, it, vi } from 'vitest'
import type { CompareSplitParams } from '../types'
import { renderCompareSplitToCanvas } from './compareSplitRenderer'

function createContext() {
  const fillText = vi.fn()
  const methods: Record<string, unknown> = {
    fillText,
    measureText: vi.fn((text: string) => ({ width: text.length * 12 })),
  }
  const context = new Proxy(methods, {
    get(target, property) {
      if (property in target) return target[property as string]
      const method = vi.fn()
      target[property as string] = method
      return method
    },
    set(target, property, value) {
      target[property as string] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { context, fillText }
}

const params: CompareSplitParams = {
  title: 'CONVERSION RATE', leftLabel: 'BEFORE', leftValue: 42,
  rightLabel: 'AFTER', rightValue: 86, suffix: '%',
  conclusion: '2.05× IMPROVEMENT', emphasis: 'right', split: 50, duration: 1.5,
}

describe('compare split canvas renderer', () => {
  it('keeps both datasets and the conclusion inside the left 60 percent', () => {
    const { context, fillText } = createContext()
    renderCompareSplitToCanvas({
      ctx: context,
      params,
      localTime: 2,
      resources: {
        width: 1920,
        height: 1080,
        displayFont: 'Syne Variable',
        monoFont: 'IBM Plex Mono',
        contentFont: 'Noto Sans SC Variable',
      },
    })
    const calls = fillText.mock.calls
    expect(calls.map(([text]) => text)).toEqual(expect.arrayContaining([
      'BEFORE',
      'AFTER',
      '2.05× IMPROVEMENT',
    ]))
    expect(calls.every(([, x]) => Number(x) < 1152)).toBe(true)
  })
})
