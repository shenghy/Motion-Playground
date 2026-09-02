import { describe, expect, it, vi } from 'vitest'
import { CANVAS_COLORS } from '../../export/canvas/primitives'
import type { PromptDisplayParams } from '../types'
import { renderPromptDisplayToCanvas } from './promptDisplayRenderer'

function recordingContext() {
  const records: Array<{
    text: string
    x: number
    y: number
    color: string
    font: string
    filter: string
  }> = []
  const stack: Array<Record<string, unknown>> = []
  const ctx = {
    globalAlpha: 1,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    filter: 'none',
    textAlign: 'start',
    textBaseline: 'top',
    save: vi.fn(function save(this: Record<string, unknown>) {
      stack.push({
        globalAlpha: this.globalAlpha,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        font: this.font,
        filter: this.filter,
        textAlign: this.textAlign,
        textBaseline: this.textBaseline,
      })
    }),
    restore: vi.fn(function restore(this: Record<string, unknown>) {
      Object.assign(this, stack.pop())
    }),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    translate: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: Array.from(text).reduce((width, character) => (
        width + (/\p{Script=Han}/u.test(character) ? 42 : 24)
      ), 0),
    })),
    fillText: vi.fn(function fillText(
      this: Record<string, unknown>, text: string, x: number, y: number,
    ) {
      records.push({
        text,
        x,
        y,
        color: String(this.fillStyle),
        font: String(this.font),
        filter: String(this.filter),
      })
    }),
  } as unknown as CanvasRenderingContext2D
  return { ctx, records }
}

const params: PromptDisplayParams = {
  eyebrow: 'AI PROMPT / 01',
  prompt: '请生成电影级写实的数据中心画面，突出冷暖光线对比与真实金属材质。',
  keywords: '电影级写实|冷暖光线对比|真实金属材质',
  holdDuration: 2,
  exitDuration: 0.18,
}

describe('prompt display canvas renderer', () => {
  it('draws large clipped text with orange keyword emphasis in the left safe area', () => {
    const { ctx, records } = recordingContext()

    renderPromptDisplayToCanvas({
      ctx,
      params,
      localTime: 6,
      localDuration: 8.18,
      resources: {
        width: 1920,
        height: 1080,
        displayFont: 'Display',
        monoFont: 'Mono',
        contentFont: 'Content',
      },
    })

    expect(ctx.fillRect).toHaveBeenCalledWith(78, 118, 650, 780)
    expect(ctx.rect).toHaveBeenCalledWith(110, 196, 580, 642)
    expect(ctx.clip).toHaveBeenCalled()
    const bodyRecords = records.filter(({ font }) => /\b42px\b/.test(font))
    expect(bodyRecords.length).toBeGreaterThan(0)
    expect(Math.min(...bodyRecords.map(({ y }) => y))).toBe(204)
    expect(records.filter(({ color }) => color === CANVAS_COLORS.accent)
      .map(({ text }) => text).join(''))
      .toContain('电影级写实')
    expect(records.every(({ x }) => x <= 690)).toBe(true)
  })

  it('scrolls overflowing text upward while keeping rendering clipped', () => {
    const { ctx } = recordingContext()
    const longPrompt = Array.from({ length: 16 }, (_, index) => (
      `第${index + 1}行电影级写实画面`
    )).join('\n')

    renderPromptDisplayToCanvas({
      ctx,
      params: { ...params, prompt: longPrompt },
      localTime: 7.5,
      localDuration: 10.18,
      resources: {
        width: 1920,
        height: 1080,
        displayFont: 'Display',
        monoFont: 'Mono',
        contentFont: 'Content',
      },
    })

    expect(ctx.translate).toHaveBeenCalledWith(0, expect.any(Number))
    const offsets = vi.mocked(ctx.translate).mock.calls.map(([, y]) => Number(y))
    expect(offsets.some((offset) => offset < 0)).toBe(true)
  })
})
