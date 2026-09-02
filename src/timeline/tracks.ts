import type { OverlayCard } from './types'

export interface CardRowAssignment {
  /** 每张卡所在轨道行（0 起）；同一行内的卡片时间互不重叠。 */
  rowByCardId: ReadonlyMap<string, number>
  /** 需要的轨道总数。 */
  rowCount: number
}

/**
 * 贪心区间着色：按开始时间升序（同开始按添加顺序）把卡片依次放入
 * 第一个时间上不冲突的行，找不到空闲行时新开一行。
 *
 * 结果保证同一时刻的所有卡片分别位于不同轨道行——时间轴可纵向
 * 叠加显示与操作，例如局部卡铺底的同时在另一行插入全屏卡。
 */
export function assignCardRows(cards: OverlayCard[]): CardRowAssignment {
  const ordered = cards
    .map((card, order) => ({ card, order }))
    .sort(
      (left, right) =>
        left.card.start - right.card.start || left.order - right.order,
    )

  const rows: Array<{ end: number }> = []
  const rowByCardId = new Map<string, number>()

  for (const { card } of ordered) {
    const epsilon = 1e-9
    let rowIndex = rows.findIndex((row) => row.end <= card.start + epsilon)

    if (rowIndex === -1) {
      rowIndex = rows.length
      rows.push({ end: card.end })
    } else {
      rows[rowIndex].end = Math.max(rows[rowIndex].end, card.end)
    }

    rowByCardId.set(card.id, rowIndex)
  }

  return { rowByCardId, rowCount: rows.length }
}
