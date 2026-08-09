export const COMPARE_SPLIT_LAYOUT = {
  safeLineX: 748.8,
  panel: { x: 122, y: 119, width: 610, height: 779 },
  content: { x: 152, width: 550 },
  headerDividerY: 246,
  tracks: { topY: 270, bottomY: 804 },
  conclusionDividerY: 829,
  conclusionTextY: 855,
} as const

export function getCompareSplitTrackLayout(value: number) {
  const split = Math.min(
    68,
    Math.max(32, Number.isFinite(value) ? value : 50),
  )
  const { topY, bottomY } = COMPARE_SPLIT_LAYOUT.tracks
  const dividerY = topY + (bottomY - topY) * (split / 100)

  return {
    split,
    dividerY,
    upperY: topY,
    lowerY: dividerY,
    bottomY,
  }
}
