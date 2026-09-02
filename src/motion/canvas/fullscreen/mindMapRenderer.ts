import { CANVAS_COLORS, drawText } from '../../../export/canvas/primitives'
import { easeOutQuart } from '../../../export/frameMath'
import type { CanvasMotionRenderer } from '../../../export/canvas/types'
import type { FullscreenParams } from '../../types'
import {
  FULLSCREEN_DEEP_COLOR,
  clampNumber,
  drawFullscreenBackdrop,
  drawFullscreenFooter,
  drawFullscreenHeader,
  drawFullscreenPanel,
  getFullscreenStage,
  parseFullscreenItems,
} from './fullscreenShared'
import type { FullscreenItemSpec } from './fullscreenShared'

// ---------- 常量 ----------
const MAX_ITEMS = 10
const CENTER_X = 500
const CENTER_Y = 610
const CENTER_RADIUS = 150

/** 安全区：页眉分隔线 222 / 页脚 1000，左右边距 110 —— 所有节点与文字强制落在其中 */
const CONTENT_TOP = 250
const CONTENT_BOTTOM = 950
const SAFE_RIGHT = 1810
const TEXT_GAP = 36

const LEVEL0_RADIUS = 500
const LEVEL0_MAX_ANGLE = 45
const LEVEL1_STEP_X = 250
const LEVEL2_STEP_X = 200
const LEVEL1_SPACING = 108
const LEVEL2_SPACING = 92

/** 已讲分支的弱化透明度（聚焦式讲解） */
const DIM_ALPHA = 0.4
/** 当前分支祖先链的保留透明度 */
const ANCESTOR_ALPHA = 0.9

// ---------- 树结构 ----------
interface MindNode {
  spec: FullscreenItemSpec
  index: number
  level: number
  parent: MindNode | null
  x: number
  y: number
}

function easeOutBack(progress: number) {
  const overshoot = 1.70158
  const t = progress - 1
  return 1 + (overshoot + 1) * t * t * t + overshoot * t * t
}

/**
 * 树构建：level k 节点挂在最近的前一个 level k-1 节点下；
 * level k 前面没有 level k-1 节点时自动降级（保证每个节点都有可挂的父）。
 * 导出供布局契约测试使用。
 */
export function buildTree(specs: FullscreenItemSpec[]): MindNode[] {
  const nodes: MindNode[] = []
  const lastAtLevel: Array<MindNode | null> = [null, null, null]
  specs.forEach((spec, index) => {
    let level = clampNumber(spec.level, 0, 2)
    if (level > 0 && !lastAtLevel[level - 1]) level = 0
    const parent = level > 0 ? lastAtLevel[level - 1] : null
    const node: MindNode = { spec, index, level, parent, x: 0, y: 0 }
    nodes.push(node)
    lastAtLevel[level] = node
    if (level === 0) {
      lastAtLevel[1] = null
      lastAtLevel[2] = null
    } else if (level === 1) {
      lastAtLevel[2] = null
    }
  })
  return nodes
}

/**
 * 树布局（全部约束在安全区内）：
 * - level 0：从中心圆右侧半扇形展开（±45°，半径 500）
 * - level 1/2：从父节点端点水平向右延伸，兄弟节点垂直错开
 * - 水平方向若超界则从最深层往左压缩，保证文字始终在画布内
 * 导出供布局契约测试使用。
 */
