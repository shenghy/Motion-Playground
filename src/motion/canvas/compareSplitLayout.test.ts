import { describe, expect, it } from 'vitest'
import {
  COMPARE_SPLIT_LAYOUT,
  getCompareSplitTrackLayout,
} from './compareSplitLayout'

describe('comparison split vertical layout', () => {
  it('keeps the complete panel left of the presenter safe line', () => {
    const panelRight = COMPARE_SPLIT_LAYOUT.panel.x
      + COMPARE_SPLIT_LAYOUT.panel.width

    expect(panelRight).toBe(732)
    expect(panelRight).toBeLessThan(COMPARE_SPLIT_LAYOUT.safeLineX)
    expect(COMPARE_SPLIT_LAYOUT.safeLineX).toBe(748.8)
    expect(COMPARE_SPLIT_LAYOUT.content.x + COMPARE_SPLIT_LAYOUT.content.width)
      .toBe(702)
  })

  it('clamps the vertical split and keeps both tracks inside the panel', () => {
    expect(getCompareSplitTrackLayout(0).split).toBe(32)
    expect(getCompareSplitTrackLayout(100).split).toBe(68)
    expect(getCompareSplitTrackLayout(Number.NaN).split).toBe(50)

    const middle = getCompareSplitTrackLayout(50)
    expect(middle.dividerY).toBe(537)
    expect(middle.upperY).toBe(COMPARE_SPLIT_LAYOUT.tracks.topY)
    expect(middle.lowerY).toBe(middle.dividerY)
    expect(middle.bottomY).toBe(COMPARE_SPLIT_LAYOUT.tracks.bottomY)

    for (const split of [32, 50, 68]) {
      const layout = getCompareSplitTrackLayout(split)
      expect(layout.dividerY).toBeGreaterThan(layout.upperY)
      expect(layout.dividerY).toBeLessThan(layout.bottomY)
    }
  })
})
