import type { CanvasMotionRenderer } from '../../export/canvas/types'
import {
  CANVAS_COLORS,
  drawGrid,
  drawPanel,
  drawPencilLine,
  drawText,
} from '../../export/canvas/primitives'
import type { MetricFocusParams } from '../types'
import { getMetricFocusState } from './metricFocusState'

const CW = 19.2

export const renderMetricFocusToCanvas: CanvasMotionRenderer<MetricFocusParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const state = getMetricFocusState(params, localTime)
  const frame = {
    x: 76.8,
    y: 151.2,
    width: 614.4,
    height: 723.6,
  }

  drawGrid(ctx, {
    width: resources.width,
    height: 930,
    step: CW * 5,
    alpha: 0.1,
  })
  drawText(ctx, {
    text: '横轴 0128 / 纵轴 0096',
    x: CW * 4.8,
    y: CW * 3.6,
    font: `500 12px ${resources.monoFont}`,
    color: '#595d62',
    maxWidth: 260,
  })
  drawText(ctx, {
    text: '画面 001',
    x: 1710,
    y: 900,
    font: `500 12px ${resources.monoFont}`,
    color: '#595d62',
    maxWidth: 120,
  })

  drawPencilLine(ctx, {
    x1: frame.x,
    y1: 551,
    x2: frame.x + frame.width * state.scan.scaleX,
    y2: 551,
    color: '#d9dad5',
    alpha: state.scan.opacity,
  })

  drawPanel(ctx, {
    ...frame,
    fill: 'rgba(5,6,6,.6)',
    stroke: 'rgba(241,238,229,.42)',
  })
  drawPencilLine(ctx, {
    x1: frame.x,
    y1: frame.y,
    x2: frame.x,
    y2: frame.y + frame.height,
    color: CANVAS_COLORS.paper,
    width: 2,
  })
  drawPencilLine(ctx, {
    x1: frame.x - 2,
    y1: frame.y - 3,
    x2: frame.x + frame.width * 0.72,
    y2: frame.y - 5,
    color: CANVAS_COLORS.paper,
    dash: [17, 3],
    alpha: 0.5,
    width: 3,
  })

  const contentX = frame.x + 46
  ctx.save()
  ctx.globalAlpha = state.eyebrow.opacity
  ctx.translate(0, state.eyebrow.y)
  drawPanel(ctx, {
    x: contentX,
    y: 280,
    width: 46,
    height: 31,
    fill: 'transparent',
    stroke: '#696d71',
  })
  drawText(ctx, {
    text: '01',
    x: contentX + 12,
    y: 288,
    font: `500 12px ${resources.monoFont}`,
    color: '#8d9194',
    maxWidth: 28,
  })
  drawText(ctx, {
    text: params.eyebrow || '未命名指标',
    x: contentX + 68,
    y: 282,
    font: `400 28px ${resources.handwritingFont}`,
    color: '#c6c8c5',
    maxWidth: 390,
  })
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = state.value.opacity
  ctx.translate(contentX + 220, 465)
  ctx.scale(state.value.scale, state.value.scale)
  ctx.translate(-(contentX + 220), -465)
  ctx.filter = state.value.scale < 0.99 ? 'blur(4px)' : 'none'
  drawText(ctx, {
    text: params.prefix,
    x: contentX,
    y: 392,
    font: `500 40px ${resources.displayFont}`,
    color: '#9da09e',
    maxWidth: 55,
  })
  drawText(ctx, {
    text: state.number,
    x: contentX + 52,
    y: 350,
    font: `640 160px ${resources.displayFont}`,
    color: CANVAS_COLORS.paper,
    maxWidth: 400,
  })
  drawText(ctx, {
    text: params.suffix,
    x: contentX + 458,
    y: 396,
    font: `500 38px ${resources.displayFont}`,
    color: '#9da09e',
    maxWidth: 70,
  })
  ctx.restore()

  drawText(ctx, {
    text: params.description || '暂无说明',
    x: contentX,
    y: 570 + state.meta.y,
    font: `400 28px ${resources.handwritingFont}`,
    color: '#8c9091',
    maxWidth: 490,
    alpha: state.meta.opacity,
  })
  drawPencilLine(ctx, {
    x1: contentX,
    y1: 620,
    x2: contentX + 480 * state.pencilLine.reveal,
    y2: 620,
    color: CANVAS_COLORS.paper,
    width: 2,
  })

  const visibleTicks = Math.ceil(17 * state.ticks.reveal)
  for (let index = 0; index < visibleTicks; index += 1) {
    const x = contentX + index * 30
    drawPencilLine(ctx, {
      x1: x,
      y1: 660,
      x2: x + 1,
      y2: 660 + (index % 4 === 0 ? 19 : 11),
      color: index % 4 === 0 ? '#a0a3a2' : '#4d5053',
      alpha: 0.62,
    })
  }

  const secondaryX = 1670 + state.secondary.x
  drawPanel(ctx, {
    x: secondaryX,
    y: 313,
    width: 192,
    height: 313,
    fill: 'rgba(5,6,6,.5)',
    stroke: 'rgba(241,238,229,.25)',
    alpha: state.secondary.opacity,
  })
  drawText(ctx, {
    text: '变化 / 实时',
    x: secondaryX + 18,
    y: 350,
    font: `500 11px ${resources.monoFont}`,
    color: '#858a89',
    maxWidth: 150,
    alpha: state.secondary.opacity,
  })
  drawText(ctx, {
    text: params.trend || '—',
    x: secondaryX + 18,
    y: 405,
    font: `500 22px ${resources.monoFont}`,
    color: CANVAS_COLORS.paper,
    maxWidth: 150,
    alpha: state.secondary.opacity,
  })
  drawPencilLine(ctx, {
    x1: secondaryX + 18,
    y1: 505,
    x2: secondaryX + 174,
    y2: 505,
    color: 'rgba(255,255,255,.28)',
    alpha: state.secondary.opacity,
  })
  drawText(ctx, {
    text: '指标',
    x: secondaryX + 18,
    y: 530,
    font: `500 11px ${resources.monoFont}`,
    color: '#858a89',
    maxWidth: 80,
    alpha: state.secondary.opacity,
  })
  drawText(ctx, {
    text: '已锁定',
    x: secondaryX + 18,
    y: 548,
    font: `500 11px ${resources.monoFont}`,
    color: '#858a89',
    maxWidth: 80,
    alpha: state.secondary.opacity,
  })
}
