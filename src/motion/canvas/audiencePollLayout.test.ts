import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  AUDIENCE_POLL_CSS_SOURCE,
  audiencePollLayout,
  wrapAudiencePollTitle,
} from './audiencePollLayout'

const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

describe('audience poll preview/export layout contract', () => {
  it('maps the React percentage and cqw sources to the 1920 by 1080 export', () => {
    expect(AUDIENCE_POLL_CSS_SOURCE).toMatchObject({
      leftPercent: 6.35,
      topPercent: 11,
      widthPercent: 31.8,
      subtitleSafeBottomPercent: 13.8889,
      bottomExtraPercent: 3,
      paddingTopCqw: 1.75,
      paddingInlineCqw: 1.55,
      paddingBottomCqw: 1.3,
    })
    expect(audiencePollLayout.panel).toEqual({
      x: 122, y: 119, width: 610, endY: 898, height: 779,
    })
    expect(audiencePollLayout.content).toEqual({ x: 152, width: 550, right: 702 })
    expect(audiencePollLayout.cta).toMatchObject({ separatorY: 829, textY: 849 })

    expect(css).toMatch(/\.audience-poll__card\s*\{[^}]*left:\s*6\.35%/s)
    expect(css).toMatch(/\.audience-poll__card\s*\{[^}]*top:\s*11%/s)
    expect(css).toMatch(/\.audience-poll__card\s*\{[^}]*width:\s*31\.8%/s)
    expect(css).toMatch(/\.audience-poll__card\s*\{[^}]*padding:\s*1\.75cqw 1\.55cqw 1\.3cqw/s)
  })

  it.each([
    ['Chinese characters', '这是一个很长的中文投票标题需要稳定地换成两行而不是缩小成难以阅读的一行文字'],
    ['English words', 'How should product teams build reliable AI features for every customer'],
  ])('wraps %s deterministically to at most two lines', (_label, text) => {
    const ctx = {
      font: '',
      measureText: vi.fn((value: string) => ({ width: Array.from(value).length * 18 })),
    } as unknown as CanvasRenderingContext2D

    const lines = wrapAudiencePollTitle(
      ctx,
      text,
      '600 33px Noto Sans SC Variable',
    )

    expect(lines).toHaveLength(2)
    expect(lines.every((line) => ctx.measureText(line).width <= 550)).toBe(true)
    expect(ctx.font).toBe('600 33px Noto Sans SC Variable')
  })
})
