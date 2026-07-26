import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { ComponentRail } from './ComponentRail'

const items = [
  {
    id: 'metric-focus' as const,
    index: '01',
    name: '核心指标',
    category: '数据 / 指标',
    description: '核心数字动效',
  },
  {
    id: 'compare-split' as const,
    index: '02',
    name: '对比卡片',
    category: '双项 / 对比',
    description: '左右对比卡',
  },
]

describe('ComponentRail', () => {
  it('keeps each accessible motion button draggable with a copy payload', () => {
    render(
      <ComponentRail
        items={items}
        activeId="metric-focus"
        onSelect={vi.fn()}
      />,
    )
    const metricButton = screen.getByRole('button', { name: /核心指标/ })
    const compareButton = screen.getByRole('button', { name: /对比卡片/ })
    const setData = vi.fn()
    const dataTransfer = {
      effectAllowed: 'none',
      setData,
    }

    expect(metricButton).toHaveAttribute('draggable', 'true')
    expect(compareButton).toHaveAttribute('draggable', 'true')

    fireEvent.dragStart(compareButton, { dataTransfer })

    expect(setData).toHaveBeenCalledWith(
      'application/x-overlay-motion',
      'compare-split',
    )
    expect(dataTransfer.effectAllowed).toBe('copy')
  })

  it('preserves click selection and pressed-state accessibility', () => {
    const onSelect = vi.fn()
    render(
      <ComponentRail
        items={items}
        activeId="metric-focus"
        onSelect={onSelect}
      />,
    )

    expect(screen.getByRole('button', { name: /核心指标/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: /对比卡片/ }))

    expect(onSelect).toHaveBeenCalledWith('compare-split')
  })
})
