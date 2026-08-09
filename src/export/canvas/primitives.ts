export const CANVAS_COLORS = {
  paper: '#f1eee5',
  ink: '#050606',
  muted: '#8c9196',
  line: 'rgba(241,238,229,.42)',
  signal: '#b7ccc8',
  accentBlue: '#2f67b2',
  accentBlueMuted: 'rgba(47,103,178,.42)',
} as const

interface GridOptions {
  width: number
  height: number
  step: number
  alpha?: number
  color?: string
}

interface PanelOptions {
  x: number
  y: number
  width: number
  height: number
  alpha?: number
  fill?: string
  stroke?: string | null
  lineWidth?: number
}

interface TextOptions {
  text: string
  x: number
  y: number
  font: string
  color: string
  maxWidth: number
  alpha?: number
  align?: CanvasTextAlign
  baseline?: CanvasTextBaseline
  filter?: string
}

interface PencilLineOptions {
  x1: number
  y1: number
  x2: number
  y2: number
  color?: string
  width?: number
  dash?: number[]
  alpha?: number
}

interface HatchFillOptions {
  x: number
  y: number
  width: number
  height: number
  spacing?: number
  color?: string
  lineWidth?: number
  alpha?: number
}

function safeAlpha(value = 1) {
  if (!Number.isFinite(value)) return 1
  return Math.min(1, Math.max(0, value))
}

export function withAlpha(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  draw: () => void,
) {
  ctx.save()
  try {
    ctx.globalAlpha = safeAlpha(alpha)
    draw()
  } finally {
    ctx.restore()
  }
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  options: GridOptions,
) {
  ctx.save()
  try {
    ctx.globalAlpha = safeAlpha(options.alpha ?? 0.28)
    ctx.strokeStyle = options.color ?? 'rgba(255,255,255,.04)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = options.step; x < options.width; x += options.step) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, options.height)
    }
    for (let y = options.step; y < options.height; y += options.step) {
      ctx.moveTo(0, y)
      ctx.lineTo(options.width, y)
    }
    ctx.stroke()
  } finally {
    ctx.restore()
  }
}

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  options: PanelOptions,
) {
  ctx.save()
  try {
    ctx.globalAlpha = safeAlpha(options.alpha ?? 1)
    ctx.fillStyle = options.fill ?? 'rgba(5,6,7,.72)'
    ctx.fillRect(options.x, options.y, options.width, options.height)
    if (options.stroke !== null) {
      ctx.strokeStyle = options.stroke ?? CANVAS_COLORS.line
      ctx.lineWidth = options.lineWidth ?? 1
      ctx.strokeRect(options.x, options.y, options.width, options.height)
    }
  } finally {
    ctx.restore()
  }
}

function shrinkFontToWidth(
  ctx: CanvasRenderingContext2D,
  font: string,
  text: string,
  maxWidth: number,
) {
  ctx.font = font
  const measured = ctx.measureText(text).width
  if (measured <= maxWidth || measured <= 0) return
  const match = font.match(/(\d+(?:\.\d+)?)px/)
  if (!match) return
  const size = Number(match[1])
  const nextSize = Math.max(1, size * (maxWidth / measured))
  ctx.font = font.replace(match[0], `${nextSize}px`)
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  options: TextOptions,
) {
  ctx.save()
  try {
    ctx.globalAlpha = safeAlpha(options.alpha ?? 1)
    ctx.fillStyle = options.color
    ctx.textAlign = options.align ?? 'start'
    ctx.textBaseline = options.baseline ?? 'top'
    ctx.filter = options.filter ?? 'none'
    shrinkFontToWidth(ctx, options.font, options.text, options.maxWidth)
    ctx.fillText(options.text, options.x, options.y, options.maxWidth)
  } finally {
    ctx.restore()
  }
}

export function drawPencilLine(
  ctx: CanvasRenderingContext2D,
  options: PencilLineOptions,
) {
  ctx.save()
  try {
    ctx.globalAlpha = safeAlpha(options.alpha ?? 1)
    ctx.strokeStyle = options.color ?? CANVAS_COLORS.paper
    ctx.lineWidth = options.width ?? 1
    ctx.setLineDash(options.dash ?? [])
    ctx.beginPath()
    ctx.moveTo(options.x1, options.y1)
    ctx.lineTo(options.x2, options.y2)
    ctx.stroke()
  } finally {
    ctx.restore()
  }
}

export function drawHatchFill(
  ctx: CanvasRenderingContext2D,
  options: HatchFillOptions,
) {
  const spacing = Math.max(2, options.spacing ?? 12)
  ctx.save()
  try {
    ctx.globalAlpha = safeAlpha(options.alpha ?? 0.45)
    ctx.strokeStyle = options.color ?? CANVAS_COLORS.paper
    ctx.lineWidth = options.lineWidth ?? 1
    ctx.beginPath()
    ctx.rect(options.x, options.y, options.width, options.height)
    ctx.clip()
    ctx.beginPath()
    for (
      let offset = -options.height;
      offset < options.width;
      offset += spacing
    ) {
      ctx.moveTo(options.x + offset, options.y + options.height)
      ctx.lineTo(options.x + offset + options.height, options.y)
    }
    ctx.stroke()
  } finally {
    ctx.restore()
  }
}
