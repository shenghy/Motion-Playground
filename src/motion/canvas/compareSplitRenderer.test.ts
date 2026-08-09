import { describe, expect, it, vi } from 'vitest'
import type { CompareSplitParams } from '../types'
import { COMPARE_SPLIT_LAYOUT, getCompareSplitTrackLayout } from './compareSplitLayout'
import { renderCompareSplitToCanvas } from './compareSplitRenderer'

function createContext() {
  const fillText = vi.fn()
  const fillRect = vi.fn()
  const moveTo = vi.fn()
  const lineTo = vi.fn()
  const methods: Record<string, unknown> = {
    fillText,
    fillRect,
    moveTo,
    lineTo,
    measureText: vi.fn((text: string) => ({ width: String(text ?? '').length * 12 })),
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
  return { context, fillText, fillRect, moveTo, lineTo }
}

const resources = {
  width: 1920,
  height: 1080,
  displayFont: 'Syne Variable',
  monoFont: 'IBM Plex Mono',
  contentFont: 'Noto Sans SC Variable',
}

const params: CompareSplitParams = {
  title: '转化率', leftLabel: '优化前', leftValue: 42,
  rightLabel: '优化后', rightValue: 86, suffix: '%',
  conclusion: '提升 2.05 倍', emphasis: 'right', split: 50, duration: 1.5,
}

function render(overrides: Partial<CompareSplitParams> = {}) {
  const captured = createContext()
  renderCompareSplitToCanvas({
    ctx: captured.context,
    params: { ...params, ...overrides },
    localTime: 2,
    resources,
  })
  return captured
}

describe('compare split canvas renderer', () => {
  it('uses one safe panel and keeps every text box before the presenter line', () => {
    const { fillRect, fillText } = render()
    const { panel, safeLineX } = COMPARE_SPLIT_LAYOUT

    expect(fillRect).toHaveBeenCalledWith(panel.x, panel.y, panel.width, panel.height)
    expect(fillText.mock.calls.map(([text]) => text)).toEqual(expect.arrayContaining([
      '优化前',
      '优化后',
      '提升 2.05 倍',
    ]))
    expect(fillText.mock.calls.every(([, x, , maxWidth]) => (
      Number(x) < safeLineX && Number(x) + Number(maxWidth) <= panel.x + panel.width
    ))).toBe(true)
  })

  it('draws the baseline above the result without the old horizontal comparison boxes', () => {
    const { fillText, fillRect } = render()
    const calls = fillText.mock.calls
    const upperY = Number(calls.find(([text]) => text === '优化前')?.[2])
    const lowerY = Number(calls.find(([text]) => text === '优化后')?.[2])

    expect(upperY).toBeLessThan(lowerY)
    expect(fillRect.mock.calls.some(([, , width]) => Number(width) > COMPARE_SPLIT_LAYOUT.panel.width)).toBe(false)
  })

  it.each([32, 50, 68])('places the scan divider at the shared %s%% split', (split) => {
    const { moveTo, lineTo } = render({ split })
    const expectedY = getCompareSplitTrackLayout(split).dividerY
    const pairedLines = moveTo.mock.calls.map((start, index) => ({
      start,
      end: lineTo.mock.calls[index],
    }))

    expect(pairedLines).toContainEqual({
      start: [COMPARE_SPLIT_LAYOUT.content.x, expectedY],
      end: [COMPARE_SPLIT_LAYOUT.content.x + COMPARE_SPLIT_LAYOUT.content.width, expectedY],
    })
  })

  it('keeps maximum-length editable copy inside the safe content width', () => {
    const { fillText } = render({
      title: '这是二十四个字以内的超长对比标题内容展示测试',
      leftLabel: '这是十四字基准标签测试',
      rightLabel: '这是十四字结果标签测试',
      conclusion: '这是二十四字以内的超长结论内容展示测试文字',
    })

    expect(fillText.mock.calls.every(([, x, , maxWidth]) => (
      Number(x) + Number(maxWidth) <= COMPARE_SPLIT_LAYOUT.panel.x + COMPARE_SPLIT_LAYOUT.panel.width
    ))).toBe(true)
  })
})
