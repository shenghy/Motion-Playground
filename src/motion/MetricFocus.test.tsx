import { render, screen, waitFor, within } from '@testing-library/react'
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
  it('renders count-up values from an explicit export time', async () => {
    const { rerender } = render(
      <MetricFocus params={params} playbackTime={0} />,
    )

    expect(screen.getByTestId('metric-number')).toHaveTextContent('0')
    expect(screen.getByTestId('metric-single-bar')).toHaveStyle({ transform: 'scaleY(0)' })

    rerender(<MetricFocus params={params} playbackTime={2} />)
    expect(screen.getByTestId('metric-number')).toHaveTextContent('248')
    await waitFor(() => {
      expect(screen.getByTestId('metric-single-bar')).not.toHaveStyle({ transform: 'scaleY(0)' })
    })
  })

  it('locks the metric and its supporting context into the frame', () => {
    render(<MetricFocus params={params} />)

    expect(screen.getByText('QUARTERLY GROWTH / 02')).toBeInTheDocument()
    expect(screen.getByLabelText('核心指标 +248%')).toBeInTheDocument()
    expect(screen.getByText('同比增长')).toBeInTheDocument()
    expect(screen.getByText('↑ 32.4 PT')).toBeInTheDocument()
    expect(screen.getByTestId('metric-primary')).toHaveAttribute(
      'data-zone',
      'left-primary',
    )
    expect(screen.getByTestId('metric-primary')).toHaveAttribute(
      'data-metric-layout',
      'data-rail',
    )
    const rail = screen.getByTestId('metric-value-rail')
    expect(within(rail).getByTestId('metric-number')).toHaveTextContent('248')
    expect(within(rail).getByText('%')).toBeInTheDocument()
    expect(within(rail).getAllByTestId('metric-single-bar')).toHaveLength(1)
    expect(screen.queryByTestId('metric-axis')).not.toBeInTheDocument()
    expect(screen.queryByTestId('metric-ticks')).not.toBeInTheDocument()
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
    expect(screen.queryByTestId('metric-secondary')).not.toBeInTheDocument()
    expect(screen.queryByText('画面 001')).not.toBeInTheDocument()
  })

  it('shrinks and clips the value group before it can cross the safe boundary', () => {
    render(
      <MetricFocus
        params={{
          ...params,
          value: 999,
          decimals: 2,
          prefix: '约为',
          suffix: '名员工',
        }}
        playbackTime={2}
      />,
    )

    expect(screen.getByTestId('metric-value')).toHaveStyle({
      flex: '0 1 auto',
      '--metric-number-size': '4.26cqw',
      '--metric-affix-size': '1.1cqw',
    })
    expect(screen.getByTestId('metric-value')).not.toHaveStyle({
      overflow: 'hidden',
    })
  })
})
