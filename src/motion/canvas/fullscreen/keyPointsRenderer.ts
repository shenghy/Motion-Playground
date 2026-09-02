import { CANVAS_COLORS, drawText, drawPencilLine } from '../../../export/canvas/primitives'
import type { CanvasMotionRenderer } from '../../../export/canvas/types'
import type { FullscreenParams } from '../../types'
import {
  FULLSCREEN_EDGE,
  FULLSCREEN_WIDTH,
  drawFullscreenBackdrop,
  drawFullscreenFooter,
  drawFullscreenHeader,
  drawFullscreenPanel,
  getFullscreenStage,
  itemEmphasisColor,
  parseFullscreenItems,
} from './fullscreenShared'

const POINT_COUNT = 5
const ROW_START_Y = 330
const ROW_HEIGHT = 132

export const renderKeyPointsToCanvas: CanvasMotionRenderer<FullscreenParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const items = parseFullscreenItems(params, POINT_COUNT)
  const stage = getFullscreenStage(params, localTime, items)
  const exit = stage.exitOpacity
  const at = (alpha: number) => alpha * exit

  drawFullscreenBackdrop(ctx, 'rails', stage.time, exit)
  drawFullscreenHeader(ctx, resources, stage, params.eyebrow, params.title)

  stage.items.forEach((phase, index) => {
    if (!phase.entered) return
    const y = ROW_START_Y + index * ROW_HEIGHT
    const active = phase.active > 0.5
    const slideX = (1 - phase.slide) * 70
    const rowX = FULLSCREEN_EDGE + slideX
    const rowWidth = FULLSCREEN_WIDTH - FULLSCREEN_EDGE * 2 - slideX
    const color = itemEmphasisColor(phase)

    drawFullscreenPanel(ctx, {
      x: rowX,
      y,
      width: rowWidth,
      height: 96,
      fill: active ? 'rgba(255,106,0,.1)' : 'rgba(22,48,122,.6)',
      stroke: active ? CANVAS_COLORS.accent : 'rgba(255,255,255,.28)',
      lineWidth: active ? 3 : 1,
      radius: 20,
      alpha: at(phase.opacity),
    })
    if (active) {
      drawFullscreenPanel(ctx, {
        x: rowX,
        y: y + 18,
        width: 8,
        height: 60,
        fill: CANVAS_COLORS.accent,
        stroke: null,
        radius: 4,
        alpha: at(phase.opacity),
      })
    }
    drawText(ctx, {
      text: phase.spec.text,
      x: rowX + 56,
      y: y + 30,
      font: `600 36px ${resources.contentFont}`,
      color: active ? CANVAS_COLORS.paper : color,
      maxWidth: rowWidth - 120,
      alpha: at(phase.opacity),
    })
    if (phase.spec.note) {
      drawText(ctx, {
        text: phase.spec.note,
        x: rowX + 56,
        y: y + 74,
        font: `500 19px ${resources.monoFont}`,
        color: active ? CANVAS_COLORS.muted : 'rgba(255,255,255,.55)',
        maxWidth: rowWidth - 120,
        alpha: at(phase.opacity),
      })
    }
  })

  drawPencilLine(ctx, {
    x1: FULLSCREEN_EDGE,
    y1: 1000,
    x2: FULLSCREEN_WIDTH - FULLSCREEN_EDGE,
    y2: 1000,
    color: 'rgba(255,255,255,.1)',
    width: 1,
    alpha: exit,
  })
  drawFullscreenFooter(ctx, resources, stage, items.length)
}
