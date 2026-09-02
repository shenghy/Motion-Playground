import { CANVAS_COLORS, drawText } from '../../../export/canvas/primitives'
import type { CanvasMotionRenderer } from '../../../export/canvas/types'
import type { FullscreenParams } from '../../types'
import {
  FULLSCREEN_WIDTH,
  drawFullscreenBackdrop,
  drawFullscreenFooter,
  drawFullscreenHeader,
  drawFullscreenPanel,
  getFullscreenStage,
  itemEmphasisColor,
  parseFullscreenItems,
} from './fullscreenShared'

const ITEM_COUNT = 10
const COLUMN_COUNT = 4
const CARD_WIDTH = 384
const CARD_HEIGHT = 148
const GAP_X = 32
const GAP_Y = 34
const GRID_TOP = 336

export const renderItemGridToCanvas: CanvasMotionRenderer<FullscreenParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const items = parseFullscreenItems(params, ITEM_COUNT)
  const stage = getFullscreenStage(params, localTime, items)
  const exit = stage.exitOpacity
  const at = (alpha: number) => alpha * exit

  drawFullscreenBackdrop(ctx, 'grid', stage.time, exit)
  drawFullscreenHeader(ctx, resources, stage, params.eyebrow, params.title)

  stage.items.forEach((phase, index) => {
    if (!phase.entered) return
    const row = Math.floor(index / COLUMN_COUNT)
    const column = index % COLUMN_COUNT
    const rowCount = Math.ceil(items.length / COLUMN_COUNT)
    const columnCount = row < rowCount - 1
      ? COLUMN_COUNT
      : Math.max(1, items.length - (rowCount - 1) * COLUMN_COUNT)
    const totalWidth = columnCount * CARD_WIDTH + (columnCount - 1) * GAP_X
    const startX = FULLSCREEN_WIDTH / 2 - totalWidth / 2
    const x = startX + column * (CARD_WIDTH + GAP_X)
    const y = GRID_TOP + row * (CARD_HEIGHT + GAP_Y)
    const active = phase.active > 0.5
    const color = itemEmphasisColor(phase)

    const centerX = x + CARD_WIDTH / 2
    const centerY = y + CARD_HEIGHT / 2
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.scale(phase.scale, phase.scale)
    ctx.translate(-centerX, -centerY)

    drawFullscreenPanel(ctx, {
      x,
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fill: active ? 'rgba(255,106,0,.13)' : 'rgba(22,48,122,.7)',
      stroke: active ? CANVAS_COLORS.accent : 'rgba(255,255,255,.3)',
      lineWidth: active ? 3 : 1,
      radius: 20,
      alpha: at(phase.opacity),
    })
    if (active) {
      drawFullscreenPanel(ctx, {
        x: x + 24,
        y: y + 26,
        width: 7,
        height: CARD_HEIGHT - 52,
        fill: CANVAS_COLORS.accent,
        stroke: null,
        radius: 3,
        alpha: at(phase.opacity),
      })
    }
    drawText(ctx, {
      text: phase.spec.text,
      x: x + 52,
      y: y + 30,
      font: `620 32px ${resources.contentFont}`,
      color: active ? CANVAS_COLORS.paper : color,
      maxWidth: CARD_WIDTH - 80,
      alpha: at(phase.opacity),
    })
    if (phase.spec.note) {
      drawText(ctx, {
        text: phase.spec.note,
        x: x + 52,
        y: y + 86,
        font: `500 18px ${resources.monoFont}`,
        color: active ? CANVAS_COLORS.muted : 'rgba(255,255,255,.55)',
        maxWidth: CARD_WIDTH - 80,
        alpha: at(phase.opacity),
      })
    }
    ctx.restore()
  })

  drawFullscreenFooter(ctx, resources, stage, items.length)
}
