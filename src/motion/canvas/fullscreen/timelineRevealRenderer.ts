import { CANVAS_COLORS, drawText, drawPencilLine } from '../../../export/canvas/primitives'
import type { CanvasMotionRenderer } from '../../../export/canvas/types'
import type { FullscreenParams } from '../../types'
import {
  FULLSCREEN_EDGE,
  FULLSCREEN_WIDTH,
  drawFullscreenBackdrop,
  drawFullscreenFooter,
  drawFullscreenHeader,
  getFullscreenStage,
  itemEmphasisColor,
  parseFullscreenItems,
} from './fullscreenShared'

const POINT_COUNT = 6
const AXIS_Y = 620

export const renderTimelineRevealToCanvas: CanvasMotionRenderer<FullscreenParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const items = parseFullscreenItems(params, POINT_COUNT)
  const stage = getFullscreenStage(params, localTime, items)
  const exit = stage.exitOpacity
  const at = (alpha: number) => alpha * exit

  drawFullscreenBackdrop(ctx, 'scan', stage.time, exit)
  drawFullscreenHeader(ctx, resources, stage, params.eyebrow, params.title)

  const xs = items.map((_, index) => {
    const count = items.length
    const span = FULLSCREEN_WIDTH - FULLSCREEN_EDGE * 2
    return count === 1 ? FULLSCREEN_WIDTH / 2 : FULLSCREEN_EDGE + (index / (count - 1)) * span
  })

  drawPencilLine(ctx, {
    x1: FULLSCREEN_EDGE,
    y1: AXIS_Y,
    x2: FULLSCREEN_WIDTH - FULLSCREEN_EDGE,
    y2: AXIS_Y,
    color: 'rgba(255,255,255,.3)',
    width: 3,
    alpha: at(1),
  })

  stage.items.forEach((phase, index) => {
    if (!phase.entered) return
    const x = xs[index]
    const active = phase.active > 0.5
    const color = itemEmphasisColor(phase)
    const radius = (active ? 15 : 10) * phase.scale
    const lift = (1 - phase.slide) * 40

    if (active) {
      ctx.save()
      ctx.globalAlpha = at(phase.opacity * 0.35)
      ctx.strokeStyle = CANVAS_COLORS.accent
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, AXIS_Y, 34 + Math.sin(stage.time * 3.4) * 6, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    ctx.save()
    ctx.globalAlpha = at(phase.opacity)
    ctx.fillStyle = active ? CANVAS_COLORS.accent : 'rgba(255,255,255,.85)'
    ctx.beginPath()
    ctx.arc(x, AXIS_Y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    drawPencilLine(ctx, {
      x1: x,
      y1: AXIS_Y,
      x2: x,
      y2: AXIS_Y - 66,
      color: 'rgba(255,255,255,.3)',
      width: 2,
      alpha: at(phase.opacity),
    })

    drawText(ctx, {
      text: phase.spec.text,
      x,
      y: AXIS_Y - 124 + lift,
      font: `650 40px ${resources.monoFont}`,
      color: active ? CANVAS_COLORS.accent : 'rgba(255,255,255,.78)',
      maxWidth: 300,
      align: 'center',
      alpha: at(phase.opacity),
    })
    if (phase.spec.note) {
      drawText(ctx, {
        text: phase.spec.note,
        x,
        y: AXIS_Y + 66,
        font: `500 22px ${resources.contentFont}`,
        color,
        maxWidth: 280,
        align: 'center',
        alpha: at(phase.opacity),
      })
    }
  })

  drawFullscreenFooter(ctx, resources, stage, items.length)
}
