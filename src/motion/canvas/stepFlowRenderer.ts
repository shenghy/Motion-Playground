import type { CanvasMotionRenderer } from '../../export/canvas/types'
import { CANVAS_COLORS, drawPanel, drawPencilLine, drawText } from '../../export/canvas/primitives'
import type { StepFlowParams } from '../types'
import { getStepFlowState } from './stepFlowState'

export const renderStepFlowToCanvas: CanvasMotionRenderer<StepFlowParams> = ({ ctx, params, localTime, resources }) => {
  const state = getStepFlowState(params, localTime)
  const panel = { x: 122, y: 110, width: 610, height: 760 }
  drawPanel(ctx, { ...panel, fill: 'rgba(5,6,6,.66)', stroke: null })
  drawText(ctx, { text: params.eyebrow || '07 / 流程图', x: 156, y: 162, font: `500 15px ${resources.monoFont}`, color: CANVAS_COLORS.accentBlue, maxWidth: 520, alpha: state.headerOpacity })
  drawText(ctx, { text: params.title || '未命名流程', x: 156, y: 198, font: `600 44px ${resources.contentFont}`, color: CANVAS_COLORS.paper, maxWidth: 520, alpha: state.headerOpacity })
  drawPencilLine(ctx, { x1: 156, y1: 265, x2: 700, y2: 265, color: 'rgba(241,238,229,.36)', width: 2, alpha: state.headerOpacity })

  const firstY = 330
  const x = 166
  const gap = (820 - firstY) / 6
  const lastY = firstY + gap * Math.max(0, state.items.length - 1)
  drawPencilLine(ctx, {
    x1: x,
    y1: firstY,
    x2: x,
    y2: lastY,
    color: '#4d555e',
    width: 2,
    dash: [9, 7],
    alpha: state.connectorReveal,
  })

  state.items.forEach((item, index) => {
    const y = firstY + index * gap
    const active = item.active > 0.5
    const progressed = active || item.completed
    const boxSize = 48 * item.scale
    const boxLeft = x - boxSize / 2
    const boxTop = y - boxSize / 2
    const accent = active
      ? CANVAS_COLORS.accentBlue
      : item.completed
        ? CANVAS_COLORS.accentBlueMuted
        : '#666b70'

    if (index < state.items.length - 1 && item.completed) {
      drawPencilLine(ctx, {
        x1: x,
        y1: y,
        x2: x,
        y2: y + gap,
        color: CANVAS_COLORS.accentBlueMuted,
        width: 3,
        alpha: item.opacity,
      })
    }

    ctx.save()
    ctx.globalAlpha = item.opacity
    ctx.fillStyle = '#0c0d0f'
    ctx.strokeStyle = accent
    ctx.lineWidth = active ? 4 : 2
    ctx.fillRect(boxLeft, boxTop, boxSize, boxSize)
    ctx.strokeRect(boxLeft, boxTop, boxSize, boxSize)
    ctx.restore()

    drawText(ctx, { text: String(index + 1).padStart(2, '0'), x, y: y - 10, font: `500 15px ${resources.monoFont}`, color: accent, maxWidth: 42, align: 'center', alpha: item.opacity })
    drawText(ctx, { text: item.label, x: 220, y: y - 16, font: `560 28px ${resources.contentFont}`, color: active ? CANVAS_COLORS.paper : item.completed ? '#7996b8' : '#7e8386', maxWidth: 450, alpha: item.opacity })
    drawPencilLine(ctx, { x1: 220, y1: y + 24, x2: 700, y2: y + 24, color: progressed ? CANVAS_COLORS.accentBlueMuted : '#424649', width: active ? 2 : 1, alpha: item.opacity })
  })
}
