import type { CanvasMotionRenderer } from '../../export/canvas/types'
import {
  CANVAS_COLORS,
  drawGrid,
  drawPanel,
  drawPencilLine,
  drawText,
} from '../../export/canvas/primitives'
import type { CompareSplitParams } from '../types'
import { COMPARE_SPLIT_LAYOUT, getCompareSplitTrackLayout } from './compareSplitLayout'
import { getCompareSplitState } from './compareSplitState'

function meterScale(value: number) {
  if (!Number.isFinite(value)) return 0.08
  return Math.max(0.08, Math.min(1, value / 100))
}

function withLetterSpacing(
  ctx: CanvasRenderingContext2D,
  letterSpacing: string,
  draw: () => void,
) {
  ctx.save()
  try {
    ctx.letterSpacing = letterSpacing
    draw()
  } finally {
    ctx.restore()
  }
}

export const renderCompareSplitToCanvas: CanvasMotionRenderer<CompareSplitParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const state = getCompareSplitState(params, localTime)
  const { panel, content, headerDividerY, tracks, conclusionDividerY, conclusionTextY } = COMPARE_SPLIT_LAYOUT
  const trackLayout = getCompareSplitTrackLayout(state.verticalSplit)
  const contentRight = content.x + content.width
  const suffix = params.suffix || '%'

  drawGrid(ctx, { width: resources.width, height: 930, step: 96, alpha: 0.09 })
  drawPanel(ctx, {
    x: panel.x,
    y: panel.y,
    width: panel.width,
    height: panel.height,
    fill: 'rgba(5,6,6,.72)',
    stroke: null,
    alpha: state.panelOpacity,
  })
  drawPencilLine(ctx, {
    x1: panel.x, y1: panel.y, x2: panel.x + panel.width, y2: panel.y,
    color: 'rgba(241,238,229,.32)', alpha: state.panelOpacity,
  })
  drawPencilLine(ctx, {
    x1: panel.x, y1: panel.y, x2: panel.x, y2: panel.y + panel.height,
    color: 'rgba(241,238,229,.28)', width: 2, alpha: state.panelOpacity,
  })

  withLetterSpacing(ctx, '2.9px', () => drawText(ctx, {
    text: '03 / 对比研究',
    x: content.x,
    y: 147,
    font: `500 12px ${resources.monoFont}`,
    color: CANVAS_COLORS.accentBlue,
    maxWidth: content.width,
    alpha: state.headerOpacity,
  }))
  withLetterSpacing(ctx, '1.3px', () => drawText(ctx, {
    text: params.title || '未命名对比',
    x: content.x,
    y: 172,
    font: `650 34px ${resources.contentFont}`,
    color: CANVAS_COLORS.paper,
    maxWidth: content.width,
    alpha: state.headerOpacity,
  }))
  drawPencilLine(ctx, {
    x1: content.x, y1: headerDividerY, x2: contentRight, y2: headerDividerY,
    color: 'rgba(241,238,229,.32)', alpha: state.headerOpacity,
  })
  drawPencilLine(ctx, {
    x1: content.x, y1: headerDividerY + 3, x2: contentRight, y2: headerDividerY + 3,
    color: 'rgba(241,238,229,.18)', alpha: state.headerOpacity,
  })

  const drawTrack = ({
    startY,
    endY,
    index,
    label,
    value,
    rawValue,
    emphasized,
    opacity,
    highlight = 0,
  }: {
    startY: number
    endY: number
    index: string
    label: string
    value: string
    rawValue: number
    emphasized: boolean
    opacity: number
    highlight?: number
  }) => {
    const readingY = startY + Math.min(76, Math.max(62, (endY - startY) * 0.38))
    const meterY = endY - 18
    if (highlight > 0) {
      drawPanel(ctx, {
        x: content.x,
        y: startY,
        width: content.width,
        height: endY - startY,
        fill: `rgba(47,103,178,${highlight * 0.16})`,
        stroke: null,
        alpha: opacity,
      })
    }
    withLetterSpacing(ctx, '1.5px', () => drawText(ctx, {
      text: index,
      x: content.x,
      y: startY + 20,
      font: `500 11px ${resources.monoFont}`,
      color: emphasized ? CANVAS_COLORS.accentBlue : '#737a7f',
      maxWidth: content.width,
      alpha: opacity,
    }))
    withLetterSpacing(ctx, '.8px', () => drawText(ctx, {
      text: label,
      x: content.x,
      y: readingY + 16,
      font: `500 20px ${resources.contentFont}`,
      color: '#9ba1a4',
      maxWidth: 242,
      alpha: opacity,
    }))
    drawText(ctx, {
      text: value,
      x: content.x + 290,
      y: readingY,
      font: `650 70px ${resources.displayFont}`,
      color: emphasized ? CANVAS_COLORS.paper : '#a8adae',
      maxWidth: 190,
      alpha: opacity,
    })
    drawText(ctx, {
      text: suffix,
      x: content.x + 498,
      y: readingY + 46,
      font: `500 22px ${resources.contentFont}`,
      color: emphasized ? CANVAS_COLORS.accentBlue : '#81888c',
      maxWidth: 52,
      alpha: opacity,
    })
    drawPencilLine(ctx, {
      x1: content.x, y1: meterY, x2: contentRight, y2: meterY,
      color: 'rgba(241,238,229,.12)', width: 3, alpha: opacity,
    })
    drawPencilLine(ctx, {
      x1: content.x,
      y1: meterY,
      x2: content.x + content.width * meterScale(rawValue),
      y2: meterY,
      color: emphasized ? CANVAS_COLORS.accentBlue : '#8e9598',
      width: emphasized ? 4 : 3,
      alpha: opacity,
    })
  }

  drawTrack({
    startY: trackLayout.upperY,
    endY: trackLayout.dividerY,
    index: '基准 / 01',
    label: params.leftLabel || '优化前',
    value: state.upperValue,
    rawValue: params.leftValue,
    emphasized: state.emphasis === 'left',
    opacity: state.upperOpacity,
  })

  const scanY = tracks.topY
    + (trackLayout.dividerY - tracks.topY) * state.scanProgress
  drawPencilLine(ctx, {
    x1: content.x, y1: scanY, x2: contentRight, y2: scanY,
    color: CANVAS_COLORS.accentBlue,
    width: 3,
    alpha: state.scanProgress,
  })

  drawTrack({
    startY: trackLayout.lowerY,
    endY: trackLayout.bottomY,
    index: '结果 / 02',
    label: params.rightLabel || '优化后',
    value: state.lowerValue,
    rawValue: params.rightValue,
    emphasized: state.emphasis === 'right',
    opacity: state.lowerOpacity,
    highlight: state.lowerHighlight,
  })

  drawPencilLine(ctx, {
    x1: content.x, y1: conclusionDividerY, x2: contentRight, y2: conclusionDividerY,
    color: CANVAS_COLORS.accentBlueMuted,
    alpha: state.resultOpacity,
  })
  withLetterSpacing(ctx, '1.3px', () => drawText(ctx, {
    text: '结论 / 已锁定',
    x: content.x,
    y: conclusionTextY,
    font: `500 11px ${resources.monoFont}`,
    color: CANVAS_COLORS.accentBlue,
    maxWidth: 126,
    alpha: state.resultOpacity,
  }))
  withLetterSpacing(ctx, '.8px', () => drawText(ctx, {
    text: params.conclusion || '暂无结论',
    x: content.x + 144,
    y: conclusionTextY - 4,
    font: `550 20px ${resources.contentFont}`,
    color: CANVAS_COLORS.paper,
    maxWidth: content.width - 144,
    alpha: state.resultOpacity,
  }))
}
