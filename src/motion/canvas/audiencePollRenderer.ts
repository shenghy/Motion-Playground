import type { CanvasMotionRenderer } from '../../export/canvas/types'
import {
  CANVAS_COLORS,
  drawPanel,
  drawPencilLine,
  drawText,
} from '../../export/canvas/primitives'
import type { AudiencePollParams } from '../types'
import { getAudiencePollState } from './audiencePollState'

export const renderAudiencePollToCanvas: CanvasMotionRenderer<AudiencePollParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const state = getAudiencePollState(params, localTime)

  drawPanel(ctx, {
    x: 122, y: 118, width: 630, height: 736,
    fill: 'rgba(5,6,7,.66)', stroke: 'rgba(241,238,229,.38)',
    alpha: state.panelOpacity,
  })
  drawText(ctx, {
    text: params.eyebrow || '08 / LIVE POLL', x: 146, y: 150 + state.header.y,
    font: `600 15px ${resources.monoFont}`, color: CANVAS_COLORS.accentBlue,
    maxWidth: 560, alpha: state.header.opacity,
  })
  drawText(ctx, {
    text: params.title || '请选择你的答案', x: 146, y: 195 + state.title.y,
    font: `600 38px ${resources.contentFont}`, color: CANVAS_COLORS.paper,
    maxWidth: 560, alpha: state.title.opacity,
  })
  drawPencilLine(ctx, {
    x1: 146, y1: 270, x2: 720, y2: 270,
    color: CANVAS_COLORS.accentBlueMuted, width: 2, alpha: state.title.opacity,
  })

  state.options.forEach((option, index) => {
    const y = 304 + index * 96 + option.y
    drawPanel(ctx, {
      x: 146, y, width: 560, height: 72,
      fill: option.current ? 'rgba(47,103,178,.13)' : 'rgba(5,6,7,.28)',
      stroke: option.current ? CANVAS_COLORS.accentBlue : 'rgba(241,238,229,.28)',
      lineWidth: option.current ? 3 : 1,
      alpha: option.opacity,
    })
    drawText(ctx, {
      text: String(index + 1).padStart(2, '0'), x: 166, y: y + 22,
      font: `600 18px ${resources.monoFont}`,
      color: option.current ? CANVAS_COLORS.accentBlue : CANVAS_COLORS.muted,
      maxWidth: 34, alpha: option.opacity,
    })
    drawText(ctx, {
      text: option.label, x: 220, y: y + 17,
      font: `550 27px ${resources.contentFont}`, color: CANVAS_COLORS.paper,
      maxWidth: 460, alpha: option.opacity,
    })
  })

  const ctaY = 320 + state.options.length * 96
  drawPencilLine(ctx, {
    x1: 146, y1: ctaY, x2: 720, y2: ctaY,
    color: 'rgba(241,238,229,.28)', width: 1, alpha: state.cta.opacity,
  })
  drawText(ctx, {
    text: params.callToAction || '把编号打在弹幕或评论区，告诉我你的选择',
    x: 146, y: ctaY + 22 + state.cta.y,
    font: `450 ${18 * state.cta.scale}px ${resources.contentFont}`,
    color: '#b7bdc2', maxWidth: 560, alpha: state.cta.opacity,
  })
}
