import { describe, expect, it } from 'vitest'
import type { FullscreenItemSpec } from './fullscreenShared'
import { buildTree, layoutTree } from './mindMapRenderer'

function spec(text: string, level: number): FullscreenItemSpec {
  return { text, level }
}

/** 布局安全区：与渲染器常量一致（页眉线 222 / 页脚 1000，左右边距 110） */
const SAFE_TOP = 276
const SAFE_BOTTOM = 924
const SAFE_LEFT = 0
const SAFE_RIGHT_X = 1730

function layout(specs: FullscreenItemSpec[]) {
  const nodes = buildTree(specs)
  layoutTree(nodes)
  return nodes
}

describe('mind-map 层级树构建', () => {
  it('单位职级示例：总经理下挂技术部/产品部，技术部下挂前端组/后端组', () => {
    const nodes = buildTree([
      spec('总经理', 0),
      spec('技术部', 1),
      spec('前端组', 2),
      spec('后端组', 2),
      spec('产品部', 1),
      spec('行政部', 0),
    ])
    const [ceo, tech, frontend, backend, product, admin] = nodes
    expect(tech.parent).toBe(ceo)
    expect(product.parent).toBe(ceo)
    expect(frontend.parent).toBe(tech)
    expect(backend.parent).toBe(tech)
    expect(admin.parent).toBeNull()
    // 新一级分支出现后，旧一级不再作为后续节点的父
    expect(admin.parent).toBeNull()
  })

  it('首个节点层级非法（无父可挂）时自动降级为一级', () => {
    const nodes = buildTree([
      spec('前端组', 2),
      spec('技术部', 0),
    ])
    expect(nodes[0].level).toBe(0)
    expect(nodes[0].parent).toBeNull()
    expect(nodes[1].parent).toBeNull()
  })

  it('层级超范围被 clamp 到 2；无父可挂的层级降级为一级', () => {
    // 有 level 1 父时，level 5 clamp 为 2 并挂到最近一级分支下
    const nodes = buildTree([
      spec('A', 0),
      spec('A1', 1),
      spec('B', 5),
    ])
    expect(nodes[2].level).toBe(2)
    expect(nodes[2].parent).toBe(nodes[1])
    // 无 level 1 父时，level 2 降级为一级
    const degraded = buildTree([spec('A', 0), spec('B', 2)])
    expect(degraded[1].level).toBe(0)
    expect(degraded[1].parent).toBeNull()
  })
})

describe('mind-map 布局边界约束', () => {
  it('纯一级 6 分支全部落在安全区内（不超出 1920×1080 视频界面）', () => {
    const nodes = layout([
      spec('一', 0), spec('二', 0), spec('三', 0),
      spec('四', 0), spec('五', 0), spec('六', 0),
    ])
    nodes.forEach((node) => {
      expect(node.y).toBeGreaterThanOrEqual(SAFE_TOP)
      expect(node.y).toBeLessThanOrEqual(SAFE_BOTTOM)
      expect(node.x).toBeGreaterThanOrEqual(SAFE_LEFT)
      expect(node.x).toBeLessThanOrEqual(SAFE_RIGHT_X)
    })
  })

  it('单位职级树（6 节点三层）全部落在安全区内', () => {
    const nodes = layout([
      spec('总经理', 0),
      spec('技术部', 1),
      spec('前端组', 2),
      spec('后端组', 2),
      spec('产品部', 1),
      spec('行政部', 0),
    ])
    nodes.forEach((node) => {
      expect(node.y).toBeGreaterThanOrEqual(SAFE_TOP)
      expect(node.y).toBeLessThanOrEqual(SAFE_BOTTOM)
      expect(node.x).toBeLessThanOrEqual(SAFE_RIGHT_X)
    })
    // 子节点在父节点右侧，树向右展开
    const tech = nodes[1]
    const frontend = nodes[2]
    expect(frontend.x).toBeGreaterThan(tech.x)
  })

  it('满 10 节点多层深树不超界（最右节点仍有文字空间）', () => {
    const nodes = layout([
      spec('A', 0),
      spec('A1', 1), spec('A1a', 2), spec('A1b', 2), spec('A1c', 2),
      spec('A2', 1), spec('A2a', 2), spec('A2b', 2),
      spec('B', 0), spec('B1', 1),
    ])
    nodes.forEach((node) => {
      expect(node.y).toBeGreaterThanOrEqual(SAFE_TOP)
      expect(node.y).toBeLessThanOrEqual(SAFE_BOTTOM)
      expect(node.x).toBeLessThanOrEqual(SAFE_RIGHT_X)
    })
  })

  it('单根多子（1 个一级 + 9 个二级）垂直错开不重叠且不超界', () => {
    const specs = [spec('总经理', 0)]
    for (let index = 0; index < 9; index += 1) specs.push(spec(`部门${index + 1}`, 1))
    const nodes = layout(specs)
    nodes.forEach((node) => {
      expect(node.y).toBeGreaterThanOrEqual(SAFE_TOP)
      expect(node.y).toBeLessThanOrEqual(SAFE_BOTTOM)
      expect(node.x).toBeLessThanOrEqual(SAFE_RIGHT_X)
    })
    const ys = nodes.slice(1).map((node) => node.y)
    expect(new Set(ys).size).toBe(9)
  })
})
