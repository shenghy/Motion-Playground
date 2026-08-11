import { describe, expect, it, vi } from 'vitest'
import { layoutNarrativeExplanation } from './narrativeTextLayout'

function context(widthPerCharacter: number) {
  return {
    font: '',
    measureText: vi.fn((text: string) => ({
      width: Array.from(text).length * widthPerCharacter,
    })),
  } as unknown as CanvasRenderingContext2D
}

describe('layoutNarrativeExplanation', () => {
  it('keeps short copy on one line', () => {
    expect(layoutNarrativeExplanation(
      context(30),
      '清晰说明',
      '400 30px Mono',
      660,
    )).toEqual(['清晰说明'])
  })

  it('balances long copy across two fitting lines', () => {
    const ctx = context(30)
    const copy = '让系统处理重复步骤人只负责判断与创造让内容更加清楚'
    const lines = layoutNarrativeExplanation(
      ctx,
      copy,
      '400 30px Mono',
      660,
    )

    expect(lines).toHaveLength(2)
    expect(lines.join('')).toBe(copy)
    expect(lines.every((line) => ctx.measureText(line).width <= 660)).toBe(true)
  })
})
