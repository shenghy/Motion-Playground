import type { CanvasMotionRenderer } from '../../export/canvas/types'
import { CANVAS_COLORS, drawPanel, drawPencilLine, drawText } from '../../export/canvas/primitives'
import type { StepFlowParams } from '../types'
import { getStepFlowState } from './stepFlowState'

export const renderStepFlowToCanvas: CanvasMotionRenderer<StepFlowParams> = ({ ctx, params, localTime, resources }) => {
  const state = getStepFlowState(params, localTime)
  const panel = { x: 78, y: 150, width: 616, height: 726 }
  drawPanel(ctx, { ...panel, fill: 'rgba(5,6,6,.66)', stroke: null })
  drawText(ctx, { text: params.eyebrow || '06 / 流程图', x: 122, y: 210, font: `500 13px ${resources.monoFont}`, color: '#8c9196', maxWidth: 470, alpha: state.headerOpacity })
  drawText(ctx, { text: params.title || '未命名流程', x: 122, y: 245, font: `600 39px ${resources.contentFont}`, color: CANVAS_COLORS.paper, maxWidth: 470, alpha: state.headerOpacity })
  drawPencilLine(ctx, { x1: 122, y1: 302, x2: 608, y2: 302, color: 'rgba(241,238,229,.36)', width: 2, alpha: state.headerOpacity })
  ctx.save()
  ctx.globalAlpha = state.connectorReveal
  ctx.strokeStyle = '#666b70'; ctx.lineWidth = 2; ctx.setLineDash([9, 7])
  ctx.beginPath(); ctx.moveTo(187, 360); ctx.bezierCurveTo(130, 480, 250, 610, 185, 806); ctx.stroke(); ctx.restore()
  const gap = 400 / Math.max(1, state.items.length - 1)
  state.items.forEach((item, index) => {
    const x = 186 + (index % 2 === 0 ? 0 : 58)
    const y = 365 + index * gap
    const radius = 27 * item.scale
    ctx.save(); ctx.globalAlpha = item.opacity; ctx.strokeStyle = item.active > 0.5 ? CANVAS_COLORS.paper : '#666b70'; ctx.lineWidth = item.active > 0.5 ? 4 : 2
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
    drawText(ctx, { text: String(index + 1).padStart(2, '0'), x, y: y - 11, font: `500 15px ${resources.monoFont}`, color: item.active > 0.5 ? CANVAS_COLORS.paper : '#72777b', maxWidth: 42, align: 'center', alpha: item.opacity })
    drawText(ctx, { text: item.label, x: x + 68, y: y - 16, font: `500 27px ${resources.contentFont}`, color: item.active > 0.5 ? CANVAS_COLORS.paper : '#7e8386', maxWidth: 310, alpha: item.opacity })
    drawPencilLine(ctx, { x1: x + 67, y1: y + 24, x2: x + 360, y2: y + 24, color: item.active > 0.5 ? '#adb0ae' : '#424649', width: item.active > 0.5 ? 2 : 1, alpha: item.opacity })
  })
  const active = state.items.reduce((best, item) => item.active > best.active ? item : best, state.items[0])
  const rx = 1670
  drawPanel(ctx, { x: rx, y: 320, width: 192, height: 306, fill: 'rgba(5,6,6,.56)', stroke: null })
  drawText(ctx, { text: params.statusLabel || '当前步骤', x: rx + 18, y: 354, font: `500 12px ${resources.monoFont}`, color: '#858a89', maxWidth: 150 })
  drawText(ctx, { text: String(active.index + 1).padStart(2, '0'), x: rx + 18, y: 404, font: `620 42px ${resources.displayFont}`, color: CANVAS_COLORS.paper, maxWidth: 154 })
  drawPencilLine(ctx, { x1: rx + 18, y1: 510, x2: rx + 174, y2: 510, color: '#74797a' })
  drawText(ctx, { text: params.statusNote || active.label, x: rx + 18, y: 540, font: `400 18px ${resources.contentFont}`, color: '#9ca09f', maxWidth: 154 })
}
