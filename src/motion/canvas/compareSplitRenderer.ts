import type { CanvasMotionRenderer } from '../../export/canvas/types'
import {
  CANVAS_COLORS,
  drawGrid,
  drawPanel,
  drawPencilLine,
  drawText,
} from '../../export/canvas/primitives'
import type { CompareSplitParams } from '../types'
import { getCompareSplitState } from './compareSplitState'

export const renderCompareSplitToCanvas: CanvasMotionRenderer<CompareSplitParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const state = getCompareSplitState(params, localTime)
  drawGrid(ctx, { width: resources.width, height: 930, step: 96, alpha: 0.09 })
  drawText(ctx, {
    text: '02 / 对比研究', x: 96, y: 74,
    font: `600 13px ${resources.monoFont}`,
    color: CANVAS_COLORS.accentBlue, maxWidth: 240, alpha: state.headerOpacity,
  })
  drawText(ctx, {
    text: params.title || '未命名对比', x: 96, y: 108,
    font: `600 38px ${resources.contentFont}`,
    color: CANVAS_COLORS.paper, maxWidth: 900, alpha: state.headerOpacity,
  })

  const left = { x: 82, y: 200, width: 470, height: 550 }
  const right = { x: 590, y: 200, width: 470, height: 550 }

  const drawSide = (side: 'left' | 'right') => {
    const box = side === 'left' ? left : right
    const reveal = side === 'left' ? state.leftReveal : state.rightReveal
    const emphasized = params.emphasis === side
    const value = side === 'left' ? state.leftValue : state.rightValue
    const label = side === 'left'
      ? (params.leftLabel || '左侧')
      : (params.rightLabel || '右侧')
    const meter = side === 'left' ? state.leftMeter : state.rightMeter

    ctx.save()
    ctx.beginPath()
    ctx.rect(box.x, box.y, box.width * reveal, box.height)
    ctx.clip()
    drawPanel(ctx, {
      ...box,
      fill: emphasized ? 'rgba(20,23,23,.82)' : 'rgba(5,6,6,.62)',
      stroke: null,
    })
    drawText(ctx, {
      text: side === 'left' ? '方案甲 / 01' : '方案乙 / 02',
      x: box.x + 28, y: box.y + 28,
      font: `600 12px ${resources.monoFont}`,
      color: emphasized ? CANVAS_COLORS.accentBlue : '#7c8184',
      maxWidth: box.width - 56,
    })
    drawText(ctx, {
      text: label, x: box.x + 34, y: box.y + 116,
      font: `500 28px ${resources.contentFont}`,
      color: emphasized ? CANVAS_COLORS.paper : '#999e9f',
      maxWidth: box.width - 68,
    })
    drawText(ctx, {
      text: value, x: box.x + 34, y: box.y + 176,
      font: `650 94px ${resources.displayFont}`,
      color: emphasized ? CANVAS_COLORS.paper : '#a1a5a4',
      maxWidth: box.width - 110,
    })
    drawText(ctx, {
      text: params.suffix, x: box.x + box.width - 66, y: box.y + 225,
      font: `550 26px ${resources.displayFont}`,
      color: emphasized ? CANVAS_COLORS.accentBlue : '#858a89', maxWidth: 44,
    })
    drawText(ctx, {
      text: side === 'left' ? '基准 / 参考' : '当前 / 已优化',
      x: box.x + 34, y: box.y + 350,
      font: `500 12px ${resources.monoFont}`,
      color: '#74797c', maxWidth: box.width - 68,
    })
    drawPencilLine(ctx, {
      x1: box.x + 34, y1: box.y + 418,
      x2: box.x + box.width - 34, y2: box.y + 418,
      color: '#555a5d',
    })
    drawPencilLine(ctx, {
      x1: box.x + 34, y1: box.y + 418,
      x2: box.x + 34 + (box.width - 68) * Math.min(1, meter),
      y2: box.y + 418,
      color: emphasized ? CANVAS_COLORS.accentBlue : '#94999a',
      width: emphasized ? 5 : 3,
    })
    ctx.restore()
  }

  drawSide('left')
  drawSide('right')
  drawPencilLine(ctx, {
    x1: 540, y1: 480, x2: 582, y2: 480,
    color: CANVAS_COLORS.accentBlue, width: 3, alpha: state.resultOpacity,
  })

  drawPanel(ctx, {
    x: 82, y: 820, width: 978, height: 122,
    fill: 'rgba(5,6,6,.68)', stroke: null, alpha: state.resultOpacity,
  })
  drawText(ctx, {
    text: '结论 / 已锁定', x: 116, y: 850,
    font: `600 12px ${resources.monoFont}`,
    color: CANVAS_COLORS.accentBlue, maxWidth: 180, alpha: state.resultOpacity,
  })
  drawText(ctx, {
    text: params.conclusion || '暂无结论', x: 116, y: 882,
    font: `500 28px ${resources.contentFont}`,
    color: CANVAS_COLORS.paper, maxWidth: 860, alpha: state.resultOpacity,
  })
}
