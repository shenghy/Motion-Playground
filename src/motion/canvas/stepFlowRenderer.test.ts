import { describe, expect, it, vi } from 'vitest'
import type { StepFlowParams } from '../types'
import { renderStepFlowToCanvas } from './stepFlowRenderer'

function createContext() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    arc: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 20 })),
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

const params: StepFlowParams = {
  eyebrow: '07 / PROCESS MAP',
  title: '发布流程',
  step1: '明确目标',
  step2: '准备内容',
  step3: '构建版本',
  step4: '内部检查',
  step5: '修正问题',
  step6: '最终确认',
  step7: '正式发布',
  focusStep: '6',
  statusLabel: '当前步骤',
  statusNote: '确认中',
  stepDuration: 1,
}

describe('step flow canvas renderer', () => {
  it('does not draw a completed connector while the current step is still active', () => {
    const ctx = createContext()

    renderStepFlowToCanvas({
      ctx,
      params,
      localTime: 0.7,
      resources: {
        width: 1920,
        height: 1080,
        displayFont: 'Syne Variable',
        monoFont: 'IBM Plex Mono',
        contentFont: 'Noto Sans SC Variable',
      },
    })

    const activeStepY = 330 + 5 * ((820 - 330) / 6)
    expect(ctx.moveTo).not.toHaveBeenCalledWith(166, activeStepY)
  })

  it('draws seven vertical steps inside the left safe content area', () => {
    const ctx = createContext()

    renderStepFlowToCanvas({
      ctx,
      params,
      localTime: 1.65,
      resources: {
        width: 1920,
        height: 1080,
        displayFont: 'Syne Variable',
        monoFont: 'IBM Plex Mono',
        contentFont: 'Noto Sans SC Variable',
      },
    })

    const textCalls = vi.mocked(ctx.fillText).mock.calls
    const drawnText = textCalls.map(([value]) => value)
    const stepLabels = new Set([
      params.step1,
      params.step2,
      params.step3,
      params.step4,
      params.step5,
      params.step6,
      params.step7,
    ])
    const stepCalls = textCalls.filter(([value]) => stepLabels.has(value))

    expect(drawnText).toEqual(expect.arrayContaining([
      '明确目标',
      '准备内容',
      '构建版本',
      '内部检查',
      '修正问题',
      '最终确认',
      '正式发布',
    ]))
    expect(textCalls.every(([, x]) => Number(x) < 1152)).toBe(true)
    expect(stepCalls.every(([, , y]) => Number(y) < 900)).toBe(true)
    expect(ctx.bezierCurveTo).not.toHaveBeenCalled()
    expect(ctx.arc).not.toHaveBeenCalled()
    expect(ctx.lineTo).toHaveBeenCalledWith(166, 820)
  })

  it('keeps every drawn boundary left of the presenter safe line', () => {
    const ctx = createContext()

    renderStepFlowToCanvas({
      ctx,
      params,
      localTime: 1.65,
      resources: {
        width: 1920,
        height: 1080,
        displayFont: 'Syne Variable',
        monoFont: 'IBM Plex Mono',
        contentFont: 'Noto Sans SC Variable',
      },
    })

    const safeLineX = 749
    const lineEndpoints = [
      ...vi.mocked(ctx.moveTo).mock.calls,
      ...vi.mocked(ctx.lineTo).mock.calls,
    ]
    const rectangleRightEdges = [
      ...vi.mocked(ctx.fillRect).mock.calls,
      ...vi.mocked(ctx.strokeRect).mock.calls,
    ].map(([x, , width]) => Number(x) + Number(width))
    const textRightEdges = vi.mocked(ctx.fillText).mock.calls
      .map(([, x, , maxWidth]) => Number(x) + Number(maxWidth))

    expect(lineEndpoints.every(([x]) => Number(x) < safeLineX)).toBe(true)
    expect(rectangleRightEdges.every((right) => right < safeLineX)).toBe(true)
    expect(textRightEdges.every((right) => right < safeLineX)).toBe(true)
    expect(ctx.fillRect).toHaveBeenCalledWith(122, 110, 610, 760)
    expect(ctx.lineTo).toHaveBeenCalledWith(700, 265)
    expect(ctx.lineTo).toHaveBeenCalledWith(700, expect.any(Number))
  })
})
