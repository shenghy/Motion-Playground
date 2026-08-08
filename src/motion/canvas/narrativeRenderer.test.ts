import { describe, expect, it, vi } from 'vitest'
import type { NarrativeParams } from '../types'
import { renderNarrativeToCanvas } from './narrativeRenderer'

function createContext() {
  const filters: string[] = []
  const textColors: string[] = []
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(() => textColors.push(String(context.fillStyle))),
    setLineDash: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 20 })),
    globalAlpha: 1,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  }
  Object.defineProperty(context, 'filter', {
    configurable: true,
    get: () => filters.at(-1) ?? 'none',
    set: (value: string) => filters.push(value),
  })
  return {
    ctx: context as unknown as CanvasRenderingContext2D,
    filters,
    textColors,
  }
}

const params: NarrativeParams = {
  line1: '把复杂的工作',
  line2: '交给自动化',
  explanation: '让系统处理重复步骤，人只负责判断与创造。',
  duration: 5.2,
}

describe('narrative canvas renderer', () => {
  it('draws every narrative text element only on the left half', () => {
    const { ctx, textColors } = createContext()

    renderNarrativeToCanvas({
      ctx,
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

    const calls = vi.mocked(ctx.fillText).mock.calls
    expect(calls.map(([text]) => text)).toEqual(expect.arrayContaining([
      'NARRATIVE / 01',
      '把复杂的工作',
      '交给自动化',
      '让系统处理重复步骤，人只负责判断与创造。',
    ]))
    expect(calls.every(([, x]) => Number(x) < 960)).toBe(true)
    expect(textColors[0]).toBe('#2f67b2')
  })

  it('applies the sampled headline blur during the entrance', () => {
    const { ctx, filters } = createContext()

    renderNarrativeToCanvas({
      ctx,
      params,
      localTime: 0.24,
      resources: {
        width: 1920,
        height: 1080,
        displayFont: 'Syne Variable',
        monoFont: 'IBM Plex Mono',
        contentFont: 'Noto Sans SC Variable',
      },
    })

    expect(filters.some((filter) => /^blur\((?!0(?:\.0+)?px)/.test(filter)))
      .toBe(true)
  })
})
