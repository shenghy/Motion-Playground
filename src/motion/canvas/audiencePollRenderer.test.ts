import { describe, expect, it, vi } from 'vitest'
import type { AudiencePollParams } from '../types'
import { renderAudiencePollToCanvas } from './audiencePollRenderer'

function realisticTextWidth(value: string, font: string) {
  const fontSize = Number(font.match(/([\d.]+)px/)?.[1] ?? 16)
  return Array.from(value).reduce((width, character) => {
    if (/\s/u.test(character)) return width + fontSize * 0.25
    if (/\p{Script=Han}/u.test(character)) return width + fontSize
    if (/[A-Z]/u.test(character)) return width + fontSize * 0.64
    if (/[a-z]/u.test(character)) return width + fontSize * 0.52
    if (/\d/u.test(character)) return width + fontSize * 0.6
    return width + fontSize * 0.33
  }, 0)
}

function createContext(measureWidth = (text: string, font: string) => {
  void font
  return text.length * 18
}) {
  const strokeAlphas: number[] = []
  const textDraws: Array<{
    text: string
    x: number
    y: number
    maxWidth: number | undefined
    font: string
    letterSpacing: string
  }> = []
  const context = {
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), stroke: vi.fn(() => strokeAlphas.push(context.globalAlpha)),
    fillRect: vi.fn(), strokeRect: vi.fn(),
    fillText: vi.fn((text: string, x: number, y: number, maxWidth?: number) => {
      textDraws.push({
        text, x, y, maxWidth, font: context.font, letterSpacing: context.letterSpacing,
      })
    }), setLineDash: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: measureWidth(text, context.font) })),
    globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    font: '10px sans-serif', letterSpacing: '0px',
    textAlign: 'start', textBaseline: 'alphabetic', filter: 'none',
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

  it('keeps all drawing strictly left of the 39% presenter safe threshold', () => {
    const { ctx } = createContext()
    renderAudiencePollToCanvas({ ctx, params, localTime: 3.4, resources: {
      width: 1920, height: 1080, displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono', contentFont: 'Noto Sans SC Variable',
    } })

    const safeX = 1920 * 0.39
    const linePoints = [...vi.mocked(ctx.moveTo).mock.calls, ...vi.mocked(ctx.lineTo).mock.calls]
    const rectRights = [...vi.mocked(ctx.fillRect).mock.calls, ...vi.mocked(ctx.strokeRect).mock.calls]
      .map(([x, , width]) => Number(x) + Number(width))
    const textRights = vi.mocked(ctx.fillText).mock.calls
      .map(([, x, , maxWidth]) => Number(x) + Number(maxWidth))

    expect(linePoints.every(([x]) => Number(x) < safeX)).toBe(true)
    expect(rectRights.every((right) => right < safeX)).toBe(true)
    expect(textRights.every((right) => right < safeX)).toBe(true)
    expect(ctx.fillRect).toHaveBeenCalledWith(122, 119, 610, 779)
    expect(122 + 610).toBe(732)
    expect(122 + 610).toBeLessThan(safeX)
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
      x: 152, y: 152, maxWidth: 550, font: '400 15px IBM Plex Mono',
    })
    expect(textDraws.find(({ text }) => text === params.option1)).toMatchObject({
      x: 223,
      maxWidth: 466,
      font: '500 21px Noto Sans SC Variable',
      letterSpacing: '0.035em',
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
      x: 152,
      y: 849,
      maxWidth: 550,
      font: '500 16px Noto Sans SC Variable',
      letterSpacing: '0.035em',
    })
  })

  it.each([
    ['Chinese', '这是一个需要稳定换行展示的中文投票问题吗'],
    ['mixed Chinese and English', 'AI产品如何稳定服务全球用户与开发团队呢'],
  ])('wraps a real maxLength 20 %s title into two 33px lines', (_label, longTitle) => {
    expect(Array.from(longTitle)).toHaveLength(20)
    const { ctx, textDraws } = createContext(realisticTextWidth)
    renderAudiencePollToCanvas({ ctx, params: { ...params, title: longTitle }, localTime: 3.4, resources: {
      width: 1920, height: 1080, displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono', contentFont: 'Noto Sans SC Variable',
    } })

    const titleLines = textDraws.filter(({ font }) => font === '500 33px Noto Sans SC Variable')
    expect(titleLines).toHaveLength(2)
    expect(titleLines.map(({ y }) => y)).toEqual([188, 229])
    expect(titleLines[1].y - titleLines[0].y).toBe(41)
    expect(titleLines.map(({ text }) => Array.from(text).length)).toEqual([10, 10])
    expect(titleLines.every(({ maxWidth }) => maxWidth === 550)).toBe(true)
    expect(titleLines.every(({ letterSpacing }) => letterSpacing === '0.025em')).toBe(true)
    expect(titleLines.map(({ text }) => text).join('')).toBe(longTitle)
    expect(titleLines[1].text).not.toMatch(/…$/u)
  })

  it('fits four 61px options below a two-line title with 12px gaps before the fixed CTA', () => {
    const title = '这是一个需要稳定换行展示的中文投票问题吗'
    const optionLabels = ['第一个选项', '第二个选项', '第三个选项', '第四个选项']
    const caseParams = {
      ...params,
      title,
      option1: optionLabels[0],
      option2: optionLabels[1],
      option3: optionLabels[2],
      option4: optionLabels[3],
    }
    const { ctx, textDraws } = createContext(realisticTextWidth)
    renderAudiencePollToCanvas({ ctx, params: caseParams, localTime: 3.4, resources: {
      width: 1920, height: 1080, displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono', contentFont: 'Noto Sans SC Variable',
    } })

    const optionRects = vi.mocked(ctx.fillRect).mock.calls
      .filter(([x]) => Number(x) === 152)
      .map(([x, y, width, height]) => [x, y, width, height])
    expect(optionRects).toEqual([
      [152, 315, 550, 61],
      [152, 388, 550, 61],
      [152, 461, 550, 61],
      [152, 534, 550, 61],
    ])
    for (let index = 1; index < optionRects.length; index += 1) {
      const previousBottom = Number(optionRects[index - 1][1]) + 61
      expect(Number(optionRects[index][1]) - previousBottom).toBe(12)
    }

    const numberDraws = textDraws.filter(({ text }) => /^0[1-4]$/.test(text))
    const labelDraws = textDraws.filter(({ text }) => optionLabels.includes(text))
    expect(numberDraws).toHaveLength(4)
    expect(numberDraws.every(({ font }) => font === '400 17px IBM Plex Mono')).toBe(true)
    expect(numberDraws.every(({ letterSpacing }) => letterSpacing === '0.08em')).toBe(true)
    expect(labelDraws).toHaveLength(4)
    expect(labelDraws.every(({ font }) => font === '500 21px Noto Sans SC Variable')).toBe(true)
    expect(labelDraws.every(({ letterSpacing }) => letterSpacing === '0.035em')).toBe(true)
    expect(Number(optionRects.at(-1)?.[1]) + 61).toBeLessThan(829)
    expect(ctx.lineTo).toHaveBeenCalledWith(702, 290)
    expect(ctx.lineTo).toHaveBeenCalledWith(702, 292)
  })

  it.each([
    ['wide Latin', 'WWWWWWWWWWWWWWWWWWWW', ['WWWWWWWWWW', 'WWWWWWWWWW']],
    ['over-limit ZWJ', '👨‍👩‍👧‍👦'.repeat(6), ['👨‍👩‍👧‍👦…']],
  ])('uses the canonical %s title lines without Canvas-only reflow', (
    _label,
    title,
    expectedLines,
  ) => {
    const { ctx, textDraws } = createContext(realisticTextWidth)
    renderAudiencePollToCanvas({ ctx, params: { ...params, title }, localTime: 3.4, resources: {
      width: 1920, height: 1080, displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono', contentFont: 'Noto Sans SC Variable',
    } })

    expect(textDraws
      .filter(({ font }) => font === '500 33px Noto Sans SC Variable')
      .map(({ text }) => text)).toEqual(expectedLines)
  })
})
