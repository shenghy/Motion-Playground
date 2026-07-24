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

    fireEvent.click(screen.getByRole('button', { name: /QuoteLockup/ }))
    expect(
      screen.getByText('真正的效率，不是做得更快，而是更少地做错。'),
    ).toBeInTheDocument()
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
})
