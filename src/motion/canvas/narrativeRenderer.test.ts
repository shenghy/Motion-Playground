import { describe, expect, it, vi } from 'vitest'
import type { NarrativeParams } from '../types'
import { renderNarrativeToCanvas } from './narrativeRenderer'

function createContext() {
  const filters: string[] = []
  const textColors: string[] = []
  const textDraws: Array<{
    text: string
    font: string
    x: number
    y: number
    maxWidth: number
    shadowColor: string
    shadowBlur: number
    shadowOffsetX: number
    shadowOffsetY: number
  }> = []
  const states: Array<Record<string, unknown>> = []
  const context = {
    save: vi.fn(() => {
      states.push({
        shadowColor: context.shadowColor,
        shadowBlur: context.shadowBlur,
        shadowOffsetX: context.shadowOffsetX,
        shadowOffsetY: context.shadowOffsetY,
      })
    }),
    restore: vi.fn(() => Object.assign(context, states.pop())),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillRect: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn((text: string, x: number, y: number, maxWidth: number) => {
      textColors.push(String(context.fillStyle))
      textDraws.push({
        text,
        font: context.font,
        x,
        y,
        maxWidth,
        shadowColor: context.shadowColor,
        shadowBlur: context.shadowBlur,
        shadowOffsetX: context.shadowOffsetX,
        shadowOffsetY: context.shadowOffsetY,
      })
    }),
    setLineDash: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 20 })),
    globalAlpha: 1,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
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
    textDraws,
  }
}

const params: NarrativeParams = {
  line1: '把复杂的工作',
  line2: '交给自动化',
  explanation: '让系统处理重复步骤，人只负责判断与创造。',
  keywords: '',
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
    expect(textColors[0]).toBe('rgba(255,255,255,.72)')
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

  it('uses strong headline shadows and lighter explanation shadows', () => {
    const { ctx, textDraws } = createContext()

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

    const headlineDraws = textDraws.filter(({ text }) => (
      text === params.line1 || text === params.line2
    ))
    const explanationDraws = textDraws.filter(({ text }) => (
      params.explanation?.includes(text)
    ))
    const neutralDraws = textDraws.filter(({ text }) => (
      text !== params.line1
        && text !== params.line2
        && !params.explanation?.includes(text)
    ))

    expect(headlineDraws).toHaveLength(2)
    expect(headlineDraws.every((draw) => (
      draw.shadowColor === 'rgba(38, 40, 43, 0.8)'
        && draw.shadowBlur === 10
        && draw.shadowOffsetX === 4
        && draw.shadowOffsetY === 5
    ))).toBe(true)
    expect(explanationDraws.length).toBeGreaterThan(0)
    expect(explanationDraws.every((draw) => (
      draw.shadowColor === 'rgba(38, 40, 43, 0.8)'
        && draw.shadowBlur === 6
        && draw.shadowOffsetX === 2
        && draw.shadowOffsetY === 3
    ))).toBe(true)
    expect(neutralDraws.every((draw) => (
      draw.shadowColor === 'rgba(0, 0, 0, 0)'
        && draw.shadowBlur === 0
        && draw.shadowOffsetX === 0
        && draw.shadowOffsetY === 0
    ))).toBe(true)
  })

  it('highlights narrative keywords in orange across headline and explanation', () => {
    const { ctx, textColors, textDraws } = createContext()
    const keywordParams: NarrativeParams = {
      ...params,
      keywords: '自动化|重复步骤',
    }

    renderNarrativeToCanvas({
      ctx,
      params: keywordParams,
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
      '交给',
      '自动化',
      '让系统处理',
      '重复步骤',
    ]))
    const segmentDraws = textDraws.filter(({ text }) => (
      text === '自动化' || text === '重复步骤'
    ))
    expect(segmentDraws).toHaveLength(2)
    expect(textColors).toContain('#FF6A00')
    // 未命中片段仍是白色
    const plainDraws = textDraws.filter(({ text }) => text === '交给')
    expect(plainDraws).toHaveLength(1)
  })

  it('keeps two English headlines on separate lines', () => {
    const { ctx, textDraws } = createContext()
    const englishParams = {
      ...params,
      line1: 'BUILD SMARTER AGENTS',
      line2: 'SHIP RELIABLE AI',
    }

    renderNarrativeToCanvas({
      ctx,
      params: englishParams,
      localTime: 2,
      resources: {
        width: 1920,
        height: 1080,
        displayFont: 'Syne Variable',
        monoFont: 'IBM Plex Mono',
        contentFont: 'Noto Sans SC Variable',
      },
    })

    const headlineDraws = textDraws.filter(({ text }) => (
      text === englishParams.line1 || text === englishParams.line2
    ))
    expect(headlineDraws).toHaveLength(2)
    expect(headlineDraws[1].y - headlineDraws[0].y).toBeGreaterThanOrEqual(112)
  })

  it('draws long explanation copy as at most two uncompressed 30px lines', () => {
    const { ctx, textDraws } = createContext()
    ctx.measureText = vi.fn((text: string) => ({
      width: Array.from(text).length * 30,
    })) as unknown as CanvasRenderingContext2D['measureText']
    const explanation = '让系统处理重复步骤人只负责判断与创造让内容更加清楚'

    renderNarrativeToCanvas({
      ctx,
      params: { ...params, explanation },
      localTime: 2,
      resources: {
        width: 1920,
        height: 1080,
        displayFont: 'Syne Variable',
        monoFont: 'IBM Plex Mono',
        contentFont: 'Noto Sans SC Variable',
      },
    })

    const explanationDraws = textDraws.filter(({ text }) => (
      explanation.includes(text)
    ))
    expect(explanationDraws).toHaveLength(2)
    expect(explanationDraws.map(({ text }) => text).join('')).toBe(explanation)
    expect(explanationDraws.every(({ font }) => font.includes('30px'))).toBe(true)
    expect(explanationDraws.every(({ text, x, y }) => (
      x + ctx.measureText(text).width <= 792 && y + 30 <= 590
    ))).toBe(true)
  })
})