export function layoutTree(nodes: MindNode[]) {
  const roots = nodes.filter((node) => node.level === 0)
  const rootCount = Math.max(1, roots.length)
  roots.forEach((node, index) => {
    // 单根正右展开；多根在 ±45° 半扇形内均匀分布
    const t = rootCount === 1 ? 0.5 : index / (rootCount - 1)
    const angle = (LEVEL0_MAX_ANGLE * 2 * t - LEVEL0_MAX_ANGLE) * (Math.PI / 180)
    node.x = CENTER_X + Math.cos(angle) * LEVEL0_RADIUS
    node.y = clampNumber(
      CENTER_Y + Math.sin(angle) * LEVEL0_RADIUS,
      CONTENT_TOP + 26,
      CONTENT_BOTTOM - 26,
    )
  })

  for (let level = 1; level <= 2; level += 1) {
    const stepX = level === 1 ? LEVEL1_STEP_X : LEVEL2_STEP_X
    const spacing = level === 1 ? LEVEL1_SPACING : LEVEL2_SPACING
    const parents = nodes.filter((node) => node.level === level - 1)
    parents.forEach((parent) => {
      const children = nodes.filter((node) => node.parent === parent)
      const count = children.length
      if (count === 0) return
      const span = Math.min(spacing * (count - 1), CONTENT_BOTTOM - CONTENT_TOP - 40)
      children.forEach((child, index) => {
        const offset = count === 1 ? 0 : (index / (count - 1) - 0.5) * span
        child.x = parent.x + stepX
        child.y = clampNumber(parent.y + offset, CONTENT_TOP + 26, CONTENT_BOTTOM - 26)
      })
    })
  }

  // 水平边界约束：从最深层向左压缩，保证节点 + 文字不出右边界
  const maxNodeX = SAFE_RIGHT - 80
  for (let level = 2; level >= 1; level -= 1) {
    const levelNodes = nodes.filter((node) => node.level === level)
    const overflow = levelNodes.reduce((max, node) => Math.max(max, node.x - maxNodeX), 0)
    if (overflow > 0) {
      levelNodes.forEach((node) => {
        node.x -= overflow
      })
    }
  }
}

function centerEdge(node: MindNode) {
  const dx = node.x - CENTER_X
  const dy = node.y - CENTER_Y
  const distance = Math.hypot(dx, dy) || 1
  return {
    x: CENTER_X + (dx / distance) * CENTER_RADIUS,
    y: CENTER_Y + (dy / distance) * CENTER_RADIUS,
  }
}

