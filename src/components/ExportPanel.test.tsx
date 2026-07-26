import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExportPanel } from './ExportPanel'

describe('ExportPanel', () => {
  it('explains why export is unavailable before video and cards exist', () => {
    render(
      <ExportPanel
        canExport={false}
        movAvailable
        status="idle"
        completedFrames={0}
        totalFrames={0}
        onExportPng={vi.fn()}
        onExportMov={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '导出透明 MOV' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '导出 PNG 序列' })).toBeDisabled()
    expect(screen.getByText('请先导入视频并在时间轴添加卡片')).toBeInTheDocument()
  })

  it('shows frame progress and allows cancellation while rendering', () => {
    const onCancel = vi.fn()
    render(
      <ExportPanel
        canExport
        movAvailable
        status="rendering"
        completedFrames={45}
        totalFrames={90}
        onExportPng={vi.fn()}
        onExportMov={vi.fn()}
        onCancel={onCancel}
      />,
    )

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '45')
    fireEvent.click(screen.getByRole('button', { name: '取消导出' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('keeps PNG available when the localhost MOV service is unavailable', () => {
    render(
      <ExportPanel
        canExport
        movAvailable={false}
        status="idle"
        completedFrames={0}
        totalFrames={300}
        onExportPng={vi.fn()}
        onExportMov={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '导出 PNG 序列' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '导出透明 MOV' })).toBeDisabled()
    expect(screen.getByText('请通过桌面启动脚本打开，才能导出 MOV')).toBeInTheDocument()
  })
})
