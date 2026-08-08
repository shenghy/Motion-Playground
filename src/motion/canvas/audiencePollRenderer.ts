import type { CanvasMotionRenderer } from '../../export/canvas/types'
import {
  CANVAS_COLORS,
  drawPanel,
  drawPencilLine,
  drawText,
} from '../../export/canvas/primitives'
import type { AudiencePollParams } from '../types'
import { audiencePollLayout, wrapAudiencePollTitle } from './audiencePollLayout'
import { getAudiencePollState } from './audiencePollState'

export const renderAudiencePollToCanvas: CanvasMotionRenderer<AudiencePollParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const state = getAudiencePollState(params, localTime)
  const { panel, content, eyebrow, title, options, cta } = audiencePollLayout

  drawPanel(ctx, {
    x: panel.x, y: panel.y, width: panel.width, height: panel.height,
    fill: 'rgba(5,6,7,.66)', stroke: null,
    alpha: state.panelOpacity,
  })
  drawPencilLine(ctx, {
    x1: panel.x, y1: panel.y, x2: panel.x + panel.width, y2: panel.y,
    color: 'rgba(241,238,229,.38)', width: 1,
    alpha: state.panelOpacity,
  })
  drawPencilLine(ctx, {
    x1: panel.x, y1: panel.y, x2: panel.x, y2: panel.endY,
    color: 'rgba(241,238,229,.38)', width: 2,
    alpha: state.panelOpacity,
  })
  drawText(ctx, {
    text: params.eyebrow || '08 / LIVE POLL',
    x: content.x,
    y: eyebrow.y + state.header.y,
    font: `600 ${eyebrow.fontSize}px ${resources.monoFont}`,
    color: CANVAS_COLORS.accentBlue,
    maxWidth: content.width,
    alpha: state.header.opacity,
  })

  const titleFont = `600 ${title.fontSize}px ${resources.contentFont}`
  const titleLines = wrapAudiencePollTitle(
    ctx,
    params.title || '请选择你的答案',
    titleFont,
  )
  titleLines.forEach((line, index) => drawText(ctx, {
    text: line,
    x: content.x,
    y: title.y + index * title.lineHeight + state.title.y,
    font: titleFont,
    color: CANVAS_COLORS.paper,
    maxWidth: content.width,
    alpha: state.title.opacity,
  }))

  const dividerY = title.y + titleLines.length * title.lineHeight + title.dividerGap
  drawPencilLine(ctx, {
    x1: content.x, y1: dividerY, x2: content.right, y2: dividerY,
    color: CANVAS_COLORS.accentBlueMuted, width: 2, alpha: state.title.opacity,
  })

  state.options.forEach((option, index) => {
    const y = dividerY + options.dividerToFirst
      + index * (options.height + options.gap) + option.y
    drawPanel(ctx, {
      x: content.x, y, width: content.width, height: options.height,
      fill: option.current ? 'rgba(47,103,178,.13)' : 'rgba(5,6,7,.28)',
      stroke: option.current ? CANVAS_COLORS.accentBlue : 'rgba(241,238,229,.28)',
      lineWidth: option.current ? 3 : 1,
      alpha: option.opacity,
    })
    drawText(ctx, {
      text: String(index + 1).padStart(2, '0'),
      x: content.x + options.numberXOffset,
      y: y + 21,
      font: `600 ${options.numberFontSize}px ${resources.monoFont}`,
      color: option.current ? CANVAS_COLORS.accentBlue : CANVAS_COLORS.muted,
      maxWidth: 34,
      alpha: option.opacity,
    })
    drawText(ctx, {
      text: option.label,
      x: content.x + options.labelXOffset,
      y: y + 17,
      font: `550 ${options.labelFontSize}px ${resources.contentFont}`,
      color: CANVAS_COLORS.paper,
      maxWidth: options.labelWidth,
      alpha: option.opacity,
    })
  })

  drawPencilLine(ctx, {
    x1: content.x, y1: cta.separatorY, x2: content.right, y2: cta.separatorY,
    color: 'rgba(241,238,229,.28)', width: 1, alpha: state.cta.opacity,
  })
  const ctaTextY = cta.textY + state.cta.y
  ctx.save()
  try {
    ctx.translate(content.x, ctaTextY)
    ctx.scale(state.cta.scale, state.cta.scale)
    ctx.translate(-content.x, -ctaTextY)
    drawText(ctx, {
      text: params.callToAction || '把编号打在弹幕或评论区，告诉我你的选择',
      x: content.x,
      y: ctaTextY,
      font: `450 ${cta.fontSize}px ${resources.contentFont}`,
      color: '#b7bdc2',
      maxWidth: content.width,
      alpha: state.cta.opacity,
    })
  } finally {
    ctx.restore()
  }
}
