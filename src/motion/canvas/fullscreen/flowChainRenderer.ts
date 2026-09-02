import { CANVAS_COLORS, drawText } from '../../../export/canvas/primitives'
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

const NODE_COUNT = 5
const NODE_Y = 560
const NODE_RADIUS = 62

export const renderFlowChainToCanvas: CanvasMotionRenderer<FullscreenParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const items = parseFullscreenItems(params, NODE_COUNT)
  const stage = getFullscreenStage(params, localTime, items)
  const exit = stage.exitOpacity
  const at = (alpha: number) => alpha * exit

  drawFullscreenBackdrop(ctx, 'flow', stage.time, exit)
  drawFullscreenHeader(ctx, resources, stage, params.eyebrow, params.title)

  const nodeXs = items.map((_, index) => {
    const count = items.length
    const span = FULLSCREEN_WIDTH - FULLSCREEN_EDGE * 2 - NODE_RADIUS * 2
    return FULLSCREEN_EDGE + NODE_RADIUS + (count === 1 ? span / 2 : (index / (count - 1)) * span)
  })

  stage.items.forEach((phase, index) => {
    if (!phase.entered) return
    const x = nodeXs[index]
    const active = phase.active > 0.5
    const color = itemEmphasisColor(phase)
    const radius = (active ? 74 : 62) * phase.scale

    if (index < stage.items.length - 1 && phase.grow > 0) {
      const nextX = nodeXs[index + 1]
      const gap = nextX - x
      const drawLength = gap * phase.grow
      ctx.save()
      ctx.globalAlpha = at(phase.opacity)
      ctx.strokeStyle = active ? CANVAS_COLORS.accent : 'rgba(255,255,255,.42)'
      ctx.lineWidth = active ? 4 : 2
      ctx.beginPath()
      ctx.moveTo(x + NODE_RADIUS, NODE_Y)
      ctx.lineTo(x + NODE_RADIUS + drawLength, NODE_Y)
      ctx.stroke()
      if (drawLength > 26) {
        const tipX = x + NODE_RADIUS + drawLength
        ctx.fillStyle = active ? CANVAS_COLORS.accent : 'rgba(255,255,255,.62)'
        ctx.beginPath()
        ctx.moveTo(tipX, NODE_Y - 12)
        ctx.lineTo(tipX + 20, NODE_Y)
        ctx.lineTo(tipX, NODE_Y + 12)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    }

    ctx.save()
    ctx.globalAlpha = at(phase.opacity)
    ctx.fillStyle = active ? 'rgba(255,106,0,.12)' : 'rgba(22,48,122,.85)'
    ctx.strokeStyle = active ? CANVAS_COLORS.accent : 'rgba(255,255,255,.4)'
    ctx.lineWidth = active ? 4 : 2
    ctx.beginPath()
    ctx.arc(x, NODE_Y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()

    drawText(ctx, {
      text: String(index + 1),
      x,
      y: NODE_Y - 16,
      font: `600 26px ${resources.monoFont}`,
      color: active ? CANVAS_COLORS.accent : 'rgba(255,255,255,.6)',
      maxWidth: 120,
      align: 'center',
      alpha: at(phase.opacity),
    })
    drawText(ctx, {
      text: phase.spec.text,
      x,
      y: NODE_Y + 26,
      font: `600 22px ${resources.contentFont}`,
      color,
      maxWidth: 300,
      align: 'center',
      alpha: at(phase.opacity),
    })
    drawText(ctx, {
      text: phase.spec.note ?? '',
      x,
      y: NODE_Y + 100,
      font: `500 17px ${resources.monoFont}`,
      color: 'rgba(255,255,255,.55)',
      maxWidth: 260,
      align: 'center',
      alpha: at(phase.opacity),
    })
  })

  drawFullscreenFooter(ctx, resources, stage, items.length)
}
