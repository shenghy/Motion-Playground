export function layoutNarrativeExplanation(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  maxWidth: number,
) {
  const characters = Array.from(text)
  ctx.font = font
  if (ctx.measureText(text).width <= maxWidth || characters.length < 2) {
    return [text]
  }

  const candidates = characters.slice(1).map((_, index) => {
    const split = index + 1
    const first = characters.slice(0, split).join('')
    const second = characters.slice(split).join('')
    const firstWidth = ctx.measureText(first).width
    const secondWidth = ctx.measureText(second).width
    return { first, second, firstWidth, secondWidth }
  }).filter(({ firstWidth, secondWidth }) => (
    firstWidth <= maxWidth && secondWidth <= maxWidth
  )).sort((left, right) => (
    Math.abs(left.firstWidth - left.secondWidth)
      - Math.abs(right.firstWidth - right.secondWidth)
  ))

  const best = candidates[0]
  return best ? [best.first, best.second] : [text]
}

/** 把「|」分隔的重点词参数解析为关键词数组 */
export function parseNarrativeKeywords(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split('|')
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0)
}

export interface NarrativeKeywordSegment {
  text: string
  highlighted: boolean
}

/** 按关键词把整行文本切成若干片段，命中片段标记为高亮 */
export function splitNarrativeKeywords(
  text: string,
  keywords: string[],
): NarrativeKeywordSegment[] {
  if (keywords.length === 0 || text.length === 0) {
    return [{ text, highlighted: false }]
  }
  const highlighted = new Array<boolean>(text.length).fill(false)
  for (const keyword of keywords) {
    let index = text.indexOf(keyword)
    while (index !== -1) {
      for (let offset = 0; offset < keyword.length; offset += 1) {
        highlighted[index + offset] = true
      }
      index = text.indexOf(keyword, index + keyword.length)
    }
  }
  const segments: NarrativeKeywordSegment[] = []
  let start = 0
  for (let index = 1; index <= text.length; index += 1) {
    if (index === text.length || highlighted[index] !== highlighted[start]) {
      segments.push({ text: text.slice(start, index), highlighted: highlighted[start] })
      start = index
    }
  }
  return segments
}
