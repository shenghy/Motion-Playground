import type { CanvasMotionRenderer } from '../../export/canvas/types'
import {
  CANVAS_COLORS,
  drawGrid,
  drawPencilLine,
  drawText,
} from '../../export/canvas/primitives'
import type { MetricFocusParams } from '../types'
import {
  getMetricFocusTypography,
  METRIC_BAR_GAP,
  METRIC_BAR_WIDTH,
  METRIC_CONTENT_X,
  METRIC_PREFIX_GAP,
  METRIC_SAFE_EDGE,
  METRIC_SAFE_RIGHT,
  METRIC_SUFFIX_GAP,
} from '../metricFocusLayout'
import { getMetricFocusState } from './metricFocusState'

const BAR_HEIGHT = 112
const BAR_BOTTOM = 444

function textWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
) {
  ctx.font = font
  return ctx.measureText(text).width
}

export const renderMetricFocusToCanvas: CanvasMotionRenderer<MetricFocusParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const state = getMetricFocusState(params, localTime)

  drawGrid(ctx, {
    width: METRIC_SAFE_EDGE - 0.5,
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
    x: METRIC_CONTENT_X,
    y: 198 + state.eyebrow.y,
    font: `650 20px ${resources.monoFont}`,
    color: CANVAS_COLORS.accentBlue,
    maxWidth: METRIC_SAFE_RIGHT - METRIC_CONTENT_X,
    alpha: state.eyebrow.opacity,
  })

  ctx.save()
  ctx.globalAlpha = state.value.opacity
  ctx.translate(METRIC_CONTENT_X + 250, 380)
  ctx.scale(state.value.scale, state.value.scale)
  ctx.translate(-(METRIC_CONTENT_X + 250), -380)
  ctx.filter = state.value.blur > 0.01
    ? `blur(${state.value.blur}px)`
    : 'none'
  const typography = getMetricFocusTypography(
    params.value.toFixed(params.decimals),
    params.prefix,
    params.suffix,
  )
  const prefixFont = `600 ${typography.affixFontSize}px ${resources.displayFont}`
  const numberFont = `680 ${typography.numberFontSize}px ${resources.displayFont}`
  const suffixFont = `600 ${typography.affixFontSize}px ${resources.displayFont}`
  const baseline = 420
  const prefixWidth = textWidth(ctx, params.prefix, prefixFont)
  const numberX = METRIC_CONTENT_X + (
    params.prefix ? prefixWidth + METRIC_PREFIX_GAP : 0
  )
  const numberWidth = textWidth(ctx, state.number, numberFont)
  const suffixX = numberX + numberWidth + (
    params.suffix ? METRIC_SUFFIX_GAP : 0
  )
  const suffixWidth = textWidth(ctx, params.suffix, suffixFont)
  const barX = suffixX + suffixWidth + METRIC_BAR_GAP
  const valueTextStyle = {
    alpha: state.value.opacity,
    baseline: 'alphabetic' as const,
    filter: state.value.blur > 0.01
      ? `blur(${state.value.blur}px)`
      : 'none',
  }

  drawText(ctx, {
    text: params.prefix,
    x: METRIC_CONTENT_X,
    y: baseline,
    font: prefixFont,
    color: CANVAS_COLORS.accentBlue,
    maxWidth: Math.max(0, numberX - METRIC_CONTENT_X),
    ...valueTextStyle,
  })
  drawText(ctx, {
    text: state.number,
    x: numberX,
    y: baseline,
    font: numberFont,
    color: CANVAS_COLORS.paper,
    maxWidth: Math.max(0, suffixX - numberX),
    ...valueTextStyle,
  })
  drawText(ctx, {
    text: params.suffix,
    x: suffixX,
    y: baseline,
    font: suffixFont,
    color: CANVAS_COLORS.accentBlue,
    maxWidth: Math.max(0, barX - suffixX - 12),
    ...valueTextStyle,
  })
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = CANVAS_COLORS.accentBlue
  ctx.lineWidth = 2
  ctx.strokeRect(barX, BAR_BOTTOM - BAR_HEIGHT, METRIC_BAR_WIDTH, BAR_HEIGHT)
  const visibleHeight = (BAR_HEIGHT - 6) * state.bar.reveal
  ctx.fillStyle = CANVAS_COLORS.accentBlue
  ctx.fillRect(
    barX + 3,
    BAR_BOTTOM - 3 - visibleHeight,
    METRIC_BAR_WIDTH - 6,
    visibleHeight,
  )
  ctx.restore()

  drawPencilLine(ctx, {
    x1: METRIC_CONTENT_X,
    y1: 514,
    x2: METRIC_SAFE_RIGHT - 28,
    y2: 514,
    color: CANVAS_COLORS.accentBlue,
    width: 2,
    alpha: state.pencilLine.reveal,
  })

  drawText(ctx, {
    text: params.description || '暂无说明',
    x: METRIC_CONTENT_X,
    y: 570 + state.meta.y,
    font: `500 30px ${resources.contentFont}`,
    color: '#c8cdd2',
    maxWidth: METRIC_SAFE_RIGHT - METRIC_CONTENT_X,
    alpha: state.meta.opacity,
  })
  drawText(ctx, {
    text: params.trend || '趋势稳定',
    x: METRIC_CONTENT_X,
    y: 616 + state.meta.y,
    font: `550 18px ${resources.monoFont}`,
    color: CANVAS_COLORS.accentBlueMuted,
    maxWidth: METRIC_SAFE_RIGHT - METRIC_CONTENT_X,
    alpha: state.meta.opacity,
  })
}
