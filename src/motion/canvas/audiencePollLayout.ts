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
  numberFontWeight: 600,
  numberLetterSpacing: '0.08em',
  eyebrowFontWeight: 600,
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

const titleSegmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })

function graphemes(text: string) {
  return Array.from(titleSegmenter.segment(text), ({ segment }) => segment)
}

function titleDisplayUnits(segment: string) {
  if (/\s/u.test(segment)) return 0.25
  if (Array.from(segment).every((character) => (
    (character.codePointAt(0) ?? 0) <= 0x7f
  ))) return 0.55
  return 1
}

export function splitAudiencePollTitle(text: string) {
  const segments = graphemes(text.trim())
  const singleLineCapacity = Math.floor(
    audiencePollLayout.content.width / audiencePollLayout.title.fontSize,
  )
  const units = segments.reduce(
    (total, segment) => total + titleDisplayUnits(segment),
    0,
  )
  if (units <= singleLineCapacity) return [segments.join('')]

  const midpoint = Math.ceil(segments.length / 2)
  return [
    segments.slice(0, midpoint).join(''),
    segments.slice(midpoint).join(''),
  ]
}

function fitWithEllipsis(
  ctx: CanvasRenderingContext2D,
  segments: string[],
  maxWidth: number,
) {
  const ellipsis = '…'
  const fitted = [...segments]
  while (
    fitted.length > 0
    && ctx.measureText(`${fitted.join('')}${ellipsis}`).width > maxWidth
  ) {
    fitted.pop()
  }
  return `${fitted.join('').trimEnd()}${ellipsis}`
}

function greedilyWrapGraphemes(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[][] = []
  let current: string[] = []

  for (const segment of graphemes(text.trim())) {
    const candidate = [...current, segment]
    if (current.length === 0 || ctx.measureText(candidate.join('')).width <= maxWidth) {
      current = candidate
      continue
    }

    let lastSpace = -1
    for (let index = current.length - 1; index >= 0; index -= 1) {
      if (/\s/u.test(current[index])) {
        lastSpace = index
        break
      }
    }
    if (lastSpace > 0) {
      lines.push(current.slice(0, lastSpace))
      current = [...current.slice(lastSpace + 1), segment]
    } else {
      lines.push(current)
      current = /\s/u.test(segment) ? [] : [segment]
    }
  }
  if (current.length > 0) lines.push(current)
  return lines
}

export function wrapAudiencePollTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  maxWidth = audiencePollLayout.content.width,
  maxLines = audiencePollLayout.title.maxLines,
) {
  ctx.font = font
  ctx.letterSpacing = audiencePollTypography.titleLetterSpacing
  const balanced = splitAudiencePollTitle(text)
  if (
    graphemes(text.trim()).length <= 20
    && balanced.length <= maxLines
    && balanced.every((line) => ctx.measureText(line).width <= maxWidth)
  ) {
    return balanced
  }

  const lines = greedilyWrapGraphemes(ctx, text, maxWidth)
  if (lines.length <= maxLines) return lines.map((line) => line.join('').trimEnd())

  const visible = lines.slice(0, maxLines).map((line) => [...line])
  visible[maxLines - 1] = graphemes(
    fitWithEllipsis(ctx, visible[maxLines - 1], maxWidth),
  )
  return visible.map((line) => line.join('').trimEnd())
}
