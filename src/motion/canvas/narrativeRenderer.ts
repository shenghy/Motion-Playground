import type { CanvasMotionRenderer } from '../../export/canvas/types'
import {
  CANVAS_COLORS,
  drawPencilLine,
  drawText,
} from '../../export/canvas/primitives'
import type { NarrativeParams } from '../types'
import { getNarrativeState } from './narrativeState'
import { layoutNarrativeExplanation } from './narrativeTextLayout'

const HEADLINE_SHADOW = {
  color: 'rgba(38, 40, 43, 0.8)',
  blur: 10,
  offsetX: 4,
  offsetY: 5,
} as const

export const renderNarrativeToCanvas: CanvasMotionRenderer<NarrativeParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const state = getNarrativeState(params, localTime)
  const line1 = params.line1 || '当前内容'
  const line2 = params.line2 || '正在讲述'
  const explanation = params.explanation || '补充当前视频内容的简短解释。'
  const explanationFont = `400 30px ${resources.monoFont}`
  const explanationLines = layoutNarrativeExplanation(
    ctx,
    explanation,
    explanationFont,
    660,
  )

  drawText(ctx, {
    text: 'NARRATIVE / 01',
    x: 132,
    y: 188,
    font: `600 13px ${resources.monoFont}`,
    color: CANVAS_COLORS.accentBlue,
    maxWidth: 650,
    alpha: state.line1.opacity,
  })
  drawText(ctx, {
    text: line1,
    x: 132,
    y: 250 + state.line1.y,
    font: `650 90px ${resources.displayFont}`,
    color: CANVAS_COLORS.paper,
    maxWidth: 720,
    alpha: state.line1.opacity,
    filter: `blur(${state.line1.blur}px)`,
    shadow: HEADLINE_SHADOW,
  })
  drawText(ctx, {
    text: line2,
    x: 132,
    y: 350 + state.line2.y,
    font: `650 90px ${resources.displayFont}`,
    color: CANVAS_COLORS.paper,
    maxWidth: 720,
    alpha: state.line2.opacity,
    filter: `blur(${state.line2.blur}px)`,
    shadow: HEADLINE_SHADOW,
  })
  drawPencilLine(ctx, {
    x1: 132,
    y1: 474,
    x2: 132 + 130 * state.ruleProgress,
    y2: 474,
    color: CANVAS_COLORS.accentBlue,
    width: 2,
    alpha: state.ruleProgress,
  })
  explanationLines.forEach((text, index) => {
    drawText(ctx, {
      text,
      x: 132,
      y: 510 + state.explanation.y + index * 44,
      font: explanationFont,
      color: CANVAS_COLORS.muted,
      maxWidth: 660,
      alpha: state.explanation.opacity,
    })
  })
}
