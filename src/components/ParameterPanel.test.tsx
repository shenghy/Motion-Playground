import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { ParameterPanel } from './ParameterPanel'
import type { Control } from '../motion/types'

const controls: Control[] = [
  { type: 'number', key: 'value', label: '核心数值', min: 0, max: 999, step: 1 },
  { type: 'text', key: 'label', label: '指标名称', maxLength: 24 },
  {
    type: 'select',
    key: 'align',
    label: '文本对齐',
    options: [
      { label: '左侧', value: 'left' },
      { label: '居中', value: 'center' },
    ],
  },
]

describe('ParameterPanel', () => {
  it('emits clamped parameter changes', () => {
    const onChange = vi.fn()
    render(
      <ParameterPanel
        controls={controls}
        values={{ value: 248, label: 'GROWTH', align: 'left' }}
        onChange={onChange}
        onReset={vi.fn()}
        onReplay={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('核心数值'), { target: { value: '320' } })
    expect(onChange).toHaveBeenCalledWith('value', 320)
  })

  it('exposes reset and replay actions', () => {
    const onReset = vi.fn()
    const onReplay = vi.fn()
    render(
      <ParameterPanel
        controls={controls}
        values={{ value: 248, label: 'GROWTH', align: 'left' }}
        onChange={vi.fn()}
        onReset={onReset}
        onReplay={onReplay}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '恢复默认' }))
    fireEvent.click(screen.getByRole('button', { name: '重新播放' }))
    expect(onReset).toHaveBeenCalledOnce()
    expect(onReplay).toHaveBeenCalledOnce()
  })
})
