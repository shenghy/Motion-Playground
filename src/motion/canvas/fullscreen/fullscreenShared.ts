import { CANVAS_COLORS, drawGrid, drawPanel, drawPencilLine, drawText } from '../../../export/canvas/primitives'
import { sampleOnce } from '../../../export/canvas/timing'
import type { CanvasRenderResources } from '../../../export/canvas/types'
import { delayedProgress, easeOutQuart } from '../../../export/frameMath'
import type { FullscreenParams } from '../../types'

/** 全屏卡片画布规格：铺满 1920×1080，完全盖住视频 */
export const FULLSCREEN_WIDTH = 1920
export const FULLSCREEN_HEIGHT = 1080
/** 内容安全边距 */
export const FULLSCREEN_EDGE = 110
/** 全屏深蓝底（不透明，完全遮住视频） */
export const FULLSCREEN_BASE_COLOR = '#1E40AF'
/** 底上嵌套元素深蓝 */
export const FULLSCREEN_DEEP_COLOR = '#16307A'

const ENTRANCE = 0.8
const EXIT = 0.4
const HOLD = 0.6

export interface FullscreenItemSpec {
  text: string
  note?: string
  /** 思维导图专用：层级 0=一级分支 1=二级 2=三级；缺省视为 0（其他卡片忽略） */
  level: number
}

export interface FullscreenItemPhase {
  spec: FullscreenItemSpec
  index: number
  /** 已上屏（进入过阶段窗口） */
  entered: boolean
  /** 当前句高亮强度 0..1（橙色） */
  active: number
  /** 显示透明度（已讲弱化为 0.72） */
  opacity: number
  /** 入场缩放 0.72..1（弹出感） */
  scale: number
  /** 入场位移进度 0..1（滑入/生长） */
  slide: number
  /** 生长绘制进度 0..1（连线/节点点亮） */
  grow: number
  /** 离场进度 0..1（阶段窗口结束后淡出；弱化保留类卡片忽略） */
  leave: number
  /** 入场原始进度 0..1（未进入=0，已过窗口=1；供弹性/描线等自定义缓动） */
  enter: number
}

export interface FullscreenStage {
  time: number
  duration: number
  items: FullscreenItemPhase[]
  headerOpacity: number
  exitOpacity: number
  progress: number
}

export function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

/**
 * 从扁平参数中提取内容块：item1..itemN 为主文本，item1Note..itemNNote 为可选注释，
 * item1Level..itemNLevel 为可选层级（思维导图专用，0..2，缺省 0）。
 * 与 step-flow 的 step1..stepN 同模式，兼容项目 JSON 校验；空文本自动跳过。
 */
export function parseFullscreenItems(
  params: FullscreenParams,
  count: number,
): FullscreenItemSpec[] {
  const specs: FullscreenItemSpec[] = []
  for (let index = 1; index <= count; index += 1) {
    const text = String(params[`item${index}`] ?? '').trim()
    if (text === '') continue
    const note = String(params[`item${index}Note`] ?? '').trim()
    const rawLevel = Number(params[`item${index}Level`])
    const level = Number.isFinite(rawLevel) ? Math.min(2, Math.max(0, Math.round(rawLevel))) : 0
    specs.push(note === '' ? { text, level } : { text, note, level })
  }
  return specs
}

/**
 * 全屏卡阶段推进引擎：一句话字幕 = 一个动画阶段 = 一个内容块。
 * - 0..ENTRANCE：标题入场
 * - 之后每块一个等长窗口：前段入场动画（弹出/滑入/生长），中段当前句橙色高亮
 * - 讲过的块弱化保留（0.72），未讲的隐藏
 * - 末尾 EXIT 秒整体淡出（配合时间轴 end 平滑退场）
 */
export function getFullscreenStage(
  params: Pick<FullscreenParams, 'duration'>,
  localTime: number,
  items: FullscreenItemSpec[],
): FullscreenStage {
  const duration = clampNumber(
    Number.isFinite(params.duration) ? params.duration : 10,
    3,
    20,
  )
  const time = sampleOnce(localTime, duration)
  const count = Math.max(1, items.length)
  const contentTime = Math.max(0, duration - ENTRANCE - HOLD - EXIT)
  const stageLength = contentTime / count
  const enterSlug = Math.min(0.3, stageLength * 0.35)
  const headerOpacity = easeOutQuart(delayedProgress(time, 0, ENTRANCE))

  const phases: FullscreenItemPhase[] = items.map((spec, index) => {
    const start = ENTRANCE + index * stageLength
    const end = start + stageLength
    let active = 0
    let opacity = 0
    if (time >= end) {
      opacity = 0.72
    } else if (time >= start) {
      const entering = easeOutQuart(delayedProgress(time, start, enterSlug))
      active = entering
      opacity = 0.4 + entering * 0.6
    }
    const entering = clampNumber(delayedProgress(time, start, enterSlug), 0, 1)
    return {
      spec,
      index,
      entered: time >= start,
      active,
      opacity,
      scale: 0.72 + 0.28 * easeOutQuart(entering),
      slide: easeOutQuart(entering),
      grow: easeOutQuart(entering),
      leave: easeOutQuart(delayedProgress(time, end, Math.min(0.35, stageLength * 0.4))),
      enter: entering,
    }
  })

  return {
    time,
    duration,
    items: phases,
    headerOpacity,
    exitOpacity: 1 - easeOutQuart(delayedProgress(time, duration - EXIT, EXIT)),
    progress: clampNumber(time / duration, 0, 1),
  }
}

