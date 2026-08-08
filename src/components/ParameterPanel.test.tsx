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

  it('groups properties, transfer tools, and workspace actions into tabs', () => {
    render(
      <ParameterPanel
        controls={controls}
        values={{ value: 248, label: 'GROWTH', align: 'left' }}
        onChange={vi.fn()}
        onReset={vi.fn()}
        onReplay={vi.fn()}
        onToggleSafeArea={vi.fn()}
        onVideoFile={vi.fn()}
        project={{
          version: 1,
          canvas: { width: 1920, height: 1080 },
          cards: [],
        }}
        onProjectImport={vi.fn()}
        onClearWorkspace={vi.fn()}
        exportControls={<section aria-label="透明动效导出">导出工具</section>}
      />,
    )

    expect(screen.getByRole('tab', { name: '卡片属性' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tabpanel', { name: '卡片属性' })).toBeVisible()
    expect(screen.getByLabelText('核心数值')).toBeInTheDocument()
    expect(screen.getByTestId('parameter-panel-transfer')).not.toBeVisible()

    fireEvent.click(screen.getByRole('tab', { name: '导入导出' }))
    expect(screen.getByRole('tabpanel', { name: '导入导出' })).toBeVisible()
    expect(screen.getByLabelText('透明动效导出')).toBeInTheDocument()
    expect(screen.getByLabelText('项目文件')).toBeInTheDocument()
    expect(screen.getByLabelText('视频背景')).toBeInTheDocument()
    expect(screen.getByTestId('parameter-panel-properties')).not.toBeVisible()

    fireEvent.click(screen.getByRole('tab', { name: '工作区' }))
    expect(screen.getByRole('tabpanel', { name: '工作区' })).toBeVisible()
    expect(screen.getByLabelText('工作区管理')).toBeInTheDocument()
    expect(screen.getByTestId('parameter-panel-transfer')).not.toBeVisible()
  })

  it('supports arrow-key navigation across parameter tabs', () => {
    render(
      <ParameterPanel
        controls={controls}
        values={{ value: 248, label: 'GROWTH', align: 'left' }}
        onChange={vi.fn()}
        onReset={vi.fn()}
        onReplay={vi.fn()}
      />,
    )

    const propertiesTab = screen.getByRole('tab', { name: '卡片属性' })
    propertiesTab.focus()
    fireEvent.keyDown(propertiesTab, { key: 'ArrowRight' })

    expect(screen.getByRole('tab', { name: '导入导出' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: '导入导出' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})
