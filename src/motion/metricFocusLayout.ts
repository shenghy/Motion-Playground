export const METRIC_SAFE_EDGE = 1920 * 0.38
export const METRIC_SAFE_RIGHT = METRIC_SAFE_EDGE - 1
export const METRIC_CONTENT_X = 122
export const METRIC_BAR_WIDTH = 24
export const METRIC_BAR_GAP = 28
export const METRIC_PREFIX_GAP = 8
export const METRIC_SUFFIX_GAP = 10

const NUMBER_FONT_SIZE = 132
const AFFIX_FONT_SIZE = 34
const CONSERVATIVE_NUMBER_GLYPH_WIDTH = 0.88
const CANVAS_CQW_IN_PIXELS = 19.2

function roundPixels(value: number) {
  return Math.round(value * 100) / 100
}

export function getMetricFocusTypography(
  number: string,
  prefix: string,
  suffix: string,
) {
  const textGaps = (prefix ? METRIC_PREFIX_GAP : 0)
    + (suffix ? METRIC_SUFFIX_GAP : 0)
  const availableGlyphWidth = METRIC_SAFE_RIGHT
    - METRIC_CONTENT_X
    - METRIC_BAR_WIDTH
    - METRIC_BAR_GAP
    - textGaps
  const estimatedGlyphWidth = number.length
    * NUMBER_FONT_SIZE
    * CONSERVATIVE_NUMBER_GLYPH_WIDTH
    + prefix.length * AFFIX_FONT_SIZE
    + suffix.length * AFFIX_FONT_SIZE
  const scale = Math.min(
    1,
    availableGlyphWidth / Math.max(1, estimatedGlyphWidth),
  )

  return {
    numberFontSize: roundPixels(NUMBER_FONT_SIZE * scale),
    affixFontSize: roundPixels(AFFIX_FONT_SIZE * scale),
    numberFontCqw: roundPixels(
      NUMBER_FONT_SIZE * scale / CANVAS_CQW_IN_PIXELS,
    ),
    affixFontCqw: roundPixels(
      AFFIX_FONT_SIZE * scale / CANVAS_CQW_IN_PIXELS,
    ),
  }
}
