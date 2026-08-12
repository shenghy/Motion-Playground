import { describe, expect, it, vi } from 'vitest'
import {
  CANVAS_COLORS,
  drawGrid,
  drawHatchFill,
  drawPanel,
  drawPencilLine,
  drawText,
  withAlpha,
} from './primitives'

function recordingContext() {
  const states: Array<Record<string, unknown>> = []
  const context = {} as CanvasRenderingContext2D
  const save = vi.fn(() => {
    states.push({
      globalAlpha: context.globalAlpha,
      globalCompositeOperation: context.globalCompositeOperation,
      fillStyle: context.fillStyle,
      strokeStyle: context.strokeStyle,
      lineWidth: context.lineWidth,
      font: context.font,
      textAlign: context.textAlign,
      textBaseline: context.textBaseline,
      shadowColor: context.shadowColor,
      shadowBlur: context.shadowBlur,
      shadowOffsetX: context.shadowOffsetX,
      shadowOffsetY: context.shadowOffsetY,
    })
  })
  const restore = vi.fn(() => Object.assign(context, states.pop()))
  Object.assign(context, {
    save,
    restore,
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
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
  })
  return { context, save, restore }
}

describe('canvas drawing primitives', () => {
  it('exposes the canonical deep-blue motion accent palette', () => {
    expect(CANVAS_COLORS.accentBlue).toBe('#2f67b2')
    expect(CANVAS_COLORS.accentBlueMuted).toBe('rgba(47,103,178,.42)')
  })

  it.each([
    ['grid', (ctx: CanvasRenderingContext2D) => drawGrid(ctx, {
      width: 1920,
      height: 930,
      step: 96,
      alpha: 0.2,
    })],
    ['panel', (ctx: CanvasRenderingContext2D) => drawPanel(ctx, {
      x: 80,
      y: 120,
      width: 596,
      height: 720,
      alpha: 0.72,
    })],
    ['text', (ctx: CanvasRenderingContext2D) => drawText(ctx, {
      text: '透明导出',
      x: 80,
      y: 120,
      font: '600 48px sans-serif',
      color: '#f1eee5',
      maxWidth: 180,
    })],
    ['pencil line', (ctx: CanvasRenderingContext2D) => drawPencilLine(ctx, {
      x1: 20,
      y1: 30,
      x2: 200,
      y2: 32,
    })],
    ['hatch fill', (ctx: CanvasRenderingContext2D) => drawHatchFill(ctx, {
      x: 80,
      y: 120,
      width: 240,
      height: 360,
    })],
    ['alpha', (ctx: CanvasRenderingContext2D) => withAlpha(ctx, 0.35, () => {
      ctx.fillRect(0, 0, 10, 10)
    })],
  ])('isolates %s state with one save/restore pair', (_, draw) => {
    const { context, save, restore } = recordingContext()
    draw(context)
    expect(save).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledTimes(1)
    expect(context.globalAlpha).toBe(1)
    expect(context.globalCompositeOperation).toBe('source-over')
  })

  it('draws text with a top baseline and bounded width', () => {
    const { context } = recordingContext()
    drawText(context, {
      text: '1234567890',
      x: 40,
      y: 50,
      font: '600 40px sans-serif',
      color: '#f1eee5',
      maxWidth: 60,
    })
    expect(context.fillText).toHaveBeenCalledWith('1234567890', 40, 50, 60)
  })

  it('applies optional text shadow only during the text draw', () => {
    const { context } = recordingContext()
    const activeShadows: Array<[string, number, number, number]> = []
    context.fillText = vi.fn(() => {
      activeShadows.push([
        context.shadowColor,
        context.shadowBlur,
        context.shadowOffsetX,
        context.shadowOffsetY,
      ])
    }) as unknown as CanvasRenderingContext2D['fillText']

    drawText(context, {
      text: '白色标题',
      x: 132,
      y: 250,
      font: '650 90px sans-serif',
      color: '#f1eee5',
      maxWidth: 720,
      shadow: {
        color: 'rgba(38, 40, 43, 0.8)',
        blur: 10,
        offsetX: 4,
        offsetY: 5,
      },
    })

    expect(activeShadows).toEqual([['rgba(38, 40, 43, 0.8)', 10, 4, 5]])
    expect(context.shadowColor).toBe('rgba(0, 0, 0, 0)')
    expect(context.shadowBlur).toBe(0)
    expect(context.shadowOffsetX).toBe(0)
    expect(context.shadowOffsetY).toBe(0)
  })

  it('fills a frameless panel without drawing an export border', () => {
    const { context } = recordingContext()
    drawPanel(context, {
      x: 80,
      y: 120,
      width: 596,
      height: 720,
      stroke: null,
    })
    expect(context.fillRect).toHaveBeenCalledOnce()
    expect(context.strokeRect).not.toHaveBeenCalled()
  })
})
