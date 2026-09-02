import { CANVAS_COLORS, drawText } from '../../../export/canvas/primitives'
import type { CanvasMotionRenderer } from '../../../export/canvas/types'
import type { FullscreenParams } from '../../types'
import {
  FULLSCREEN_WIDTH,
  drawFullscreenBackdrop,
  drawFullscreenFooter,
  drawFullscreenHeader,
  getFullscreenStage,
  itemEmphasisColor,
  parseFullscreenItems,
} from './fullscreenShared'

const LAYER_COUNT = 4
const PYRAMID_BASE_Y = 940
const PYRAMID_TOP_Y = 360
const MAX_HALF_WIDTH = 620
const MIN_HALF_WIDTH = 210
const LAYER_HEIGHT = (PYRAMID_BASE_Y - PYRAMID_TOP_Y) / LAYER_COUNT

function layerHalfWidth(index: number, count: number) {
  // 第 0 层（底）最宽，向上递减
  const t = index / Math.max(1, count - 1)
  return MAX_HALF_WIDTH - (MAX_HALF_WIDTH - MIN_HALF_WIDTH) * t
}

export const renderPyramidToCanvas: CanvasMotionRenderer<FullscreenParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const items = parseFullscreenItems(params, LAYER_COUNT)
  const stage = getFullscreenStage(params, localTime, items)
  const exit = stage.exitOpacity
  const at = (alpha: number) => alpha * exit

  drawFullscreenBackdrop(ctx, 'beam', stage.time, exit)
  drawFullscreenHeader(ctx, resources, stage, params.eyebrow, params.title)

  const apexX = FULLSCREEN_WIDTH / 2
  stage.items.forEach((phase, index) => {
    if (!phase.entered) return
    const active = phase.active > 0.5
    const color = itemEmphasisColor(phase)
    const bottomY = PYRAMID_BASE_Y - index * LAYER_HEIGHT
    const topY = bottomY - LAYER_HEIGHT
    const rise = (1 - phase.grow) * 36
    const bottomHalf = layerHalfWidth(index, items.length)
    const topHalf = index === 0
      ? bottomHalf
      : layerHalfWidth(index - 1, items.length)
    const yShift = topY + rise
    const yShift2 = bottomY + rise

    ctx.save()
    ctx.globalAlpha = at(phase.opacity)
    ctx.beginPath()
    ctx.moveTo(apexX - bottomHalf, yShift2)
    ctx.lineTo(apexX + bottomHalf, yShift2)
    ctx.lineTo(apexX + topHalf, yShift)
    ctx.lineTo(apexX - topHalf, yShift)
    ctx.closePath()
    ctx.fillStyle = active ? 'rgba(255,106,0,.12)' : 'rgba(22,48,122,.72)'
    ctx.fill()
    ctx.strokeStyle = active ? CANVAS_COLORS.accent : 'rgba(255,255,255,.42)'
    ctx.lineWidth = active ? 4 : 2
    ctx.stroke()
    ctx.restore()

    const labelY = (yShift + yShift2) / 2
    drawText(ctx, {
      text: phase.spec.text,
      x: apexX,
      y: labelY - 20,
      font: `650 30px ${resources.contentFont}`,
      color: active ? CANVAS_COLORS.paper : color,
      maxWidth: bottomHalf * 2 - 80,
      align: 'center',
      alpha: at(phase.opacity),
    })
    if (phase.spec.note) {
      drawText(ctx, {
        text: phase.spec.note,
        x: apexX,
        y: labelY + 28,
        font: `500 17px ${resources.monoFont}`,
        color: active ? CANVAS_COLORS.muted : 'rgba(255,255,255,.55)',
        maxWidth: bottomHalf * 2 - 80,
        align: 'center',
        alpha: at(phase.opacity),
      })
    }
  })

  drawFullscreenFooter(ctx, resources, stage, items.length)
}
