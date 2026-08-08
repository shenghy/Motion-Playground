export const AUDIENCE_POLL_CSS_SOURCE = {
  viewportWidth: 1920,
  viewportHeight: 1080,
  leftPercent: 6.35,
  topPercent: 11,
  widthPercent: 31.8,
  subtitleSafeBottomPercent: 13.8889,
  bottomExtraPercent: 3,
  paddingTopCqw: 1.75,
  paddingInlineCqw: 1.55,
  paddingBottomCqw: 1.3,
  eyebrowFontCqw: 0.78,
  titleMarginTopCqw: 1.05,
  titleFontCqw: 1.72,
  titleLineHeight: 1.25,
  titlePaddingBottomCqw: 1.05,
  titleMarginBottomCqw: 1.15,
  titleBorderBottomPx: 3,
  optionHeightCqw: 3.2,
  optionGapCqw: 0.62,
  optionPaddingInlineCqw: 0.7,
  optionNumberColumnCqw: 2.25,
  optionColumnGapCqw: 0.75,
  optionNumberFontCqw: 0.9,
  optionLabelFontCqw: 1.08,
  ctaPaddingTopCqw: 1,
  ctaFontCqw: 0.82,
  ctaLineHeight: 1.55,
} as const

export const audiencePollTypography = {
  contentFontWeight: 500,
  titleLetterSpacing: '0.025em',
  bodyLetterSpacing: '0.035em',
  numberFontWeight: 400,
  numberLetterSpacing: '0.08em',
  eyebrowFontWeight: 400,
  eyebrowLetterSpacing: '0.16em',
  titleWrap: 'nowrap',
} as const

const cqw = AUDIENCE_POLL_CSS_SOURCE.viewportWidth / 100
const rawPanelTop = AUDIENCE_POLL_CSS_SOURCE.viewportHeight
  * AUDIENCE_POLL_CSS_SOURCE.topPercent / 100
const rawPanelEnd = AUDIENCE_POLL_CSS_SOURCE.viewportHeight * (1 - (
  AUDIENCE_POLL_CSS_SOURCE.subtitleSafeBottomPercent
  + AUDIENCE_POLL_CSS_SOURCE.bottomExtraPercent
) / 100)
const rawPanelLeft = AUDIENCE_POLL_CSS_SOURCE.viewportWidth
  * AUDIENCE_POLL_CSS_SOURCE.leftPercent / 100
const rawPanelWidth = AUDIENCE_POLL_CSS_SOURCE.viewportWidth
  * AUDIENCE_POLL_CSS_SOURCE.widthPercent / 100
const rawContentLeft = rawPanelLeft
  + AUDIENCE_POLL_CSS_SOURCE.paddingInlineCqw * cqw
const panelLeft = Math.round(rawPanelLeft)
const panelWidth = Math.floor(rawPanelWidth)
const contentInset = Math.round(AUDIENCE_POLL_CSS_SOURCE.paddingInlineCqw * cqw)
const rawEyebrowY = rawPanelTop + AUDIENCE_POLL_CSS_SOURCE.paddingTopCqw * cqw
const rawTitleY = rawEyebrowY + (
  AUDIENCE_POLL_CSS_SOURCE.eyebrowFontCqw
  + AUDIENCE_POLL_CSS_SOURCE.titleMarginTopCqw
) * cqw
const rawCtaSeparatorY = rawPanelEnd - (
  AUDIENCE_POLL_CSS_SOURCE.paddingBottomCqw
  + AUDIENCE_POLL_CSS_SOURCE.ctaPaddingTopCqw
  + AUDIENCE_POLL_CSS_SOURCE.ctaFontCqw
    * AUDIENCE_POLL_CSS_SOURCE.ctaLineHeight
) * cqw
const optionLabelOffset = Math.round((
  AUDIENCE_POLL_CSS_SOURCE.optionPaddingInlineCqw
  + AUDIENCE_POLL_CSS_SOURCE.optionNumberColumnCqw
  + AUDIENCE_POLL_CSS_SOURCE.optionColumnGapCqw
) * cqw)

export const audiencePollLayout = {
  panel: {
    x: panelLeft,
    y: Math.round(rawPanelTop),
    width: panelWidth,
    endY: Math.round(rawPanelEnd),
    height: Math.round(rawPanelEnd) - Math.round(rawPanelTop),
  },
  content: {
    x: Math.round(rawContentLeft),
    width: panelLeft + panelWidth - contentInset - Math.round(rawContentLeft),
    right: panelLeft + panelWidth - contentInset,
  },
  eyebrow: {
    y: Math.round(rawEyebrowY),
    fontSize: Math.round(AUDIENCE_POLL_CSS_SOURCE.eyebrowFontCqw * cqw),
  },
  title: {
    y: Math.round(rawTitleY),
    fontSize: Math.round(AUDIENCE_POLL_CSS_SOURCE.titleFontCqw * cqw),
    lineHeight: Math.round(
      AUDIENCE_POLL_CSS_SOURCE.titleFontCqw
      * AUDIENCE_POLL_CSS_SOURCE.titleLineHeight
      * cqw,
    ),
    maxLines: 2,
    dividerGap: Math.round(AUDIENCE_POLL_CSS_SOURCE.titlePaddingBottomCqw * cqw),
    borderWidth: AUDIENCE_POLL_CSS_SOURCE.titleBorderBottomPx,
  },
  options: {
    dividerToFirst: Math.round(
      AUDIENCE_POLL_CSS_SOURCE.titleMarginBottomCqw * cqw,
    ),
    height: Math.round(AUDIENCE_POLL_CSS_SOURCE.optionHeightCqw * cqw),
    gap: Math.round(AUDIENCE_POLL_CSS_SOURCE.optionGapCqw * cqw),
    numberXOffset: Math.round(
      AUDIENCE_POLL_CSS_SOURCE.optionPaddingInlineCqw * cqw,
    ),
    numberFontSize: Math.round(
      AUDIENCE_POLL_CSS_SOURCE.optionNumberFontCqw * cqw,
    ),
    labelXOffset: optionLabelOffset,
    labelFontSize: Math.round(
      AUDIENCE_POLL_CSS_SOURCE.optionLabelFontCqw * cqw,
    ),
    labelWidth: Math.round(
      panelLeft + panelWidth - contentInset
      - Math.round(rawContentLeft)
      - AUDIENCE_POLL_CSS_SOURCE.optionPaddingInlineCqw * cqw
      - optionLabelOffset,
    ),
  },
  cta: {
    separatorY: Math.round(rawCtaSeparatorY),
    textY: Math.ceil(
      rawCtaSeparatorY + AUDIENCE_POLL_CSS_SOURCE.ctaPaddingTopCqw * cqw,
    ),
    fontSize: Math.round(AUDIENCE_POLL_CSS_SOURCE.ctaFontCqw * cqw),
  },
} as const

