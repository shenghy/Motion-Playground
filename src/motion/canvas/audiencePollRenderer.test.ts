import { describe, expect, it, vi } from 'vitest'
import type { AudiencePollParams } from '../types'
import { renderAudiencePollToCanvas } from './audiencePollRenderer'

function createContext() {
  return {
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), stroke: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    fillText: vi.fn(), setLineDash: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 18 })),
    globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', filter: 'none',
  } as unknown as CanvasRenderingContext2D
}

const params: AudiencePollParams = {
  eyebrow: '08 / LIVE POLL', title: '你更看好哪种开发方式？',
  option1: 'AI 辅助开发', option2: '', option3: '两者结合', option4: '',
  callToAction: '把编号打在弹幕或评论区，告诉我你的选择', duration: 6.2,
}

describe('audience poll canvas renderer', () => {
  it('draws the same filtered labels, title, and call to action without fake results', () => {
    const ctx = createContext()
    renderAudiencePollToCanvas({ ctx, params, localTime: 3.4, resources: {
      width: 1920, height: 1080, displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono', contentFont: 'Noto Sans SC Variable',
    } })

    const texts = vi.mocked(ctx.fillText).mock.calls.map(([text]) => text)
    expect(texts).toEqual(expect.arrayContaining([
      '08 / LIVE POLL', '你更看好哪种开发方式？', '01', 'AI 辅助开发',
      '02', '两者结合', '把编号打在弹幕或评论区，告诉我你的选择',
    ]))
    expect(texts).not.toContain('')
    expect(texts.some((text) => String(text).includes('%'))).toBe(false)
  })

  it('keeps panels, rules, option boxes, and text strictly left of x 768', () => {
    const ctx = createContext()
    renderAudiencePollToCanvas({ ctx, params, localTime: 3.4, resources: {
      width: 1920, height: 1080, displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono', contentFont: 'Noto Sans SC Variable',
    } })

    const safeX = 768
    const linePoints = [...vi.mocked(ctx.moveTo).mock.calls, ...vi.mocked(ctx.lineTo).mock.calls]
    const rectRights = [...vi.mocked(ctx.fillRect).mock.calls, ...vi.mocked(ctx.strokeRect).mock.calls]
      .map(([x, , width]) => Number(x) + Number(width))
    const textRights = vi.mocked(ctx.fillText).mock.calls
      .map(([, x, , maxWidth]) => Number(x) + Number(maxWidth))

    expect(linePoints.every(([x]) => Number(x) < safeX)).toBe(true)
    expect(rectRights.every((right) => right < safeX)).toBe(true)
    expect(textRights.every((right) => right < safeX)).toBe(true)
    expect(ctx.fillRect).toHaveBeenCalledWith(122, 118, 630, 736)
  })
})
