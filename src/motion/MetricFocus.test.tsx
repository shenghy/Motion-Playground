import { render, screen } from '@testing-library/react'
import { MetricFocus } from './MetricFocus'
import type { MetricFocusParams } from './types'

const params: MetricFocusParams = {
  eyebrow: 'QUARTERLY GROWTH',
  value: 248,
  prefix: '+',
  suffix: '%',
  description: '同比增长',
  trend: '↑ 32.4 PT',
  decimals: 0,
  duration: 1.4,
}

describe('MetricFocus', () => {
  it('renders count-up values from an explicit export time', () => {
    const { rerender } = render(
      <MetricFocus params={params} playbackTime={0} />,
    )

    expect(screen.getByTestId('metric-number')).toHaveTextContent('0')

    rerender(<MetricFocus params={params} playbackTime={2} />)
    expect(screen.getByTestId('metric-number')).toHaveTextContent('248')
  })

  it('locks the metric and its supporting context into the frame', () => {
    render(<MetricFocus params={params} />)

    expect(screen.getByText('QUARTERLY GROWTH')).toBeInTheDocument()
    expect(screen.getByLabelText('核心指标 +248%')).toBeInTheDocument()
    expect(screen.getByText('同比增长')).toBeInTheDocument()
    expect(screen.getByText('↑ 32.4 PT')).toBeInTheDocument()
    expect(screen.getByTestId('metric-primary')).toHaveAttribute(
      'data-zone',
      'left-primary',
    )
    expect(screen.getByTestId('metric-primary')).toHaveAttribute(
      'data-pencil-layout',
      'open-frame',
    )
    expect(screen.getByTestId('metric-pencil-line')).toBeInTheDocument()
    expect(
      screen
        .getByTestId('metric-primary')
        .querySelector('.motion-content-text'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('metric-primary').querySelector(
        '.motion-handwriting, [data-handwritten]',
      ),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('metric-secondary')).toHaveAttribute(
      'data-zone',
      'right-secondary',
    )
  })
})
