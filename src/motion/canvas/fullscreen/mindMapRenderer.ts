import { CANVAS_COLORS, drawText } from '../../../export/canvas/primitives'
import type { CanvasMotionRenderer } from '../../../export/canvas/types'
import type { FullscreenParams } from '../../types'
import {
  FULLSCREEN_DEEP_COLOR,
  drawFullscreenBackdrop,
  drawFullscreenFooter,
  drawFullscreenHeader,
  drawFullscreenPanel,
  getFullscreenStage,
  itemEmphasisColor,
  parseFullscreenItems,
} from './fullscreenShared'

const BRANCH_COUNT = 6
const CENTER_X = 430
const CENTER_Y = 540
const CENTER_RADIUS = 168

interface BranchPlacement {
  angle: number
  length: number
}

function branchPlacement(index: number): BranchPlacement {
  // 右侧 4 个、左侧 2 个，扇形展开；角度以 +x 轴为 0，向上为负
  const rightAngles = [-58, -19, 19, 58]
  const leftAngles = [148, -148]
  const right = index < rightAngles.length
  return right
    ? { angle: rightAngles[index], length: 560 }
    : { angle: leftAngles[index - rightAngles.length], length: 420 }
}

export const renderMindMapToCanvas: CanvasMotionRenderer<FullscreenParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const items = parseFullscreenItems(params, BRANCH_COUNT)
  const stage = getFullscreenStage(params, localTime, items)
  const exit = stage.exitOpacity
  const at = (alpha: number) => alpha * exit

  drawFullscreenBackdrop(ctx, 'rings', stage.time, exit)
  drawFullscreenHeader(ctx, resources, stage, params.eyebrow, params.title)

  const ripple = 0.75 + 0.25 * stage.headerOpacity
  drawFullscreenPanel(ctx, {
    x: CENTER_X - CENTER_RADIUS * ripple,
    y: CENTER_Y - CENTER_RADIUS * ripple,
    width: CENTER_RADIUS * 2 * ripple,
    height: CENTER_RADIUS * 2 * ripple,
    fill: FULLSCREEN_DEEP_COLOR,
    stroke: stage.headerOpacity > 0.5 ? CANVAS_COLORS.accent : 'rgba(255,255,255,.4)',
    lineWidth: 3,
    radius: CENTER_RADIUS * ripple,
    alpha: at(0.4 + stage.headerOpacity * 0.6),
  })
  drawText(ctx, {
    text: params.title || '主题',
    x: CENTER_X,
    y: CENTER_Y - 20,
    font: `650 30px ${resources.contentFont}`,
    color: CANVAS_COLORS.paper,
    maxWidth: 300,
    align: 'center',
    alpha: at(stage.headerOpacity),
  })
  drawText(ctx, {
    text: `${items.length} 分支`,
    x: CENTER_X,
    y: CENTER_Y + 30,
    font: `500 16px ${resources.monoFont}`,
    color: CANVAS_COLORS.accent,
    maxWidth: 200,
    align: 'center',
    alpha: at(stage.headerOpacity),
  })

  stage.items.forEach((phase, index) => {
    if (!phase.entered) return
    const { angle, length } = branchPlacement(index)
    const rad = (angle * Math.PI) / 180
    const startX = CENTER_X + Math.cos(rad) * CENTER_RADIUS
    const startY = CENTER_Y + Math.sin(rad) * CENTER_RADIUS
    const endX = CENTER_X + Math.cos(rad) * (CENTER_RADIUS + length)
    const endY = CENTER_Y + Math.sin(rad) * (CENTER_RADIUS + length)
    const controlX = (startX + endX) / 2 + Math.sin(rad) * 26
    const controlY = (startY + endY) / 2 - Math.cos(rad) * 26
    const color = itemEmphasisColor(phase)

    ctx.save()
    ctx.globalAlpha = at(phase.opacity * phase.grow)
    ctx.strokeStyle = phase.active > 0.5 ? CANVAS_COLORS.accent : 'rgba(255,255,255,.4)'
    ctx.lineWidth = phase.active > 0.5 ? 4 : 2
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.quadraticCurveTo(controlX, controlY, endX, endY)
    ctx.stroke()
    ctx.restore()

    const radius = (phase.active > 0.5 ? 15 : 11) * phase.scale
    ctx.save()
    ctx.globalAlpha = at(phase.opacity)
    ctx.fillStyle = phase.active > 0.5 ? CANVAS_COLORS.accent : 'rgba(255,255,255,.82)'
    ctx.beginPath()
    ctx.arc(endX, endY, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    const textX = endX + (angle > 90 || angle < -90 ? -34 : 34)
    const textAlign = angle > 90 || angle < -90 ? 'right' : 'left'
    const slideX = textX + (textAlign === 'left' ? -1 : 1) * (1 - phase.slide) * 46
    drawText(ctx, {
      text: phase.spec.text,
      x: slideX,
      y: endY - 14,
      font: `600 30px ${resources.contentFont}`,
      color,
      maxWidth: 380,
      align: textAlign,
      alpha: at(phase.opacity),
    })
    if (phase.spec.note) {
      drawText(ctx, {
        text: phase.spec.note,
        x: slideX,
        y: endY + 24,
        font: `500 18px ${resources.monoFont}`,
        color: 'rgba(255,255,255,.6)',
        maxWidth: 380,
        align: textAlign,
        alpha: at(phase.opacity),
      })
    }
  })

  drawFullscreenFooter(ctx, resources, stage, items.length)
}
