import type { CanvasMotionRenderer } from '../../export/canvas/types'
import { CANVAS_COLORS, drawGrid, drawPanel, drawPencilLine, drawText } from '../../export/canvas/primitives'
import type { CompareSplitParams } from '../types'
import { getCompareSplitState } from './compareSplitState'

export const renderCompareSplitToCanvas: CanvasMotionRenderer<CompareSplitParams> = ({ ctx, params, localTime, resources }) => {
  const state = getCompareSplitState(params, localTime)
  drawGrid(ctx, { width: resources.width, height: 930, step: 96, alpha: 0.09 })
  drawText(ctx, { text: '02 / 对比研究', x: 96, y: 74, font: `500 13px ${resources.monoFont}`, color: '#777c80', maxWidth: 240, alpha: state.headerOpacity })
  drawText(ctx, { text: params.title || '未命名对比', x: 96, y: 104, font: `400 38px ${resources.handwritingFont}`, color: CANVAS_COLORS.paper, maxWidth: 620, alpha: state.headerOpacity })
  drawText(ctx, { text: '双项对比', x: 1780, y: 88, font: `500 12px ${resources.monoFont}`, color: '#777c80', maxWidth: 120, align: 'right', alpha: state.headerOpacity })
  const left = { x: 82, y: 180, width: resources.width * state.primaryWidth / 100, height: 680 }
  const right = { x: 1480, y: 240, width: 360, height: 560 }

  const drawSide = (side: 'left' | 'right') => {
    const box = side === 'left' ? left : right
    const reveal = side === 'left' ? state.leftReveal : state.rightReveal
    const emphasized = params.emphasis === side
    const value = side === 'left' ? state.leftValue : state.rightValue
    const label = side === 'left' ? (params.leftLabel || '左侧') : (params.rightLabel || '右侧')
    const meter = side === 'left' ? state.leftMeter : state.rightMeter
    ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.width * reveal, box.height); ctx.clip()
    drawPanel(ctx, { ...box, fill: emphasized ? 'rgba(20,23,23,.82)' : 'rgba(5,6,6,.62)', stroke: emphasized ? '#d9dad5' : 'rgba(241,238,229,.35)', lineWidth: emphasized ? 3 : 1 })
    drawText(ctx, { text: side === 'left' ? '方案甲 / 01' : '方案乙 / 02', x: box.x + 30, y: box.y + 28, font: `500 12px ${resources.monoFont}`, color: '#7c8184', maxWidth: box.width - 60 })
    drawText(ctx, { text: label, x: box.x + 44, y: box.y + 144, font: `400 32px ${resources.handwritingFont}`, color: emphasized ? CANVAS_COLORS.paper : '#999e9f', maxWidth: box.width - 88 })
    drawText(ctx, { text: value, x: box.x + 44, y: box.y + 210, font: `650 118px ${resources.displayFont}`, color: emphasized ? CANVAS_COLORS.paper : '#a1a5a4', maxWidth: box.width - 130 })
    drawText(ctx, { text: params.suffix, x: box.x + box.width - 72, y: box.y + 270, font: `500 28px ${resources.displayFont}`, color: '#858a89', maxWidth: 50 })
    drawText(ctx, { text: side === 'left' ? '基准 / 参考' : '当前 / 已优化', x: box.x + 44, y: box.y + 390, font: `500 12px ${resources.monoFont}`, color: '#74797c', maxWidth: box.width - 88 })
    drawPencilLine(ctx, { x1: box.x + 42, y1: box.y + 448, x2: box.x + box.width - 42, y2: box.y + 448, color: '#555a5d' })
    drawPencilLine(ctx, { x1: box.x + 42, y1: box.y + 448, x2: box.x + 42 + (box.width - 84) * Math.min(1, meter), y2: box.y + 448, color: emphasized ? CANVAS_COLORS.paper : '#94999a', width: emphasized ? 5 : 3 })
    drawPencilLine(ctx, { x1: box.x + 38, y1: box.y + 360, x2: box.x + (box.width - 30) * state.strikeReveal, y2: box.y + 345, color: '#9b9f9f', width: 3, alpha: emphasized ? 0.25 : 0.8 })
    ctx.restore()
  }
  drawSide('left'); drawSide('right')
  drawPencilLine(ctx, { x1: left.x + left.width + 52, y1: 530, x2: right.x - 46, y2: 500, color: '#a0a5a5', width: 3, alpha: state.resultOpacity })
  drawPencilLine(ctx, { x1: right.x - 66, y1: 482, x2: right.x - 46, y2: 500, color: '#a0a5a5', width: 3, alpha: state.resultOpacity })
  drawPanel(ctx, { x: 82, y: 900, width: 1758, height: 96, fill: 'rgba(5,6,6,.68)', stroke: 'rgba(241,238,229,.25)', alpha: state.resultOpacity })
  drawText(ctx, { text: '结论 / 已锁定', x: 116, y: 931, font: `500 12px ${resources.monoFont}`, color: '#7b8083', maxWidth: 180, alpha: state.resultOpacity })
  drawText(ctx, { text: params.conclusion || '暂无结论', x: 460, y: 919, font: `400 30px ${resources.handwritingFont}`, color: CANVAS_COLORS.paper, maxWidth: 900, alpha: state.resultOpacity })
  drawText(ctx, { text: '可信度 98.4', x: 1790, y: 932, font: `500 12px ${resources.monoFont}`, color: '#7b8083', maxWidth: 160, align: 'right', alpha: state.resultOpacity })
}
