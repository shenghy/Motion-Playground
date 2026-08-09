import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { getMotionDefinition } from '../registry'
import {
  AUDIENCE_POLL_CSS_SOURCE,
  audiencePollLayout,
  audiencePollTypography,
  splitAudiencePollTitle,
} from './audiencePollLayout'

const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')
const mainSource = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8')
const workerFontsSource = readFileSync(
  resolve(process.cwd(), 'src/export/worker/fonts.ts'),
  'utf8',
)

function getRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's'))?.[1]
  if (!rule) throw new Error(`Missing CSS rule: ${selector}`)
  return rule
}

function property(rule: string, name: string) {
  const value = rule.match(new RegExp(`${name}:\\s*([^;]+)`))?.[1]?.trim()
  if (!value) throw new Error(`Missing CSS property: ${name}`)
  return value
}

function numberWithUnit(value: string, unit: string) {
  const parsed = Number(value.match(new RegExp(`([\\d.]+)${unit}`))?.[1])
  if (!Number.isFinite(parsed)) throw new Error(`Missing ${unit} value in: ${value}`)
  return parsed
}

function fontCqw(rule: string) {
  return numberWithUnit(property(rule, 'font'), 'cqw')
}

function requiredAt(values: number[] | undefined, index: number, label: string) {
  const value = values?.[index]
  if (!Number.isFinite(value)) throw new Error(`Missing CSS token: ${label}`)
  return value as number
}