export type FullscreenBackdropKind =
  | 'grid'
  | 'rings'
  | 'scan'
  | 'checker'
  | 'beam'
  | 'rails'
  | 'flow'
  | 'vignette'

function drawRings(ctx: CanvasRenderingContext2D, time: number) {
  const cycle = 6
  const t = (time % cycle) / cycle
  ctx.save()
  ctx.lineWidth = 2
  for (let index = 0; index < 4; index += 1) {
    const progress = (t + index / 4) % 1
    const radius = 140 + progress * 760
    const alpha = 0.05 * (1 - progress)
    if (alpha <= 0) continue
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`
    ctx.beginPath()
    ctx.arc(960, 540, radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function drawScan(ctx: CanvasRenderingContext2D, time: number) {
  const t = ((time % 5) / 5) * 2.2 - 0.6
  const x = t * 1000
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,.05)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x + 260, 1080)
  ctx.stroke()
  ctx.restore()
}

function drawChecker(ctx: CanvasRenderingContext2D, time: number) {
  const size = 480
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,.018)'
  const offset = Math.floor(time * 4) % 2
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      if ((row + column + offset) % 2 !== 0) continue
      ctx.fillRect(column * size, row * size, size, size)
    }
  }
  ctx.restore()
}

function drawBeam(ctx: CanvasRenderingContext2D, time: number) {
  const sway = Math.sin(time * 0.7) * 26
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,.04)'
  ctx.lineWidth = 2
  for (let index = 0; index < 9; index += 1) {
    const x = 220 + index * 190 + sway
    ctx.beginPath()
    ctx.moveTo(x, 1080)
    ctx.lineTo(x - 120, 380)
    ctx.stroke()
  }
  ctx.restore()
}

function drawRails(ctx: CanvasRenderingContext2D, time: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,.05)'
  ctx.lineWidth = 2
  for (let index = 0; index < 5; index += 1) {
    const y = 220 + index * 160
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(1920, y)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255,255,255,.07)'
  ctx.setLineDash([14, 26])
  ctx.lineDashOffset = -(time * 60)
  ctx.beginPath()
  ctx.moveTo(0, 560)
  ctx.lineTo(1920, 560)
  ctx.stroke()
  ctx.restore()
}

function drawFlow(ctx: CanvasRenderingContext2D, time: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,.06)'
  ctx.lineWidth = 2
  ctx.setLineDash([10, 30])
  for (let index = 0; index < 4; index += 1) {
    const y = 300 + index * 140
    ctx.lineDashOffset = (time * 80 + index * 90) % 40
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(1920, y)
    ctx.stroke()
  }
  ctx.restore()
}

function drawVignette(ctx: CanvasRenderingContext2D, time: number) {
  const pulse = 0.8 + Math.sin(time * 1.6) * 0.2
  const gradient = ctx.createRadialGradient(960, 540, 120, 960, 540, 980 * pulse)
  gradient.addColorStop(0, 'rgba(255,255,255,.10)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.save()
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1920, 1080)
  ctx.restore()
}

/** 全屏卡背景层：不透明深蓝底 + 通用网格 + 专属装饰动画 + 四角括号 */
export function drawFullscreenBackdrop(
  ctx: CanvasRenderingContext2D,
  kind: FullscreenBackdropKind,
  time: number,
  exitOpacity = 1,
) {
  ctx.save()
  try {
    ctx.globalAlpha = exitOpacity
    ctx.fillStyle = FULLSCREEN_BASE_COLOR
    ctx.fillRect(0, 0, FULLSCREEN_WIDTH, FULLSCREEN_HEIGHT)
    drawGrid(ctx, { width: FULLSCREEN_WIDTH, height: FULLSCREEN_HEIGHT, step: 96, alpha: 0.05 })
    if (kind === 'rings') drawRings(ctx, time)
    else if (kind === 'scan') drawScan(ctx, time)
    else if (kind === 'checker') drawChecker(ctx, time)
    else if (kind === 'beam') drawBeam(ctx, time)
    else if (kind === 'rails') drawRails(ctx, time)
    else if (kind === 'flow') drawFlow(ctx, time)
    else if (kind === 'vignette') drawVignette(ctx, time)

    ctx.strokeStyle = 'rgba(255,255,255,.2)'
    ctx.lineWidth = 2
    const inset = 28
    const arm = 26
    const points: Array<[number, number, number, number]> = [
      [inset, inset + arm, inset, inset],
      [inset + arm, inset, inset, inset],
      [FULLSCREEN_WIDTH - inset, inset + arm, FULLSCREEN_WIDTH - inset, inset],
      [FULLSCREEN_WIDTH - inset - arm, inset, FULLSCREEN_WIDTH - inset, inset],
      [inset, FULLSCREEN_HEIGHT - inset - arm, inset, FULLSCREEN_HEIGHT - inset],
      [inset + arm, FULLSCREEN_HEIGHT - inset, inset, FULLSCREEN_HEIGHT - inset],
      [FULLSCREEN_WIDTH - inset, FULLSCREEN_HEIGHT - inset - arm, FULLSCREEN_WIDTH - inset, FULLSCREEN_HEIGHT - inset],
      [FULLSCREEN_WIDTH - inset - arm, FULLSCREEN_HEIGHT - inset, FULLSCREEN_WIDTH - inset, FULLSCREEN_HEIGHT - inset],
    ]
    ctx.beginPath()
    for (const [x1, y1, x2, y2] of points) {
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
    }
    ctx.stroke()
  } finally {
    ctx.restore()
  }
}

/** 全屏卡页眉：橙色眉题 + 白色大字标题（入场时上移淡入） */
export function drawFullscreenHeader(
  ctx: CanvasRenderingContext2D,
  resources: CanvasRenderResources,
  stage: FullscreenStage,
  eyebrow: string,
  title: string,
) {
  const alpha = stage.headerOpacity * stage.exitOpacity
  const lift = (1 - stage.headerOpacity) * 26
  drawText(ctx, {
    text: eyebrow || 'FULLSCREEN CARD',
    x: FULLSCREEN_EDGE,
    y: 82 + lift,
    font: `600 15px ${resources.monoFont}`,
    color: CANVAS_COLORS.accent,
    maxWidth: 1200,
    alpha,
  })
  drawText(ctx, {
    text: title || '未命名全屏卡',
    x: FULLSCREEN_EDGE,
    y: 132 + lift,
    font: `650 54px ${resources.contentFont}`,
    color: CANVAS_COLORS.paper,
    maxWidth: 1700,
    alpha,
  })
  drawPencilLine(ctx, {
    x1: FULLSCREEN_EDGE,
    y1: 222,
    x2: FULLSCREEN_WIDTH - FULLSCREEN_EDGE,
    y2: 222,
    color: 'rgba(255,255,255,.24)',
    width: 2,
    alpha,
  })
}

/** 全屏卡页脚：左侧标识 + 右侧阶段进度 */
export function drawFullscreenFooter(
  ctx: CanvasRenderingContext2D,
  resources: CanvasRenderResources,
  stage: FullscreenStage,
  total: number,
) {
  const alpha = stage.exitOpacity
  const activeIndex = stage.items.findIndex((item) => item.active > 0.5)
  const label = activeIndex >= 0
    ? `${String(activeIndex + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`
    : `${String(total).padStart(2, '0')} 项`
  drawText(ctx, {
    text: 'OVERLAY STUDIO / FULLSCREEN',
    x: FULLSCREEN_EDGE,
    y: 1018,
    font: `500 13px ${resources.monoFont}`,
    color: 'rgba(255,255,255,.5)',
    maxWidth: 800,
    alpha,
  })
  drawText(ctx, {
    text: label,
    x: FULLSCREEN_WIDTH - FULLSCREEN_EDGE,
    y: 1018,
    font: `500 13px ${resources.monoFont}`,
    color: 'rgba(255,255,255,.5)',
    maxWidth: 220,
    align: 'right',
    alpha,
  })
  drawPencilLine(ctx, {
    x1: FULLSCREEN_EDGE,
    y1: 1044,
    x2: FULLSCREEN_WIDTH - FULLSCREEN_EDGE,
    y2: 1044,
    color: 'rgba(255,255,255,.14)',
    width: 1,
    alpha,
  })
}

/** 内容块弱化保留与当前高亮的状态色 */
export function itemEmphasisColor(phase: FullscreenItemPhase) {
  if (phase.active > 0.5) return CANVAS_COLORS.accent
  if (phase.entered) return 'rgba(255,255,255,.62)'
  return 'rgba(255,255,255,.3)'
}

/** 复用 drawPanel 绘制全屏内容小卡（圆角 + 无投影，默认深蓝嵌套色） */
export function drawFullscreenPanel(
  ctx: CanvasRenderingContext2D,
  options: {
    x: number
    y: number
    width: number
    height: number
    fill?: string
    stroke?: string | null
    lineWidth?: number
    radius?: number
    alpha?: number
  },
) {
  drawPanel(ctx, {
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    fill: options.fill ?? FULLSCREEN_DEEP_COLOR,
    stroke: options.stroke,
    lineWidth: options.lineWidth,
    radius: options.radius ?? 18,
    alpha: options.alpha,
  })
}
