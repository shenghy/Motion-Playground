export const CANVAS_COLORS = {
  /** 白色：描述性文字（标题、正文、注释） */
  paper: '#FFFFFF',
  ink: '#050606',
  /** 白色降透明度：次要文字（眉题、标签、说明） */
  muted: 'rgba(255,255,255,.72)',
  line: 'rgba(255,255,255,.42)',
  /** 深蓝：卡片底板 / 主题色 */
  surface: 'rgba(30,64,175,.88)',
  /** 更深的蓝：底板上的嵌套元素（如步骤方块） */
  surfaceDeep: '#16307A',
  /** 橙色：强调重点（核心数字、关键词、焦点项） */
  accent: '#FF6A00',
  accentMuted: 'rgba(255,106,0,.45)',
  accentFaint: 'rgba(255,106,0,.14)',
} as const

interface GridOptions {
  width: number
  height: number
  step: number
  alpha?: number
  color?: string
}

interface PanelShadowOptions {
  color?: string
  blur?: number
  offsetX?: number
  offsetY?: number
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
  /** 圆角半径；运行环境不支持 roundRect 时自动回退直角 */
  radius?: number
  /** 投影；开启后填充绘制阴影（描边不投影） */
  shadow?: PanelShadowOptions | null
}

interface TextShadowOptions {
  color: string
  blur: number
  offsetX: number
  offsetY: number
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
  shadow?: TextShadowOptions
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

/** 把任意数值收敛到合法的 globalAlpha 区间 [0, 1] */
export function safeAlpha(value = 1) {
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

/** 卡片底板统一圆角半径 */
export const CARD_PANEL_RADIUS = 18

/** 卡片底板统一投影参数（1920×1080 画布） */
export const CARD_PANEL_SHADOW = {
  color: 'rgba(0,0,0,.38)',
  blur: 44,
  offsetX: 0,
  offsetY: 20,
} as const

function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  options: PanelOptions,
) {
  const radius = Math.max(0, options.radius ?? 0)
  const canRound = radius > 0 && typeof ctx.roundRect === 'function'
  ctx.save()
  try {
    ctx.globalAlpha = safeAlpha(options.alpha ?? 1)
    if (options.shadow) {
      ctx.shadowColor = options.shadow.color ?? CARD_PANEL_SHADOW.color
      ctx.shadowBlur = options.shadow.blur ?? CARD_PANEL_SHADOW.blur
      ctx.shadowOffsetX = options.shadow.offsetX ?? CARD_PANEL_SHADOW.offsetX
      ctx.shadowOffsetY = options.shadow.offsetY ?? CARD_PANEL_SHADOW.offsetY
    }
    ctx.fillStyle = options.fill ?? CANVAS_COLORS.surface
    if (canRound) {
      ctx.beginPath()
      ctx.roundRect(options.x, options.y, options.width, options.height, radius)
      ctx.fill()
    } else {
      ctx.fillRect(options.x, options.y, options.width, options.height)
    }
    clearShadow(ctx)
    if (options.stroke !== null) {
      ctx.strokeStyle = options.stroke ?? CANVAS_COLORS.line
      ctx.lineWidth = options.lineWidth ?? 1
      if (canRound) {
        ctx.stroke()
      } else {
        ctx.strokeRect(options.x, options.y, options.width, options.height)
      }
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
    if (options.shadow) {
      ctx.shadowColor = options.shadow.color
      ctx.shadowBlur = options.shadow.blur
      ctx.shadowOffsetX = options.shadow.offsetX
      ctx.shadowOffsetY = options.shadow.offsetY
    }
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