describe('audience poll preview/export layout contract', () => {
  it('derives the 1920 by 1080 export contract from the actual React CSS', () => {
    const rootRule = getRule('.preview-canvas')
    const cardRule = getRule('.audience-poll__card')
    const eyebrowRule = getRule('.audience-poll__eyebrow')
    const titleRule = getRule('.audience-poll__card > h2.motion-content-text')
    const optionsRule = getRule('.audience-poll__options')
    const optionRule = getRule('.audience-poll__option')
    const numberRule = getRule('.audience-poll__option b')
    const labelRule = getRule('.audience-poll__option .motion-content-text')
    const ctaRule = getRule('.audience-poll__cta.motion-content-text')
    const padding = property(cardRule, 'padding').match(/[\d.]+cqw/g)
      ?.map((value) => Number.parseFloat(value))
    const titleMargin = property(titleRule, 'margin').match(/[\d.]+cqw/g)
      ?.map((value) => Number.parseFloat(value))
    const bottomExtra = Number(
      property(cardRule, 'bottom').match(/\+\s*([\d.]+)%/)?.[1],
    )

    const parsedCssSource = {
      viewportWidth: 1920,
      viewportHeight: 1080,
      leftPercent: numberWithUnit(property(cardRule, 'left'), '%'),
      topPercent: numberWithUnit(property(cardRule, 'top'), '%'),
      widthPercent: numberWithUnit(property(cardRule, 'width'), '%'),
      subtitleSafeBottomPercent: numberWithUnit(
        property(rootRule, '--subtitle-safe-bottom'),
        '%',
      ),
      bottomExtraPercent: bottomExtra,
      paddingTopCqw: requiredAt(padding, 0, 'card padding top'),
      paddingInlineCqw: requiredAt(padding, 1, 'card padding inline'),
      paddingBottomCqw: requiredAt(padding, 2, 'card padding bottom'),
      eyebrowFontCqw: fontCqw(eyebrowRule),
      titleMarginTopCqw: requiredAt(titleMargin, 0, 'title margin top'),
      titleFontCqw: numberWithUnit(property(titleRule, 'font-size'), 'cqw'),
      titleLineHeight: Number(property(titleRule, 'line-height')),
      titlePaddingBottomCqw: numberWithUnit(property(titleRule, 'padding-bottom'), 'cqw'),
      titleMarginBottomCqw: requiredAt(titleMargin, 1, 'title margin bottom'),
      titleBorderBottomPx: numberWithUnit(
        property(titleRule, 'border-bottom'),
        'px',
      ),
      optionHeightCqw: numberWithUnit(property(optionRule, 'min-height'), 'cqw'),
      optionGapCqw: numberWithUnit(property(optionsRule, 'gap'), 'cqw'),
      optionPaddingInlineCqw: Number.parseFloat(
        property(optionRule, 'padding').match(/[\d.]+cqw/g)?.[1] ?? '',
      ),
      optionNumberColumnCqw: numberWithUnit(
        property(optionRule, 'grid-template-columns'),
        'cqw',
      ),
      optionColumnGapCqw: numberWithUnit(property(optionRule, 'gap'), 'cqw'),
      optionNumberFontCqw: fontCqw(numberRule),
      optionLabelFontCqw: numberWithUnit(property(labelRule, 'font-size'), 'cqw'),
      ctaPaddingTopCqw: numberWithUnit(property(ctaRule, 'padding-top'), 'cqw'),
      ctaFontCqw: numberWithUnit(property(ctaRule, 'font-size'), 'cqw'),
      ctaLineHeight: Number(property(ctaRule, 'line-height')),
    }

    expect(parsedCssSource).toEqual(AUDIENCE_POLL_CSS_SOURCE)

    const cqw = parsedCssSource.viewportWidth / 100
    const rawTop = parsedCssSource.viewportHeight * parsedCssSource.topPercent / 100
    const rawEnd = parsedCssSource.viewportHeight * (1 - (
      parsedCssSource.subtitleSafeBottomPercent + parsedCssSource.bottomExtraPercent
    ) / 100)
    const panelX = Math.round(
      parsedCssSource.viewportWidth * parsedCssSource.leftPercent / 100,
    )
    const panelWidth = Math.floor(
      parsedCssSource.viewportWidth * parsedCssSource.widthPercent / 100,
    )
    const contentInset = Math.round(parsedCssSource.paddingInlineCqw * cqw)
    const contentX = Math.round(
      parsedCssSource.viewportWidth * parsedCssSource.leftPercent / 100
      + parsedCssSource.paddingInlineCqw * cqw,
    )
    const contentRight = panelX + panelWidth - contentInset
    const titleY = Math.round(rawTop + (
      parsedCssSource.paddingTopCqw
      + parsedCssSource.eyebrowFontCqw
      + parsedCssSource.titleMarginTopCqw
    ) * cqw)
    const ctaSeparatorY = Math.round(rawEnd - (
      parsedCssSource.paddingBottomCqw
      + parsedCssSource.ctaPaddingTopCqw
      + parsedCssSource.ctaFontCqw * parsedCssSource.ctaLineHeight
    ) * cqw)

    expect(audiencePollLayout.panel).toEqual({
      x: panelX,
      y: Math.round(rawTop),
      width: panelWidth,
      endY: Math.round(rawEnd),
      height: Math.round(rawEnd) - Math.round(rawTop),
    })
    expect(audiencePollLayout.content).toEqual({
      x: contentX,
      width: contentRight - contentX,
      right: contentRight,
    })
    expect(audiencePollLayout.title).toMatchObject({
      y: titleY,
      fontSize: Math.round(parsedCssSource.titleFontCqw * cqw),
      lineHeight: Math.round(
        parsedCssSource.titleFontCqw * parsedCssSource.titleLineHeight * cqw,
      ),
      borderWidth: parsedCssSource.titleBorderBottomPx,
    })
    expect(audiencePollLayout.options).toMatchObject({
      height: Math.round(parsedCssSource.optionHeightCqw * cqw),
      gap: Math.round(parsedCssSource.optionGapCqw * cqw),
      numberFontSize: Math.round(parsedCssSource.optionNumberFontCqw * cqw),
      labelFontSize: Math.round(parsedCssSource.optionLabelFontCqw * cqw),
    })
    expect(audiencePollLayout.cta).toMatchObject({
      separatorY: ctaSeparatorY,
      fontSize: Math.round(parsedCssSource.ctaFontCqw * cqw),
    })
  })

  it('matches the shared typography and deterministic wrap contract to real CSS', () => {
    const eyebrowRule = getRule('.audience-poll__eyebrow')
    const titleRule = getRule('.audience-poll__card > h2.motion-content-text')
    const optionRule = getRule('.audience-poll__option .motion-content-text')
    const numberRule = getRule('.audience-poll__option b')
    const ctaRule = getRule('.audience-poll__cta.motion-content-text')
    const fontWeight = (rule: string) => Number(
      property(rule, 'font-weight').match(/\d+/)?.[0],
    )
    const shorthandWeight = (rule: string) => Number(
      property(rule, 'font').match(/^\s*(\d+)/)?.[1],
    )
    const em = (rule: string) => `${numberWithUnit(
      property(rule, 'letter-spacing'),
      'em',
    )}em`

    expect({
      contentFontWeight: fontWeight(titleRule),
      titleLetterSpacing: em(titleRule),
      bodyLetterSpacing: em(optionRule),
      numberFontWeight: shorthandWeight(numberRule),
      numberLetterSpacing: em(numberRule),
      eyebrowFontWeight: shorthandWeight(eyebrowRule),
      eyebrowLetterSpacing: em(eyebrowRule),
      titleWrap: property(titleRule, 'text-wrap'),
    }).toEqual(audiencePollTypography)
    expect(fontWeight(optionRule)).toBe(audiencePollTypography.contentFontWeight)
    expect(fontWeight(ctaRule)).toBe(audiencePollTypography.contentFontWeight)
    expect(em(ctaRule)).toBe(audiencePollTypography.bodyLetterSpacing)
    expect(property(titleRule, 'border-bottom')).toMatch(/^3px\s+double\b/)
    expect(audiencePollTypography.numberFontWeight).toBe(400)
    expect(audiencePollTypography.eyebrowFontWeight).toBe(400)
  })

  it('uses a mono weight loaded by both the main thread and export Worker', () => {
    const weight = audiencePollTypography.numberFontWeight
    expect(weight).toBe(audiencePollTypography.eyebrowFontWeight)
    expect(mainSource).toContain(`@fontsource/ibm-plex-mono/${weight}.css`)
    expect(workerFontsSource).toMatch(
      new RegExp(`IBM Plex Mono Worker[^\\n]+weight: '${weight}'`),
    )
  })

  it.each([
    ['Chinese', '这是一个需要稳定换行展示的中文投票问题吗'],
    ['mixed Chinese and English', 'AI产品如何稳定服务全球用户与开发团队呢'],
  ])('wraps a real maxLength 20 %s title without losing characters', (_label, text) => {
    const titleControl = getMotionDefinition('audience-poll').controls
      .find((control) => control.key === 'title')
    expect(titleControl).toMatchObject({ type: 'text', maxLength: 20 })
    expect(Array.from(text)).toHaveLength(20)
    const lines = splitAudiencePollTitle(text)

    expect(lines).toHaveLength(2)
    expect(lines.join('')).toBe(text)
    expect(lines[1]).not.toMatch(/…$/u)
  })

  it('prefers word boundaries and treats unknown ASCII conservatively', () => {
    expect(splitAudiencePollTitle('WWWWW WWWWW WWWWW WW')).toEqual([
      'WWWWW WWWWW',
      'WWWWW WW',
    ])
    expect(splitAudiencePollTitle('^^^^^^^^^^^^^^^^^^^^')).toEqual([
      '^^^^^^^^^^',
      '^^^^^^^^^^',
    ])
  })

  it('terminates over-limit content at two lines with an ellipsis', () => {
    const text = '这是一个明显超过参数上限并且需要确定终止行为的超长中文投票标题内容用于验证省略号'
    const lines = splitAudiencePollTitle(text)

    expect(lines).toHaveLength(2)
    expect(lines[1]).toMatch(/…$/u)
  })

  it('never splits emoji grapheme clusters while wrapping or truncating', () => {
    const family = '👨‍👩‍👧‍👦'
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
    const graphemes = (value: string) => Array.from(
      segmenter.segment(value),
      ({ segment }) => segment,
    )
    const text = family.repeat(6)
    const lines = splitAudiencePollTitle(text)

    expect(lines).toEqual([`${family}…`])
    expect(graphemes(lines.join('')).every((grapheme) => (
      grapheme === family || grapheme === '…'
    ))).toBe(true)
  })

  it('imports and lays out normal and ZWJ titles without Intl.Segmenter', async () => {
    const segmenterDescriptor = Object.getOwnPropertyDescriptor(Intl, 'Segmenter')
    vi.resetModules()
    Object.defineProperty(Intl, 'Segmenter', {
      configurable: true,
      value: undefined,
    })

    try {
      const fallbackModule = await import('./audiencePollLayout')
      expect(fallbackModule.splitAudiencePollTitle(
        '这是一个需要稳定换行展示的中文投票问题吗',
      )).toEqual(['这是一个需要稳定换行', '展示的中文投票问题吗'])
      expect(fallbackModule.splitAudiencePollTitle('👨‍👩‍👧‍👦'.repeat(6)))
        .toEqual(['👨‍👩‍👧‍👦…'])
      for (const grapheme of [
        'a\u0301',
        '✈️',
        '👍🏽',
        '🇨🇳',
        '👨‍👩‍👧‍👦',
      ]) {
        expect(fallbackModule.splitAudiencePollTitle(grapheme)).toEqual([grapheme])
      }
    } finally {
      if (segmenterDescriptor) {
        Object.defineProperty(Intl, 'Segmenter', segmenterDescriptor)
      }
      vi.resetModules()
    }
  })
})
