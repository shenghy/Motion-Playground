export interface PromptGlyphSource {
  text: string
  sourceStart: number
  sourceEnd: number
}

export interface PromptGlyph extends PromptGlyphSource {
  width: number
  highlighted: boolean
  revealIndex: number
}

export interface PromptLine {
  glyphs: PromptGlyph[]
  width: number
  startRevealIndex: number
  forcedBreakAfter: boolean
}

interface SourceSegment {
  segment: string
  index: number
}

let promptSegmenter: Intl.Segmenter | null | undefined

function fallbackSegments(text: string): SourceSegment[] {
  const segments: SourceSegment[] = []
  let current = ''
  let currentStart = 0
  let joinNext = false
  let regionalIndicators = 0
  let offset = 0

  const flush = () => {
    if (!current) return
    segments.push({ segment: current, index: currentStart })
    current = ''
    regionalIndicators = 0
  }

  for (const character of Array.from(text)) {
    const codePoint = character.codePointAt(0) ?? 0
    const isRegionalIndicator = codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff
    const extendsCurrent = /\p{Mark}/u.test(character)
      || codePoint === 0xfe0e
      || codePoint === 0xfe0f
      || (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff)

    if (!current) {
      current = character
      currentStart = offset
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
      flush()
    } else {
      flush()
      current = character
      currentStart = offset
      regionalIndicators = isRegionalIndicator ? 1 : 0
    }
    offset += character.length
  }
  flush()
  return segments
}

function sourceSegments(text: string): SourceSegment[] {
  if (promptSegmenter === undefined) {
    const Segmenter = (Intl as typeof Intl & {
      Segmenter?: typeof Intl.Segmenter
    }).Segmenter
    if (typeof Segmenter === 'function') {
      try {
        promptSegmenter = new Segmenter('zh-CN', { granularity: 'grapheme' })
      } catch {
        promptSegmenter = null
      }
    } else {
      promptSegmenter = null
    }
  }
  if (!promptSegmenter) return fallbackSegments(text)
  return Array.from(promptSegmenter.segment(text), ({ segment, index }) => ({
    segment,
    index,
  }))
}

export function segmentPromptGraphemes(text: string): PromptGlyphSource[] {
  return sourceSegments(text).map(({ segment, index }) => ({
    text: segment,
    sourceStart: index,
    sourceEnd: index + segment.length,
  }))
}

export function parsePromptKeywords(value: string) {
  return value.split('|')
    .map((keyword) => keyword.trim())
    .filter((keyword, index, keywords) => (
      keyword.length > 0 && keywords.indexOf(keyword) === index
    ))
    .map((keyword, index) => ({ keyword, index }))
    .sort((left, right) => (
      right.keyword.length - left.keyword.length || left.index - right.index
    ))
    .map(({ keyword }) => keyword)
}

function highlightedRanges(prompt: string, keywords: string) {
  const selected: Array<{ start: number; end: number }> = []
  for (const keyword of parsePromptKeywords(keywords)) {
    let from = 0
    while (from <= prompt.length - keyword.length) {
      const start = prompt.indexOf(keyword, from)
      if (start < 0) break
      const end = start + keyword.length
      const overlaps = selected.some((range) => start < range.end && end > range.start)
      if (!overlaps) selected.push({ start, end })
      from = start + Math.max(1, keyword.length)
    }
  }
  return selected
}

export function layoutPromptText(
  ctx: CanvasRenderingContext2D,
  prompt: string,
  keywords: string,
  font: string,
  maxWidth: number,
) {
  const widthLimit = Number.isFinite(maxWidth) ? Math.max(1, maxWidth) : 1
  const ranges = highlightedRanges(prompt, keywords)
  const previousFont = ctx.font
  ctx.font = font

  const glyphs: PromptGlyph[] = []
  const lines: PromptLine[] = []
  let lineGlyphs: PromptGlyph[] = []
  let lineWidth = 0
  let lineStartRevealIndex = 0

  const pushLine = (forcedBreakAfter = false) => {
    lines.push({
      glyphs: lineGlyphs,
      width: lineWidth,
      startRevealIndex: lineStartRevealIndex,
      forcedBreakAfter,
    })
    lineGlyphs = []
    lineWidth = 0
    lineStartRevealIndex = glyphs.length
  }

  for (const source of segmentPromptGraphemes(prompt)) {
    if (source.text === '\r') continue
    if (source.text === '\n') {
      pushLine(true)
      continue
    }
    const width = Math.max(0, ctx.measureText(source.text).width)
    if (lineGlyphs.length > 0 && lineWidth + width > widthLimit) pushLine()
    const glyph: PromptGlyph = {
      ...source,
      width,
      revealIndex: glyphs.length,
      highlighted: ranges.some((range) => (
        source.sourceStart >= range.start && source.sourceEnd <= range.end
      )),
    }
    glyphs.push(glyph)
    lineGlyphs.push(glyph)
    lineWidth += width
  }
  if (lineGlyphs.length > 0 || lines.length === 0) pushLine()
  ctx.font = previousFont

  return { glyphs, lines }
}
