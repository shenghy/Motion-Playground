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
