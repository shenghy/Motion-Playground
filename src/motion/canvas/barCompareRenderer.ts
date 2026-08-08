import type { CanvasMotionRenderer } from '../../export/canvas/types'
import { CANVAS_COLORS, drawHatchFill, drawPanel, drawPencilLine, drawText } from '../../export/canvas/primitives'
import type { BarCompareParams } from '../types'
import { getBarCompareState } from './barCompareState'

export const renderBarCompareToCanvas: CanvasMotionRenderer<BarCompareParams> = ({ ctx, params, localTime, resources }) => {
  const state = getBarCompareState(params, localTime)
  const panel = { x: 78, y: 150, width: 616, height: 726 }
  drawPanel(ctx, { ...panel, fill: 'rgba(5,6,6,.66)', stroke: null })
  drawHatchFill(ctx, { ...panel, spacing: 18, alpha: 0.045 })
  drawText(ctx, { text: params.eyebrow || '04 / 数据对比', x: 122, y: 210, font: `500 13px ${resources.monoFont}`, color: '#8c9196', maxWidth: 470, alpha: state.headerOpacity })
  drawText(ctx, { text: params.title || '未命名对比', x: 122, y: 245, font: `600 39px ${resources.contentFont}`, color: CANVAS_COLORS.paper, maxWidth: 470, alpha: state.headerOpacity })
  drawPencilLine(ctx, { x1: 122, y1: 302, x2: 608, y2: 302, color: 'rgba(241,238,229,.36)', width: 2, alpha: state.headerOpacity })
  drawPencilLine(ctx, { x1: 130, y1: 758, x2: 130 + 490 * state.baselineReveal, y2: 758, color: '#7c8183', width: 2 })

  const slot = 430 / state.items.length
  state.items.forEach((item, index) => {
    const width = Math.min(78, slot * 0.52)
    const x = 148 + index * slot + (slot - width) / 2
    const height = 350 * item.height * item.barReveal
    const y = 758 - height
    drawPanel(ctx, { x, y, width, height, fill: item.focused ? CANVAS_COLORS.accentBlue : ['#5f6468', '#7a7f83', '#9b9f9f'][index % 3], stroke: item.focused ? CANVAS_COLORS.accentBlueMuted : '#6f7478', lineWidth: item.focused ? 3 : 1, alpha: item.barReveal })
    if (item.focused) drawPencilLine(ctx, { x1: x - 5, y1: y + 3, x2: x - 5, y2: 758, color: '#aeb1af', width: 2, alpha: item.barReveal })
    drawText(ctx, { text: `${item.value}${params.suffix}`, x: x - 16, y: Math.max(330, y - 42), font: `600 24px ${resources.monoFont}`, color: item.focused ? CANVAS_COLORS.paper : '#9ba09f', maxWidth: width + 32, align: 'center', alpha: item.barReveal })
    drawText(ctx, { text: item.label, x: x + width / 2, y: 783, font: `500 25px ${resources.contentFont}`, color: item.focused ? CANVAS_COLORS.paper : '#8c9196', maxWidth: slot - 12, align: 'center', alpha: item.labelOpacity })
  })

}
