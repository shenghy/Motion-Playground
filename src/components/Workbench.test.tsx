import { fireEvent, render, screen } from '@testing-library/react'
import { Workbench } from './Workbench'

describe('Workbench', () => {
  it('opens MetricFocus and switches between all registered motions', () => {
    render(<Workbench />)

    expect(screen.getByRole('button', { name: /MetricFocus/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('1920 × 1080')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /CompareSplit/ }))
    expect(screen.getByText('2.05× IMPROVEMENT')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /ProfileReveal/ }))
    expect(screen.getByText('公开构建者')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /QuoteLockup/ })).not.toBeInTheDocument()

    expect(
      screen.getAllByRole('button', {
        name: /MetricFocus|CompareSplit|ProfileReveal|BarCompare|ShareRing|StepFlow/,
      }),
    ).toHaveLength(6)

    fireEvent.click(screen.getByRole('button', { name: /BarCompare/ }))
    expect(screen.getByText('季度增长')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /ShareRing/ }))
    expect(screen.getByText('用户构成')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /StepFlow/ }))
    expect(screen.getByText('发布流程')).toBeInTheDocument()
  })

  it('applies live changes and restarts playback', () => {
    render(<Workbench />)
    const stage = screen.getByTestId('preview-stage')
    const initialKey = stage.dataset.playbackKey

    fireEvent.change(screen.getByLabelText('核心数值'), { target: { value: '320' } })
    expect(screen.getByLabelText('核心指标 +320%')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重新播放' }))
    expect(stage.dataset.playbackKey).not.toBe(initialKey)

    fireEvent.click(screen.getByRole('button', { name: '恢复默认' }))
    expect(screen.getByLabelText('核心指标 +248%')).toBeInTheDocument()
  })

  it('shows the presenter background and lets the safety guide be hidden', () => {
    render(<Workbench />)

    expect(
      screen.getByRole('img', { name: '口播人物参考背景' }),
    ).toHaveAttribute('src', '/reference-standing.png')
    expect(screen.getByTestId('presenter-safe-area')).toBeInTheDocument()
    expect(screen.getByTestId('subtitle-safe-area')).toHaveTextContent(
      'SUBTITLE SAFE / 150PX',
    )

    const toggle = screen.getByRole('switch', { name: '显示人物安全区' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(toggle)

    expect(screen.queryByTestId('presenter-safe-area')).not.toBeInTheDocument()
    expect(screen.queryByTestId('subtitle-safe-area')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: '口播人物参考背景' })).toBeInTheDocument()
  })
})