const TITLE_MAX_UTF16_LENGTH = 20
let titleSegmenter: Intl.Segmenter | null | undefined

function fallbackGraphemes(text: string) {
  const segments: string[] = []
  let current = ''
  let joinNext = false
  let regionalIndicators = 0

  for (const character of Array.from(text)) {
    const codePoint = character.codePointAt(0) ?? 0
    const isRegionalIndicator = codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff
    const extendsCurrent = /\p{Mark}/u.test(character)
      || codePoint === 0xfe0e
      || codePoint === 0xfe0f
      || (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff)

    if (!current) {
      current = character
      regionalIndicators = isRegionalIndicator ? 1 : 0
    } else if (joinNext) {
      current += character
      joinNext = false
      regionalIndicators = 0
    } else if (character === '\u200d') {
      current += character
      joinNext = true
    } else if (extendsCurrent) {
      current += character
    } else if (isRegionalIndicator && regionalIndicators === 1) {
      current += character
      segments.push(current)
      current = ''
      regionalIndicators = 0
    } else {
      segments.push(current)
      current = character
      regionalIndicators = isRegionalIndicator ? 1 : 0
    }
  }
  if (current) segments.push(current)
  return segments
}

function graphemes(text: string) {
  if (titleSegmenter === undefined) {
    const Segmenter = (Intl as typeof Intl & {
      Segmenter?: typeof Intl.Segmenter
    }).Segmenter
    if (typeof Segmenter === 'function') {
      try {
        titleSegmenter = new Segmenter('zh-CN', { granularity: 'grapheme' })
      } catch {
        titleSegmenter = null
      }
    } else {
      titleSegmenter = null
    }
  }
  if (titleSegmenter) {
    return Array.from(titleSegmenter.segment(text), ({ segment }) => segment)
  }
  return fallbackGraphemes(text)
}

function titleDisplayUnits(segment: string) {
  if (/\s/u.test(segment)) return 0.25
  if (/^[WM]+$/u.test(segment)) return 1
  if (/^[A-Z]+$/u.test(segment)) return 0.65
  if (/^[a-z]+$/u.test(segment)) return 0.55
  if (/^\d+$/u.test(segment)) return 0.6
  if (Array.from(segment).every((character) => (
    (character.codePointAt(0) ?? 0) <= 0x7f
  ))) return 0.35
  return 1
}

function canonicalSegments(text: string) {
  const source = graphemes(text.trim())
  const visible: string[] = []
  let utf16Length = 0
  for (const segment of source) {
    if (utf16Length + segment.length > TITLE_MAX_UTF16_LENGTH) break
    visible.push(segment)
    utf16Length += segment.length
  }
  if (visible.length < source.length) visible.push('…')
  return visible
}

function lineUnits(segments: string[]) {
  return segments.reduce(
    (total, segment) => total + titleDisplayUnits(segment) + 0.025,
    0,
  )
}

function splitsInsideLatinWord(segments: string[], index: number) {
  return /[A-Za-z0-9]/u.test(segments[index - 1] ?? '')
    && /[A-Za-z0-9]/u.test(segments[index] ?? '')
}

export function splitAudiencePollTitle(text: string) {
  const segments = canonicalSegments(text)
  const lineBudget = audiencePollLayout.content.width
    / audiencePollLayout.title.fontSize
  if (lineUnits(segments) <= lineBudget) return [segments.join('')]

  let best: { index: number, score: number } | null = null
  for (let index = 1; index < segments.length; index += 1) {
    const first = segments.slice(0, index)
    const second = segments.slice(index)
    const firstUnits = lineUnits(first)
    const secondUnits = lineUnits(second)
    if (firstUnits > lineBudget || secondUnits > lineBudget) continue

    const wordPenalty = splitsInsideLatinWord(segments, index) ? lineBudget : 0
    const whitespaceBonus = /\s/u.test(segments[index - 1] ?? '')
      || /\s/u.test(segments[index] ?? '') ? -1 : 0
    const score = Math.abs(firstUnits - secondUnits) + wordPenalty + whitespaceBonus
    if (!best || score < best.score) best = { index, score }
  }

  const splitIndex = best?.index ?? Math.ceil(segments.length / 2)
  return [
    segments.slice(0, splitIndex).join('').trimEnd(),
    segments.slice(splitIndex).join('').trimStart(),
  ]
}

export function wrapAudiencePollTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
) {
  ctx.font = font
  ctx.letterSpacing = audiencePollTypography.titleLetterSpacing
  return splitAudiencePollTitle(text)
}
