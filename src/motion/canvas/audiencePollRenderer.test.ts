import { describe, expect, it, vi } from 'vitest'
import type { AudiencePollParams } from '../types'
import { renderAudiencePollToCanvas } from './audiencePollRenderer'

function createContext() {
  const strokeAlphas: number[] = []
  const textDraws: Array<{
    text: string
    x: number
    y: number
    maxWidth: number | undefined
    font: string
  }> = []
  const context = {
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), stroke: vi.fn(() => strokeAlphas.push(context.globalAlpha)),
    fillRect: vi.fn(), strokeRect: vi.fn(),
    fillText: vi.fn((text: string, x: number, y: number, maxWidth?: number) => {
      textDraws.push({ text, x, y, maxWidth, font: context.font })
    }), setLineDash: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 18 })),
    globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', filter: 'none',
  }
  return {
    ctx: context as unknown as CanvasRenderingContext2D,
    strokeAlphas,
    textDraws,
  }
}

const params: AudiencePollParams = {
  eyebrow: '08 / LIVE POLL', title: '你更看好哪种开发方式？',
  option1: 'AI 辅助开发', option2: '传统手写代码', option3: '两者结合', option4: '其他方式',
  callToAction: '把编号打在弹幕或评论区，告诉我你的选择', duration: 6.2,
}

describe('audience poll canvas renderer', () => {
  it('draws the same filtered labels, title, and call to action without fake results', () => {
    const { ctx } = createContext()
    renderAudiencePollToCanvas({ ctx, params, localTime: 3.4, resources: {
      width: 1920, height: 1080, displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono', contentFont: 'Noto Sans SC Variable',
    } })

    const texts = vi.mocked(ctx.fillText).mock.calls.map(([text]) => text)
    expect(texts).toEqual(expect.arrayContaining([
      '08 / LIVE POLL', '你更看好哪种开发方式？', '01', 'AI 辅助开发',
      '02', '传统手写代码', '03', '两者结合', '04', '其他方式',
      '把编号打在弹幕或评论区，告诉我你的选择',
    ]))
    expect(texts).not.toContain('')
    expect(texts.some((text) => String(text).includes('%'))).toBe(false)
  })

  it('keeps panels, rules, option boxes, and text strictly left of the actual x 749 safe threshold', () => {
    const { ctx } = createContext()
    renderAudiencePollToCanvas({ ctx, params, localTime: 3.4, resources: {
      width: 1920, height: 1080, displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono', contentFont: 'Noto Sans SC Variable',
    } })

    const safeX = 749
    const linePoints = [...vi.mocked(ctx.moveTo).mock.calls, ...vi.mocked(ctx.lineTo).mock.calls]
    const rectRights = [...vi.mocked(ctx.fillRect).mock.calls, ...vi.mocked(ctx.strokeRect).mock.calls]
      .map(([x, , width]) => Number(x) + Number(width))
    const textRights = vi.mocked(ctx.fillText).mock.calls
      .map(([, x, , maxWidth]) => Number(x) + Number(maxWidth))

    expect(linePoints.every(([x]) => Number(x) < safeX)).toBe(true)
    expect(rectRights.every((right) => right < safeX)).toBe(true)
    expect(textRights.every((right) => right < safeX)).toBe(true)
    expect(ctx.fillRect).toHaveBeenCalledWith(122, 119, 610, 779)
    expect(ctx.lineTo).toHaveBeenCalledWith(702, expect.any(Number))
  })

  it('matches the open React panel with exit-driven top and left rules only', () => {
    const stable = createContext()
    renderAudiencePollToCanvas({ ctx: stable.ctx, params, localTime: 3.4, resources: {
      width: 1920, height: 1080, displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono', contentFont: 'Noto Sans SC Variable',
    } })

    expect(stable.ctx.strokeRect).not.toHaveBeenCalledWith(122, 119, 610, 779)
    expect(stable.ctx.moveTo).toHaveBeenCalledWith(122, 119)
    expect(stable.ctx.lineTo).toHaveBeenCalledWith(732, 119)
    expect(stable.ctx.moveTo).toHaveBeenCalledWith(122, 119)
    expect(stable.ctx.lineTo).toHaveBeenCalledWith(122, 898)

    const exited = createContext()
    renderAudiencePollToCanvas({ ctx: exited.ctx, params, localTime: 6.2, resources: {
      width: 1920, height: 1080, displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono', contentFont: 'Noto Sans SC Variable',
    } })
    expect(exited.strokeAlphas.slice(0, 2)).toEqual([0, 0])
  })

  it('maps the React percentage and cqw geometry at 1920 by 1080', () => {
    const { ctx, textDraws } = createContext()
    renderAudiencePollToCanvas({ ctx, params, localTime: 3.4, resources: {
      width: 1920, height: 1080, displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono', contentFont: 'Noto Sans SC Variable',
    } })

    expect(ctx.fillRect).toHaveBeenCalledWith(122, 119, 610, 779)
    expect(ctx.lineTo).toHaveBeenCalledWith(732, 119)
    expect(ctx.lineTo).toHaveBeenCalledWith(122, 898)
    expect(textDraws.find(({ text }) => text === params.eyebrow)).toMatchObject({
      x: 152, y: 152, maxWidth: 550, font: '600 15px IBM Plex Mono',
    })
    expect(textDraws.find(({ text }) => text === params.option1)).toMatchObject({
      x: 223, maxWidth: 466, font: '550 21px Noto Sans SC Variable',
    })
  })

  it.each([
    ['two', { option3: '', option4: '' }],
    ['four', {}],
  ])('anchors the CTA above the panel bottom with %s options', (_label, optionOverrides) => {
    const { ctx, textDraws } = createContext()
    const caseParams = { ...params, ...optionOverrides }
    renderAudiencePollToCanvas({ ctx, params: caseParams, localTime: 3.4, resources: {
      width: 1920, height: 1080, displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono', contentFont: 'Noto Sans SC Variable',
    } })

    expect(ctx.moveTo).toHaveBeenCalledWith(152, 829)
    expect(ctx.lineTo).toHaveBeenCalledWith(702, 829)
    expect(textDraws.find(({ text }) => text === params.callToAction)).toMatchObject({
      x: 152, y: 849, maxWidth: 550, font: '450 16px Noto Sans SC Variable',
    })
  })

  it('wraps a maximum-length title to two fixed-size lines instead of shrinking one line', () => {
    const { ctx, textDraws } = createContext()
    const longTitle = 'How should product teams build reliable AI features for every customer'
    renderAudiencePollToCanvas({ ctx, params: { ...params, title: longTitle }, localTime: 3.4, resources: {
      width: 1920, height: 1080, displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono', contentFont: 'Noto Sans SC Variable',
    } })

    const titleLines = textDraws.filter(({ font }) => font === '600 33px Noto Sans SC Variable')
    expect(titleLines).toHaveLength(2)
    expect(titleLines.map(({ y }) => y)).toEqual([188, 229])
    expect(titleLines.every(({ maxWidth }) => maxWidth === 550)).toBe(true)
  })
})
