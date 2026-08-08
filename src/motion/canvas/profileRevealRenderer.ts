import type { CanvasMotionRenderer } from '../../export/canvas/types'
import { CANVAS_COLORS, drawHatchFill, drawPanel, drawPencilLine, drawText } from '../../export/canvas/primitives'
import type { ProfileRevealParams } from '../types'
import { getProfileRevealState } from './profileRevealState'

export const renderProfileRevealToCanvas: CanvasMotionRenderer<ProfileRevealParams> = ({ ctx, params, localTime, resources }) => {
  const state = getProfileRevealState(params, localTime)
  const card = { x: 78, y: 142, width: 686, height: 752 }
  drawPanel(ctx, { ...card, fill: 'rgba(8,10,10,.72)', stroke: null, alpha: state.card.opacity })
  drawHatchFill(ctx, { ...card, spacing: 21, alpha: state.card.opacity * 0.035 })
  ctx.save(); ctx.globalAlpha = state.identity.opacity; ctx.translate(0, state.identity.y)
  drawPanel(ctx, { x: 118, y: 196, width: 12, height: 74, fill: CANVAS_COLORS.accentBlue, stroke: CANVAS_COLORS.accentBlueMuted })
  drawText(ctx, { text: params.category || '人物 / 档案', x: 154, y: 198, font: `600 15px ${resources.monoFont}`, color: CANVAS_COLORS.paper, maxWidth: 500 })
  drawText(ctx, { text: params.descriptor || '人物身份说明', x: 154, y: 230, font: `400 16px ${resources.monoFont}`, color: '#858b8d', maxWidth: 500 })
  ctx.restore()
  drawText(ctx, { text: params.overline || '人物故事', x: 118, y: 320 + state.title.y, font: `500 12px ${resources.monoFont}`, color: '#747a7d', maxWidth: 540, alpha: state.title.opacity })
  drawText(ctx, { text: params.title || '未命名人物', x: 118, y: 354 + state.title.y, font: `600 48px ${resources.contentFont}`, color: CANVAS_COLORS.paper, maxWidth: 540, alpha: state.title.opacity })
  drawPencilLine(ctx, { x1: 118, y1: 422, x2: 704, y2: 422, color: 'rgba(241,238,229,.3)', alpha: state.title.opacity })
  const facts = [
    { text: params.fact1, note: params.fact1Note },
    { text: params.fact2, note: params.fact2Note },
    { text: params.fact3, note: params.fact3Note },
  ]
  facts.forEach((fact, index) => {
    const layer = state.facts[index]
    const y = 476 + index * 112 + layer.y
    ctx.save(); ctx.globalAlpha = layer.opacity; ctx.strokeStyle = CANVAS_COLORS.accentBlue; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(142, y + 18, 16, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
    drawText(ctx, { text: '✓', x: 142, y: y + 5, font: `600 18px ${resources.monoFont}`, color: CANVAS_COLORS.accentBlue, maxWidth: 30, align: 'center', alpha: layer.opacity })
    drawText(ctx, { text: fact.text || `信息 ${index + 1}`, x: 184, y, font: `500 29px ${resources.contentFont}`, color: CANVAS_COLORS.paper, maxWidth: 470, alpha: layer.opacity })
    drawText(ctx, { text: fact.note || '详情待补充', x: 184, y: y + 46, font: `400 14px ${resources.monoFont}`, color: '#7c8184', maxWidth: 470, alpha: layer.opacity })
  })
  drawText(ctx, { text: '叙事 / 03', x: 118, y: 842 + state.footer.y, font: `500 12px ${resources.monoFont}`, color: '#747a7d', maxWidth: 120, alpha: state.footer.opacity })
  drawPencilLine(ctx, { x1: 250, y1: 850, x2: 618, y2: 850, color: '#505558', alpha: state.footer.opacity })
  drawText(ctx, { text: '自动呈现', x: 704, y: 842 + state.footer.y, font: `500 12px ${resources.monoFont}`, color: '#747a7d', maxWidth: 90, align: 'right', alpha: state.footer.opacity })

}
