import { describe, expect, it, vi } from 'vitest'
import type { MetricFocusParams } from '../types'
import { renderMetricFocusToCanvas } from './metricFocusRenderer'

function createContext() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 20 })),
    translate: vi.fn(),
    scale: vi.fn(),
    globalAlpha: 1,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    filter: 'none',
  } as unknown as CanvasRenderingContext2D
}

function createMeasuredContext(widthPerCharacter: number) {
  const ctx = createContext()
  ctx.measureText = vi.fn((text: string) => ({
    width: text.length * Number(ctx.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 10) * widthPerCharacter,
  })) as unknown as CanvasRenderingContext2D['measureText']
  return ctx
}

const params: MetricFocusParams = {
  eyebrow: '效率提升',
  value: 61,
  prefix: '+',
  suffix: '%',
  description: '平均处理速度',
  trend: '上升 18 点',
  decimals: 1,
  duration: 1.2,
}

describe('metric focus canvas renderer', () => {
  it('draws all semantic text without clearing the shared surface', () => {
    const ctx = createContext()
    renderMetricFocusToCanvas({
      ctx,
      params,
      localTime: 1.2,
      resources: {
        width: 1920,
        height: 1080,
        displayFont: 'Syne Variable',
        monoFont: 'IBM Plex Mono',
        contentFont: 'Noto Sans SC Variable',
      },
    })

    const text = vi.mocked(ctx.fillText).mock.calls.map(([value]) => value)
    expect(text).toEqual(expect.arrayContaining([
      '效率提升 / 02',
      '+',
      '61.0',
      '%',
      '平均处理速度',
      '上升 18 点',
    ]))
    expect(
      vi.mocked(ctx.fillText).mock.calls.every(([, x]) => Number(x) < 1152),
    ).toBe(true)
    expect(ctx.strokeStyle).toBe('#2f67b2')
    expect(ctx.clearRect).not.toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('keeps every visible boundary inside the left 38 percent', () => {
    const ctx = createMeasuredContext(0.88)
    renderMetricFocusToCanvas({
      ctx,
      params: {
        ...params,
        value: 999,
        decimals: 2,
        prefix: '约为',
        suffix: '名员工',
      },
      localTime: 1.2,
      resources: {
        width: 1920,
        height: 1080,
        displayFont: 'Syne Variable',
        monoFont: 'IBM Plex Mono',
        contentFont: 'Noto Sans SC Variable',
      },
    })

    const safeRight = 1920 * 0.38
    const lineEndpoints = [
      ...vi.mocked(ctx.moveTo).mock.calls,
      ...vi.mocked(ctx.lineTo).mock.calls,
    ]
    const rectangleRightEdges = vi.mocked(ctx.fillRect).mock.calls
      .map(([x, , width]) => Number(x) + Number(width))
    const strokedRectangleRightEdges = vi.mocked(ctx.strokeRect).mock.calls
      .map(([x, , width]) => Number(x) + Number(width) + Number(ctx.lineWidth) / 2)
    const textRightEdges = vi.mocked(ctx.fillText).mock.calls
      .map(([, x, , maxWidth]) => Number(x) + Number(maxWidth))

    expect(lineEndpoints.every(([x]) => Number(x) <= safeRight)).toBe(true)
    expect(rectangleRightEdges.every((right) => right <= safeRight)).toBe(true)
    expect(strokedRectangleRightEdges.every((right) => right <= safeRight)).toBe(true)
    expect(textRightEdges.every((right) => right <= safeRight)).toBe(true)
  })

  it('keeps a long value with an empty suffix inside the safe boundary', () => {
    const ctx = createMeasuredContext(0.88)
    renderMetricFocusToCanvas({
      ctx,
      params: {
        ...params,
        value: 999,
        decimals: 2,
        prefix: '约为',
        suffix: '',
      },
      localTime: 1.2,
      resources: {
        width: 1920,
        height: 1080,
        displayFont: 'Syne Variable',
        monoFont: 'IBM Plex Mono',
        contentFont: 'Noto Sans SC Variable',
      },
    })

    const safeRight = 1920 * 0.38
    const barRight = vi.mocked(ctx.strokeRect).mock.calls
      .map(([x, , width]) => Number(x) + Number(width) + 1)
    expect(barRight.every((right) => right <= safeRight)).toBe(true)
  })

  it('preserves the value entrance style and aligns number units to one alphabetic baseline', () => {
    const ctx = createContext()
    const valueDraws: Array<{
      text: string
      alpha: number
      filter: string
      baseline: CanvasTextBaseline
      y: number
    }> = []
    ctx.fillText = vi.fn((text: string, _x: number, y: number) => {
      if (['+', '0.0', '%'].includes(text)) {
        valueDraws.push({
          text,
          alpha: ctx.globalAlpha,
          filter: ctx.filter,
          baseline: ctx.textBaseline,
          y,
        })
      }
    }) as unknown as CanvasRenderingContext2D['fillText']

    renderMetricFocusToCanvas({
      ctx,
      params,
      localTime: 0,
      resources: {
        width: 1920,
        height: 1080,
        displayFont: 'Syne Variable',
        monoFont: 'IBM Plex Mono',
        contentFont: 'Noto Sans SC Variable',
      },
    })

    expect(valueDraws).toHaveLength(3)
    expect(valueDraws.every(({ alpha }) => alpha === 0)).toBe(true)
    expect(valueDraws.every(({ filter }) => filter !== 'none')).toBe(true)
    expect(valueDraws.every(({ baseline }) => baseline === 'alphabetic')).toBe(true)
    expect(new Set(valueDraws.map(({ y }) => y)).size).toBe(1)
  })

  it('keeps the value font size stable while the number counts up', () => {
    const longParams = {
      ...params,
      value: 999,
      decimals: 2,
      prefix: '约为',
      suffix: '名员工',
    }
    const numberFontAt = (localTime: number) => {
      const ctx = createMeasuredContext(0.88)
      let numberFont = ''
      ctx.fillText = vi.fn((text: string) => {
        if (/^\d/.test(text)) numberFont = ctx.font
      }) as unknown as CanvasRenderingContext2D['fillText']
      renderMetricFocusToCanvas({
        ctx,
        params: longParams,
        localTime,
        resources: {
          width: 1920,
          height: 1080,
          displayFont: 'Syne Variable',
          monoFont: 'IBM Plex Mono',
          contentFont: 'Noto Sans SC Variable',
        },
      })
      return numberFont
    }

    expect(numberFontAt(0)).toBe(numberFontAt(2))
  })

  it('renders a number poster without bar rectangles', () => {
    const ctx = createContext()
    renderMetricFocusToCanvas({
      ctx,
      params,
      localTime: 8,
      resources: {
        width: 1920,
        height: 1080,
        displayFont: 'Syne Variable',
        monoFont: 'IBM Plex Mono',
        contentFont: 'Noto Sans SC Variable',
      },
    })

    expect(ctx.fillRect).not.toHaveBeenCalled()
    expect(ctx.strokeRect).not.toHaveBeenCalled()
  })
})
