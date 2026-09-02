import type { CanvasMotionRenderer } from '../../export/canvas/types'
import { CANVAS_COLORS, CARD_PANEL_RADIUS, drawPanel, drawPencilLine, drawText } from '../../export/canvas/primitives'
import type { StepFlowParams } from '../types'
import { getStepFlowState } from './stepFlowState'

export const renderStepFlowToCanvas: CanvasMotionRenderer<StepFlowParams> = ({ ctx, params, localTime, resources }) => {
  const state = getStepFlowState(params, localTime)
  const panel = { x: 122, y: 110, width: 610, height: 760 }
  drawPanel(ctx, { ...panel, fill: CANVAS_COLORS.surface, stroke: null, radius: CARD_PANEL_RADIUS, shadow: {} })
  drawText(ctx, { text: params.eyebrow || '07 / 流程图', x: 156, y: 162, font: `500 15px ${resources.monoFont}`, color: CANVAS_COLORS.muted, maxWidth: 520, alpha: state.headerOpacity })
  drawText(ctx, { text: params.title || '未命名流程', x: 156, y: 198, font: `600 44px ${resources.contentFont}`, color: CANVAS_COLORS.paper, maxWidth: 520, alpha: state.headerOpacity })
  drawPencilLine(ctx, { x1: 156, y1: 265, x2: 700, y2: 265, color: 'rgba(255,255,255,.36)', width: 2, alpha: state.headerOpacity })

  const firstY = 330
  const x = 166
  const gap = (820 - firstY) / 6
  const lastY = firstY + gap * Math.max(0, state.items.length - 1)
  drawPencilLine(ctx, {
    x1: x,
    y1: firstY,
    x2: x,
    y2: lastY,
    color: 'rgba(255,255,255,.4)',
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
      ? CANVAS_COLORS.accent
      : item.completed
        ? CANVAS_COLORS.accentMuted
        : 'rgba(255,255,255,.4)'

    if (index < state.items.length - 1 && item.completed) {
      drawPencilLine(ctx, {
        x1: x,
        y1: y,
        x2: x,
        y2: y + gap,
        color: CANVAS_COLORS.accentMuted,
        width: 3,
        alpha: item.opacity,
      })
    }

    drawPanel(ctx, {
      x: boxLeft,
      y: boxTop,
      width: boxSize,
      height: boxSize,
      fill: CANVAS_COLORS.surfaceDeep,
      stroke: accent,
      lineWidth: active ? 4 : 2,
      alpha: item.opacity,
      radius: 10,
    })

    drawText(ctx, { text: String(index + 1).padStart(2, '0'), x, y: y - 10, font: `500 15px ${resources.monoFont}`, color: accent, maxWidth: 42, align: 'center', alpha: item.opacity })
    drawText(ctx, { text: item.label, x: 220, y: y - 16, font: `560 28px ${resources.contentFont}`, color: active ? CANVAS_COLORS.paper : item.completed ? 'rgba(255,255,255,.6)' : CANVAS_COLORS.muted, maxWidth: 450, alpha: item.opacity })
    drawPencilLine(ctx, { x1: 220, y1: y + 24, x2: 700, y2: y + 24, color: progressed ? CANVAS_COLORS.accentMuted : 'rgba(255,255,255,.3)', width: active ? 2 : 1, alpha: item.opacity })
  })
}
