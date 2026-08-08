import type { CanvasMotionRenderer } from '../../export/canvas/types'
import { CANVAS_COLORS, drawPanel, drawPencilLine, drawText } from '../../export/canvas/primitives'
import type { ShareRingParams } from '../types'
import { getShareRingState } from './shareRingState'

export const renderShareRingToCanvas: CanvasMotionRenderer<ShareRingParams> = ({ ctx, params, localTime, resources }) => {
  const state = getShareRingState(params, localTime)
  const panel = { x: 78, y: 150, width: 616, height: 726 }
  drawPanel(ctx, { ...panel, fill: 'rgba(5,6,6,.66)', stroke: null })
  drawText(ctx, { text: params.eyebrow || '05 / 占比分析', x: 122, y: 210, font: `500 13px ${resources.monoFont}`, color: '#8c9196', maxWidth: 470, alpha: state.headerOpacity })
  drawText(ctx, { text: params.title || '未命名占比', x: 122, y: 245, font: `600 39px ${resources.contentFont}`, color: CANVAS_COLORS.paper, maxWidth: 470, alpha: state.headerOpacity })
  drawPencilLine(ctx, { x1: 122, y1: 302, x2: 608, y2: 302, color: 'rgba(241,238,229,.36)', width: 2, alpha: state.headerOpacity })

  const cx = 333
  const cy = 492
  const radius = 139
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-Math.PI / 2)
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(241,238,229,.12)'
  ctx.lineWidth = 12
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke()
  const colors = ['#efefea', '#969b9d', '#666b70', '#3f4449']
  state.items.forEach((item, index) => {
    const start = item.offset / 100 * Math.PI * 2
    const sweep = item.percentage / 100 * Math.PI * 2 * item.reveal
    if (sweep <= 0) return
    ctx.strokeStyle = item.focused ? CANVAS_COLORS.accentBlue : colors[index]
    ctx.lineWidth = item.focused ? 24 : Math.max(11, 20 - index * 2)
    ctx.beginPath(); ctx.arc(0, 0, radius, start + 0.018, start + sweep - 0.018); ctx.stroke()
    if (item.focused) {
      ctx.strokeStyle = CANVAS_COLORS.accentBlueMuted; ctx.lineWidth = 4
      ctx.beginPath(); ctx.arc(0, 0, radius - 14, start + 0.018, start + sweep - 0.018); ctx.stroke()
    }
  })
  ctx.restore()
  drawText(ctx, { text: `${state.focusPercentage}%`, x: cx, y: cy - 38, font: `650 50px ${resources.displayFont}`, color: CANVAS_COLORS.paper, maxWidth: 170, align: 'center', alpha: state.centerOpacity })
  drawText(ctx, { text: params.centerLabel || state.items[state.focusIndex].label, x: cx, y: cy + 26, font: `500 22px ${resources.contentFont}`, color: '#a4a8a7', maxWidth: 180, align: 'center', alpha: state.centerOpacity })
  state.items.forEach((item, index) => {
    const y = 686 + index * 38
    drawText(ctx, { text: item.label, x: 130, y, font: `400 19px ${resources.contentFont}`, color: item.focused ? CANVAS_COLORS.paper : '#868b8e', maxWidth: 300, alpha: item.labelOpacity })
    drawText(ctx, { text: `${Math.round(item.percentage)}%`, x: 605, y, font: `500 17px ${resources.monoFont}`, color: item.focused ? CANVAS_COLORS.paper : '#868b8e', maxWidth: 90, align: 'right', alpha: item.labelOpacity })
  })
}
