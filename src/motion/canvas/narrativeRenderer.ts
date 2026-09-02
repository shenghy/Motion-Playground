import type { CanvasMotionRenderer } from '../../export/canvas/types'
import {
  CANVAS_COLORS,
  CARD_PANEL_RADIUS,
  drawPanel,
  drawPencilLine,
  drawText,
  safeAlpha,
} from '../../export/canvas/primitives'
import type { NarrativeParams } from '../types'
import { getNarrativeState } from './narrativeState'
import {
  layoutNarrativeExplanation,
  parseNarrativeKeywords,
  splitNarrativeKeywords,
} from './narrativeTextLayout'

interface TextShadowOptions {
  color: string
  blur: number
  offsetX: number
  offsetY: number
}

const HEADLINE_SHADOW: TextShadowOptions = {
  color: 'rgba(38, 40, 43, 0.8)',
  blur: 10,
  offsetX: 4,
  offsetY: 5,
}

const EXPLANATION_SHADOW: TextShadowOptions = {
  color: 'rgba(38, 40, 43, 0.8)',
  blur: 6,
  offsetX: 2,
  offsetY: 3,
}

const HEADLINE_FIRST_Y = 240
const HEADLINE_LINE_HEIGHT = 120
const NARRATIVE_PANEL = { x: 96, y: 150, width: 776, height: 492 } as const

interface KeywordTextOptions {
  text: string
  keywords: string[]
  x: number
  y: number
  font: string
  color: string
  maxWidth: number
  alpha?: number
  filter?: string
  shadow?: TextShadowOptions
}

/** 整行文字按关键词分段绘制，命中片段用橙色高亮 */
function drawTextWithKeywords(
  ctx: CanvasRenderingContext2D,
  options: KeywordTextOptions,
) {
  const segments = splitNarrativeKeywords(options.text, options.keywords)
  ctx.save()
  try {
    ctx.globalAlpha = safeAlpha(options.alpha ?? 1)
    ctx.textAlign = 'start'
    ctx.textBaseline = 'top'
    ctx.filter = options.filter ?? 'none'
    if (options.shadow) {
      ctx.shadowColor = options.shadow.color
      ctx.shadowBlur = options.shadow.blur
      ctx.shadowOffsetX = options.shadow.offsetX
      ctx.shadowOffsetY = options.shadow.offsetY
    }
    ctx.font = options.font
    const measured = ctx.measureText(options.text).width
    if (measured > options.maxWidth && measured > 0) {
      const match = options.font.match(/(\d+(?:\.\d+)?)px/)
      if (match) {
        const size = Number(match[1])
        const nextSize = Math.max(1, size * (options.maxWidth / measured))
        ctx.font = options.font.replace(match[0], `${nextSize}px`)
      }
    }
    let cursorX = options.x
    for (const segment of segments) {
      ctx.fillStyle = segment.highlighted
        ? CANVAS_COLORS.accent
        : options.color
      ctx.fillText(segment.text, cursorX, options.y)
      cursorX += ctx.measureText(segment.text).width
    }
  } finally {
    ctx.restore()
  }
}

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
  const keywords = parseNarrativeKeywords(params.keywords)
  const explanationFont = `400 30px ${resources.monoFont}`
  const explanationLines = layoutNarrativeExplanation(
    ctx,
    explanation,
    explanationFont,
    660,
  )

  drawPanel(ctx, { ...NARRATIVE_PANEL, fill: CANVAS_COLORS.surface, stroke: null, alpha: state.line1.opacity, radius: CARD_PANEL_RADIUS, shadow: {} })

  drawText(ctx, {
    text: 'NARRATIVE / 01',
    x: 132,
    y: 188,
    font: `600 13px ${resources.monoFont}`,
    color: CANVAS_COLORS.muted,
    maxWidth: 650,
    alpha: state.line1.opacity,
  })
  drawTextWithKeywords(ctx, {
    text: line1,
    keywords,
    x: 132,
    y: HEADLINE_FIRST_Y + state.line1.y,
    font: `650 90px ${resources.displayFont}`,
    color: CANVAS_COLORS.paper,
    maxWidth: 720,
    alpha: state.line1.opacity,
    filter: `blur(${state.line1.blur}px)`,
    shadow: HEADLINE_SHADOW,
  })
  drawTextWithKeywords(ctx, {
    text: line2,
    keywords,
    x: 132,
    y: HEADLINE_FIRST_Y + HEADLINE_LINE_HEIGHT + state.line2.y,
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
    color: CANVAS_COLORS.accent,
    width: 2,
    alpha: state.ruleProgress,
  })
  explanationLines.forEach((text, index) => {
    drawTextWithKeywords(ctx, {
      text,
      keywords,
      x: 132,
      y: 510 + state.explanation.y + index * 44,
      font: explanationFont,
      color: CANVAS_COLORS.paper,
      maxWidth: 660,
      alpha: state.explanation.opacity,
      shadow: EXPLANATION_SHADOW,
    })
  })
}
