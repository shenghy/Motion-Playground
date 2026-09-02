import { CANVAS_COLORS, drawText } from '../../../export/canvas/primitives'
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

const GROUP_COUNT = 6
const GRID_LEFT = FULLSCREEN_EDGE
const GRID_TOP = 330
const COLUMN_COUNT = 3
const GAP = 36
const CELL_WIDTH = (FULLSCREEN_WIDTH - FULLSCREEN_EDGE * 2 - GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT
const CELL_HEIGHT = 280

export const renderCategoryMatrixToCanvas: CanvasMotionRenderer<FullscreenParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const items = parseFullscreenItems(params, GROUP_COUNT)
  const stage = getFullscreenStage(params, localTime, items)
  const exit = stage.exitOpacity
  const at = (alpha: number) => alpha * exit

  drawFullscreenBackdrop(ctx, 'checker', stage.time, exit)
  drawFullscreenHeader(ctx, resources, stage, params.eyebrow, params.title)

  stage.items.forEach((phase, index) => {
    if (!phase.entered) return
    const column = index % COLUMN_COUNT
    const row = Math.floor(index / COLUMN_COUNT)
    const x = GRID_LEFT + column * (CELL_WIDTH + GAP)
    const y = GRID_TOP + row * (CELL_HEIGHT + GAP)
    const active = phase.active > 0.5
    const color = itemEmphasisColor(phase)
    const centerX = x + CELL_WIDTH / 2
    const centerY = y + CELL_HEIGHT / 2

    // 翻转入场：scaleX 从 0.3 展开
    const flipX = 0.3 + 0.7 * phase.scale
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.scale(flipX, 1)
    ctx.translate(-centerX, -centerY)

    drawFullscreenPanel(ctx, {
      x,
      y,
      width: CELL_WIDTH,
      height: CELL_HEIGHT,
      fill: active ? 'rgba(255,106,0,.12)' : 'rgba(22,48,122,.66)',
      stroke: active ? CANVAS_COLORS.accent : 'rgba(255,255,255,.3)',
      lineWidth: active ? 4 : 1,
      radius: 22,
      alpha: at(phase.opacity),
    })

    drawText(ctx, {
      text: String(index + 1).padStart(2, '0'),
      x: x + 36,
      y: y + 40,
      font: `600 18px ${resources.monoFont}`,
      color: active ? CANVAS_COLORS.accent : 'rgba(255,255,255,.5)',
      maxWidth: 80,
      alpha: at(phase.opacity),
    })
    drawText(ctx, {
      text: phase.spec.text,
      x: centerX,
      y: centerY - 30,
      font: `650 42px ${resources.contentFont}`,
      color: active ? CANVAS_COLORS.paper : color,
      maxWidth: CELL_WIDTH - 80,
      align: 'center',
      alpha: at(phase.opacity),
    })
    if (phase.spec.note) {
      drawText(ctx, {
        text: phase.spec.note,
        x: centerX,
        y: centerY + 30,
        font: `500 20px ${resources.monoFont}`,
        color: active ? CANVAS_COLORS.muted : 'rgba(255,255,255,.55)',
        maxWidth: CELL_WIDTH - 80,
        align: 'center',
        alpha: at(phase.opacity),
      })
    }
    ctx.restore()
  })

  drawFullscreenFooter(ctx, resources, stage, items.length)
}
