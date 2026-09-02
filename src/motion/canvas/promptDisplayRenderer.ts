import type { CanvasMotionRenderer } from '../../export/canvas/types'
import {
  CANVAS_COLORS,
  CARD_PANEL_RADIUS,
  drawPanel,
  drawPencilLine,
  drawText,
} from '../../export/canvas/primitives'
import type { PromptDisplayParams } from '../types'
import { layoutPromptText } from './promptDisplayLayout'
import {
  getPromptDisplayState,
  getPromptScrollOffset,
} from './promptDisplayState'

const PANEL = { x: 78, y: 118, width: 650, height: 780 } as const
const CONTENT = { x: 110, y: 196, width: 580, height: 642 } as const
const BODY_FONT_SIZE = 42
const LINE_HEIGHT = 62
const CONTENT_TOP_PADDING = 8
const BODY_START_Y = CONTENT.y + CONTENT_TOP_PADDING
const VISIBLE_LINES = Math.floor(CONTENT.height / LINE_HEIGHT)

export const renderPromptDisplayToCanvas: CanvasMotionRenderer<PromptDisplayParams> = ({
  ctx,
  params,
  localTime,
  localDuration,
  resources,
}) => {
  const prompt = params.prompt || '请在 JSON 中填写完整 AI 提示词。'
  const bodyFont = `600 ${BODY_FONT_SIZE}px ${resources.monoFont}`
  const layout = layoutPromptText(
    ctx,
    prompt,
    params.keywords || '',
    bodyFont,
    CONTENT.width,
  )
  const state = getPromptDisplayState(
    params,
    localTime,
    localDuration,
    layout.glyphs.length,
  )
  const scrollOffset = getPromptScrollOffset(
    state.localTime,
    state.typingDuration,
    layout.glyphs.length,
    layout.lines.map(({ startRevealIndex }) => startRevealIndex),
    VISIBLE_LINES,
    LINE_HEIGHT,
  )

  drawPanel(ctx, {
    ...PANEL,
    fill: CANVAS_COLORS.surface,
    stroke: null,
    alpha: state.opacity,
    radius: CARD_PANEL_RADIUS,
    shadow: {},
  })
  drawPencilLine(ctx, {
    x1: PANEL.x + CARD_PANEL_RADIUS,
    y1: PANEL.y,
    x2: PANEL.x + PANEL.width - CARD_PANEL_RADIUS,
    y2: PANEL.y,
    color: 'rgba(255,255,255,.3)',
    width: 1,
    alpha: state.opacity,
  })
  drawPencilLine(ctx, {
    x1: PANEL.x,
    y1: PANEL.y + CARD_PANEL_RADIUS,
    x2: PANEL.x,
    y2: PANEL.y + PANEL.height - CARD_PANEL_RADIUS,
    color: CANVAS_COLORS.accent,
    width: 2,
    alpha: state.opacity,
  })
  drawText(ctx, {
    text: params.eyebrow || 'AI PROMPT / 01',
    x: CONTENT.x,
    y: 150 + 8 * (1 - state.entranceProgress),
    font: `600 16px ${resources.monoFont}`,
    color: CANVAS_COLORS.muted,
    maxWidth: CONTENT.width,
    alpha: state.opacity * state.entranceProgress,
  })

  ctx.save()
  try {
    ctx.beginPath()
    ctx.rect(CONTENT.x, CONTENT.y, CONTENT.width, CONTENT.height)
    ctx.clip()
    ctx.translate(0, -scrollOffset)
    ctx.font = bodyFont
    ctx.textAlign = 'start'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = state.opacity

    let cursorX: number = CONTENT.x
    let cursorY: number = BODY_START_Y
    for (let lineIndex = 0; lineIndex < layout.lines.length; lineIndex += 1) {
      const line = layout.lines[lineIndex]
      let x = CONTENT.x
      const y = BODY_START_Y + lineIndex * LINE_HEIGHT
      for (const glyph of line.glyphs) {
        if (glyph.revealIndex >= state.visibleGlyphs) break
        ctx.fillStyle = glyph.highlighted
          ? CANVAS_COLORS.accent
          : CANVAS_COLORS.paper
        ctx.filter = glyph.highlighted
          ? 'drop-shadow(0 0 5px rgba(255,106,0,.55))'
          : 'none'
        ctx.fillText(glyph.text, x, y)
        x += glyph.width
        cursorX = x
        cursorY = y
      }
    }

    if (state.cursorVisible) {
      ctx.filter = 'none'
      ctx.fillStyle = CANVAS_COLORS.accent
      ctx.fillRect(cursorX + 4, cursorY + 4, 3, BODY_FONT_SIZE)
    }
  } finally {
    ctx.restore()
  }
}