/** 二次贝塞尔逐段描线生长（A 方案：线像画笔一样从起点扫到终点） */
function drawGrowingLine(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  grow: number,
  color: string,
  width: number,
  alpha: number,
) {
  const controlX = (from.x + to.x) / 2 + 22
  const controlY = (from.y + to.y) / 2
  const segments = 26
  const count = Math.max(2, Math.ceil(segments * Math.max(0.02, grow)))
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  for (let index = 1; index <= count; index += 1) {
    const t = index / segments
    const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * controlX + t * t * to.x
    const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * controlY + t * t * to.y
    ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()
}

export const renderMindMapToCanvas: CanvasMotionRenderer<FullscreenParams> = ({
  ctx,
  params,
  localTime,
  resources,
}) => {
  const items = parseFullscreenItems(params, MAX_ITEMS)
  const stage = getFullscreenStage(params, localTime, items)
  const exit = stage.exitOpacity
  const at = (alpha: number) => alpha * exit

  drawFullscreenBackdrop(ctx, 'rings', stage.time, exit)
  drawFullscreenHeader(ctx, resources, stage, params.eyebrow, params.title)

  const nodes = buildTree(items)
  layoutTree(nodes)

  const activePhase = stage.items.find((item) => item.active > 0.5) ?? null
  const activeNode = activePhase ? nodes[activePhase.index] : null
  const isAncestorOfActive = (node: MindNode) => {
    let cursor = activeNode
    while (cursor && cursor.parent) {
      if (cursor.parent === node) return true
      cursor = cursor.parent
    }
    return false
  }

  // ---- 中心圆：入场放大 + 新分支出现时微脉冲 ----
  const activeEnter = activePhase ? activePhase.enter : 0
  const pulse = 1 + Math.sin(activeEnter * Math.PI) * 0.03
  const centerR = CENTER_RADIUS * (0.84 + 0.16 * stage.headerOpacity) * pulse
  drawFullscreenPanel(ctx, {
    x: CENTER_X - centerR,
    y: CENTER_Y - centerR,
    width: centerR * 2,
    height: centerR * 2,
    fill: FULLSCREEN_DEEP_COLOR,
    stroke: stage.headerOpacity > 0.5 ? CANVAS_COLORS.accent : 'rgba(255,255,255,.4)',
    lineWidth: 3,
    radius: centerR,
    alpha: at(0.4 + stage.headerOpacity * 0.6),
  })
  drawText(ctx, {
    text: params.title || '主题',
    x: CENTER_X,
    y: CENTER_Y - 24,
    font: `650 28px ${resources.contentFont}`,
    color: CANVAS_COLORS.paper,
    maxWidth: centerR * 2 - 44,
    align: 'center',
    alpha: at(stage.headerOpacity),
  })
  const activeIndex = activePhase ? activePhase.index : -1
  drawText(ctx, {
    text: activeIndex >= 0 ? `${activeIndex + 1} / ${items.length}` : `${items.length} 项`,
    x: CENTER_X,
    y: CENTER_Y + 34,
    font: `500 15px ${resources.monoFont}`,
    color: CANVAS_COLORS.accent,
    maxWidth: centerR * 2 - 44,
    align: 'center',
    alpha: at(stage.headerOpacity),
  })

  // ---- 新分支入场时从中心/父节点扩散脉冲环（A 方案） ----
  if (activePhase && activePhase.enter < 1 && activePhase.enter > 0) {
    const ringCenter = activeNode && activeNode.parent
      ? { x: activeNode.parent.x, y: activeNode.parent.y }
      : activeNode
        ? centerEdge(activeNode)
        : { x: CENTER_X, y: CENTER_Y }
    const ringRadius = 26 + easeOutQuart(activePhase.enter) * 96
    ctx.save()
    ctx.globalAlpha = at((1 - activePhase.enter) * 0.4)
    ctx.strokeStyle = CANVAS_COLORS.accent
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(ringCenter.x, ringCenter.y, ringRadius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // ---- 分支节点：描线生长 → 弹性圆点 → 延迟滑入文字；聚焦弱化 ----
  nodes.forEach((node) => {
    const phase = stage.items[node.index]
    if (!phase.entered) return

    const isActive = activeNode === node
    const isAncestor = isAncestorOfActive(node)
    const color = isActive
      ? CANVAS_COLORS.accent
      : isAncestor
        ? 'rgba(255,255,255,.92)'
        : 'rgba(255,255,255,.48)'
    const alpha = isActive ? 1 : isAncestor ? ANCESTOR_ALPHA : DIM_ALPHA
    const lineWidth = isActive ? 4.5 : 2.6 - node.level * 0.4
    const from = node.parent
      ? { x: node.parent.x, y: node.parent.y }
      : centerEdge(node)

    // 当前分支橙色光晕（B 方案：视线焦点）
    if (isActive) {
      drawGrowingLine(ctx, from, node, phase.grow, 'rgba(255,106,0,.16)', 22, at(alpha))
    }
    drawGrowingLine(ctx, from, node, phase.grow, color, lineWidth, at(alpha))

    // 端点圆点：弹性弹出（A 方案）
    const baseRadius = [12, 9, 7][node.level]
    const pop = easeOutBack(phase.enter)
    const radius = baseRadius * (isActive ? 1.45 : 1) * Math.max(0.25, pop)
    ctx.save()
    ctx.globalAlpha = at(alpha)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // 文字：线长到约 35% 后才开始滑入，与生长节奏错开
    const textProgress = clampNumber((phase.enter - 0.3) / 0.7, 0, 1)
    const textX = node.x + TEXT_GAP + (1 - easeOutQuart(textProgress)) * 46
    const fontSize = [30, 26, 23][node.level]
    const maxWidth = Math.max(120, SAFE_RIGHT - TEXT_GAP - node.x)
    const textColor = isActive
      ? CANVAS_COLORS.accent
      : isAncestor
        ? CANVAS_COLORS.paper
        : 'rgba(255,255,255,.55)'
    drawText(ctx, {
      text: node.spec.text,
      x: textX,
      y: node.y - 14,
      font: `600 ${fontSize}px ${resources.contentFont}`,
      color: textColor,
      maxWidth,
      alpha: at(alpha),
    })
    if (node.spec.note) {
      drawText(ctx, {
        text: node.spec.note,
        x: textX,
        y: node.y + 26,
        font: `500 17px ${resources.monoFont}`,
        color: 'rgba(255,255,255,.5)',
        maxWidth,
        alpha: at(alpha),
      })
    }
  })

  drawFullscreenFooter(ctx, resources, stage, items.length)
}
