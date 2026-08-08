import type { CanvasMotionRenderer } from '../../export/canvas/types'
import {
  CANVAS_COLORS,
  drawGrid,
  drawPencilLine,
  drawText,
} from '../../export/canvas/primitives'
import type { MetricFocusParams } from '../types'
import { getMetricFocusState } from './metricFocusState'

const CONTENT_X = 122
const AXIS_END = 1010

export const renderMetricFocusToCanvas: CanvasMotionRenderer<MetricFocusParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const state = getMetricFocusState(params, localTime)

  drawGrid(ctx, {
    width: resources.width,
    height: 930,
    step: 96,
    alpha: 0.1,
  })
  drawText(ctx, {
    text: '横轴 0128 / 纵轴 0096',
    x: 92,
    y: 70,
    font: `500 12px ${resources.monoFont}`,
    color: '#595d62',
    maxWidth: 260,
  })

  drawText(ctx, {
    text: `${params.eyebrow || '未命名指标'} / 02`,
    x: CONTENT_X,
    y: 198 + state.eyebrow.y,
    font: `650 20px ${resources.monoFont}`,
    color: CANVAS_COLORS.accentBlue,
    maxWidth: 760,
    alpha: state.eyebrow.opacity,
  })

  ctx.save()
  ctx.globalAlpha = state.value.opacity
  ctx.translate(CONTENT_X + 320, 430)
  ctx.scale(state.value.scale, state.value.scale)
  ctx.translate(-(CONTENT_X + 320), -430)
  ctx.filter = state.value.scale < 0.99 ? 'blur(4px)' : 'none'
  drawText(ctx, {
    text: params.prefix,
    x: CONTENT_X,
    y: 352,
    font: `600 44px ${resources.displayFont}`,
    color: CANVAS_COLORS.accentBlue,
    maxWidth: 64,
  })
  drawText(ctx, {
    text: state.number,
    x: CONTENT_X + 54,
    y: 302,
    font: `680 176px ${resources.displayFont}`,
    color: CANVAS_COLORS.paper,
    maxWidth: 540,
  })
  drawText(ctx, {
    text: params.suffix,
    x: CONTENT_X + 605,
    y: 372,
    font: `600 42px ${resources.displayFont}`,
    color: CANVAS_COLORS.accentBlue,
    maxWidth: 80,
  })
  ctx.restore()

  const axisReveal = state.pencilLine.reveal
  const accentEnd = CONTENT_X + 365
  drawPencilLine(ctx, {
    x1: CONTENT_X,
    y1: 570,
    x2: CONTENT_X + (accentEnd - CONTENT_X) * axisReveal,
    y2: 570,
    color: CANVAS_COLORS.accentBlue,
    width: 4,
  })
  drawPencilLine(ctx, {
    x1: accentEnd,
    y1: 570,
    x2: accentEnd + (AXIS_END - accentEnd) * axisReveal,
    y2: 570,
    color: '#68717c',
    width: 2,
    alpha: 0.72,
  })

  const visibleTicks = Math.ceil(11 * state.ticks.reveal)
  for (let index = 0; index < visibleTicks; index += 1) {
    const x = CONTENT_X + index * 76
    drawPencilLine(ctx, {
      x1: x,
      y1: 580,
      x2: x,
      y2: 580 + (index % 5 === 0 ? 20 : 11),
      color: CANVAS_COLORS.accentBlue,
      alpha: index < 6 ? 0.9 : 0.42,
      width: index % 5 === 0 ? 2 : 1,
    })
  }

  drawText(ctx, {
    text: params.description || '暂无说明',
    x: CONTENT_X,
    y: 650 + state.meta.y,
    font: `500 30px ${resources.contentFont}`,
    color: '#c8cdd2',
    maxWidth: 620,
    alpha: state.meta.opacity,
  })
  drawText(ctx, {
    text: params.trend || '趋势稳定',
    x: CONTENT_X,
    y: 704 + state.meta.y,
    font: `550 18px ${resources.monoFont}`,
    color: CANVAS_COLORS.accentBlueMuted,
    maxWidth: 620,
    alpha: state.meta.opacity,
  })
}
