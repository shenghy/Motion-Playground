import { describe, expect, it } from 'vitest'
import type { MotionId, ParameterValues } from '../motion/types'
import type { OverlayCard } from './types'
import { assignCardRows } from './tracks'

function makeCard(
  id: string,
  start: number,
  end: number,
  zIndex = 0,
): OverlayCard {
  return {
    id,
    motionId: 'narrative' as MotionId,
    start,
    end,
    position: { x: 0, y: 0 },
    zIndex,
    params: {} as ParameterValues,
  }
}

function rowOf(assignment: ReturnType<typeof assignCardRows>, id: string) {
  return assignment.rowByCardId.get(id)
}

describe('assignCardRows', () => {
  it('不重叠的卡片共用第一行', () => {
    const assignment = assignCardRows([
      makeCard('a', 0, 2),
      makeCard('b', 2, 4),
      makeCard('c', 5, 8),
    ])

    expect(rowOf(assignment, 'a')).toBe(0)
    expect(rowOf(assignment, 'b')).toBe(0)
    expect(rowOf(assignment, 'c')).toBe(0)
    expect(assignment.rowCount).toBe(1)
  })

  it('完全重叠的卡片各占一行（局部卡 + 全屏卡同时间叠加）', () => {
    const assignment = assignCardRows([
      makeCard('local', 0, 10),
      makeCard('fullscreen', 2, 8),
    ])

    expect(rowOf(assignment, 'local')).toBe(0)
    expect(rowOf(assignment, 'fullscreen')).toBe(1)
    expect(assignment.rowCount).toBe(2)
  })

  it('三卡连环重叠时复用已结束的行', () => {
    const assignment = assignCardRows([
      makeCard('a', 0, 5),
      makeCard('b', 2, 7),
      makeCard('c', 5.5, 9),
    ])

    // c 在 a 结束后开始，可回到第 0 行
    expect(rowOf(assignment, 'a')).toBe(0)
    expect(rowOf(assignment, 'b')).toBe(1)
    expect(rowOf(assignment, 'c')).toBe(0)
    expect(assignment.rowCount).toBe(2)
  })

  it('多张卡同时点对点重叠时逐行铺开', () => {
    const assignment = assignCardRows([
      makeCard('a', 1, 3),
      makeCard('b', 1, 3),
      makeCard('c', 1, 3),
      makeCard('d', 4, 6),
    ])

    expect(assignment.rowCount).toBe(3)
    // d 全部结束后复用第一行
    expect(rowOf(assignment, 'd')).toBe(0)
  })

  it('空列表返回零行', () => {
    const assignment = assignCardRows([])
    expect(assignment.rowCount).toBe(0)
    expect(assignment.rowByCardId.size).toBe(0)
  })

  it('恰好相接（end === start）不算重叠，可复用同一行', () => {
    const assignment = assignCardRows([
      makeCard('a', 0, 2),
      makeCard('b', 2, 4),
    ])

    expect(rowOf(assignment, 'b')).toBe(0)
    expect(assignment.rowCount).toBe(1)
  })
})
