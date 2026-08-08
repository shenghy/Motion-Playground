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
      '效率提升',
      '+',
      '61.0',
      '%',
      '平均处理速度',
      '上升 18 点',
      '指标',
      '已锁定',
    ]))
    expect(ctx.clearRect).not.toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })
})
