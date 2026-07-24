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
  it('locks the metric and its supporting context into the frame', () => {
    render(<MetricFocus params={params} />)

    expect(screen.getByText('QUARTERLY GROWTH')).toBeInTheDocument()
    expect(screen.getByLabelText('核心指标 +248%')).toBeInTheDocument()
    expect(screen.getByText('同比增长')).toBeInTheDocument()
    expect(screen.getByText('↑ 32.4 PT')).toBeInTheDocument()
  })
})
