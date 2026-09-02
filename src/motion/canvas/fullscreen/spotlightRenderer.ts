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
  parseFullscreenItems,
} from './fullscreenShared'

const FOCUS_COUNT = 5
const CENTER_X = 960
const CENTER_Y = 566

export const renderSpotlightToCanvas: CanvasMotionRenderer<FullscreenParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const items = parseFullscreenItems(params, FOCUS_COUNT)
  const stage = getFullscreenStage(params, localTime, items)
  const exit = stage.exitOpacity
  const at = (alpha: number) => alpha * exit

  drawFullscreenBackdrop(ctx, 'vignette', stage.time, exit)
  drawFullscreenHeader(ctx, resources, stage, params.eyebrow, params.title)

  const activeIndex = stage.items.findIndex((item) => item.active > 0.5)
  const current = activeIndex >= 0 ? stage.items[activeIndex] : null

  if (current) {
    const glowPulse = 0.9 + Math.sin(stage.time * 4) * 0.1
    ctx.save()
    ctx.globalAlpha = at(current.opacity)
    ctx.strokeStyle = 'rgba(255,106,0,.34)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(CENTER_X, CENTER_Y, 300 * glowPulse, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    drawFullscreenPanel(ctx, {
      x: 460,
      y: 470,
      width: 1000,
      height: 160,
      fill: 'rgba(22,48,122,.55)',
      stroke: CANVAS_COLORS.accent,
      lineWidth: 3,
      radius: 24,
      alpha: at(current.opacity),
    })

    const scale = current.scale
    drawText(ctx, {
      text: current.spec.text,
      x: CENTER_X,
      y: CENTER_Y - 44 * scale,
      font: `650 72px ${resources.contentFont}`,
      color: CANVAS_COLORS.paper,
      maxWidth: 900,
      align: 'center',
      alpha: at(current.opacity),
    })
    if (current.spec.note) {
      drawText(ctx, {
        text: current.spec.note,
        x: CENTER_X,
        y: CENTER_Y + 52,
        font: `500 26px ${resources.contentFont}`,
        color: CANVAS_COLORS.muted,
        maxWidth: 760,
        align: 'center',
        alpha: at(current.opacity),
      })
    }
  }

  // 上一焦点淡出：利用引擎的离场进度做交叉过渡
  const previous = stage.items.find((item) => item.index < (activeIndex >= 0 ? activeIndex : Infinity) && item.leave > 0 && item.leave < 1)
  if (previous && activeIndex >= 0) {
    drawText(ctx, {
      text: previous.spec.text,
      x: CENTER_X,
      y: CENTER_Y - 44,
      font: `650 72px ${resources.contentFont}`,
      color: 'rgba(255,255,255,.6)',
      maxWidth: 900,
      align: 'center',
      alpha: at((1 - previous.leave) * 0.5),
    })
  }

  drawPencilLine(ctx, {
    x1: FULLSCREEN_EDGE,
    y1: 870,
    x2: FULLSCREEN_WIDTH - FULLSCREEN_EDGE,
    y2: 870,
    color: 'rgba(255,255,255,.16)',
    width: 1,
    alpha: exit,
  })
  if (items.length > 0) {
    const progressLabel = items.map((item, index) => {
      const isCurrent = index === activeIndex
      const isPast = index < activeIndex
      return isCurrent
        ? CANVAS_COLORS.accent
        : isPast
          ? 'rgba(255,255,255,.5)'
          : 'rgba(255,255,255,.22)'
    })
    const dotSpacing = 26
    const dotsWidth = (items.length - 1) * dotSpacing
    const startX = CENTER_X - dotsWidth / 2
    progressLabel.forEach((color, index) => {
      ctx.save()
      ctx.globalAlpha = at(1)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(startX + index * dotSpacing, 902, index === activeIndex ? 7 : 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })
  }

  drawFullscreenFooter(ctx, resources, stage, items.length)
}
