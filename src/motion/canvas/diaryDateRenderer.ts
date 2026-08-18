import type { CanvasMotionRenderer } from '../../export/canvas/types'
import {
  CANVAS_COLORS,
  drawPencilLine,
  drawText,
} from '../../export/canvas/primitives'
import type { DiaryDateParams } from '../types'
import { getDiaryDateState } from './diaryDateState'

const HEADLINE_SHADOW = {
  color: 'rgba(38, 40, 43, 0.8)',
  blur: 10,
  offsetX: 4,
  offsetY: 5,
} as const

const NOTE_SHADOW = {
  color: 'rgba(38, 40, 43, 0.8)',
  blur: 6,
  offsetX: 2,
  offsetY: 3,
} as const

const RULE_X = 132
const RULE_Y = 212
const DATE_Y = 330
const NOTE_Y = 424

export const renderDiaryDateToCanvas: CanvasMotionRenderer<DiaryDateParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const state = getDiaryDateState(params, localTime)
  const eyebrow = params.eyebrow || 'AI DIARY / 01'
  const dateText = params.dateText || '2026年1月1日'
  const note = params.note || 'AI 日记 · 第一期'

  drawText(ctx, {
    text: eyebrow,
    x: 132,
    y: 188,
    font: `600 13px ${resources.monoFont}`,
    color: CANVAS_COLORS.accentBlue,
    maxWidth: 650,
    alpha: state.eyebrow.opacity,
  })
  drawPencilLine(ctx, {
    x1: RULE_X,
    y1: RULE_Y,
    x2: RULE_X + 64 * state.ruleProgress,
    y2: RULE_Y,
    color: CANVAS_COLORS.accentBlue,
    width: 3,
    alpha: state.ruleProgress,
  })
  drawText(ctx, {
    text: dateText,
    x: 132,
    y: DATE_Y + state.dateLine.y,
    font: `650 76px ${resources.displayFont}`,
    color: CANVAS_COLORS.paper,
    maxWidth: 720,
    alpha: state.dateLine.opacity,
    filter: `blur(${state.dateLine.blur}px)`,
    shadow: HEADLINE_SHADOW,
  })
  drawText(ctx, {
    text: note,
    x: 132,
    y: NOTE_Y + state.note.y,
    font: `400 30px ${resources.monoFont}`,
    color: CANVAS_COLORS.paper,
    maxWidth: 660,
    alpha: state.note.opacity,
    shadow: NOTE_SHADOW,
  })
}
