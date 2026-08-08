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

function fitWithEllipsis(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const ellipsis = '…'
  let fitted = text.trimEnd()
  while (fitted && ctx.measureText(`${fitted}${ellipsis}`).width > maxWidth) {
    fitted = fitted.slice(0, -1).trimEnd()
  }
  return `${fitted}${ellipsis}`
}

export function wrapAudiencePollTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  maxWidth = audiencePollLayout.content.width,
  maxLines = audiencePollLayout.title.maxLines,
) {
  ctx.font = font
  const characters = Array.from(text.trim())
  const lines: string[] = []
  let current = ''

  for (const character of characters) {
    const candidate = current + character
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
      continue
    }

    const lastSpace = current.lastIndexOf(' ')
    if (lastSpace > 0) {
      lines.push(current.slice(0, lastSpace).trimEnd())
      current = `${current.slice(lastSpace + 1)}${character}`.trimStart()
    } else {
      lines.push(current.trimEnd())
      current = character.trimStart()
    }
  }
  if (current) lines.push(current.trimEnd())
  if (lines.length <= maxLines) return lines

  const visible = lines.slice(0, maxLines)
  visible[maxLines - 1] = fitWithEllipsis(ctx, visible[maxLines - 1], maxWidth)
  return visible
}
