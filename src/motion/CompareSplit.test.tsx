import { render, screen } from '@testing-library/react'
import { CompareSplit } from './CompareSplit'
import type { CompareSplitParams } from './types'

const params: CompareSplitParams = {
  title: 'CONVERSION RATE',
  leftLabel: 'BEFORE',
  leftValue: 42,
  rightLabel: 'AFTER',
  rightValue: 86,
  suffix: '%',
  conclusion: '2.05× IMPROVEMENT',
  emphasis: 'right',
  split: 50,
  duration: 1.5,
}

describe('CompareSplit', () => {
  it('renders both sides and locks emphasis to the selected side', () => {
    render(<CompareSplit params={params} />)

    expect(screen.getByText('BEFORE')).toBeInTheDocument()
    expect(screen.getByText('AFTER')).toBeInTheDocument()
    expect(screen.getByText('2.05× IMPROVEMENT')).toBeInTheDocument()
    expect(screen.getByTestId('compare-left')).toHaveAttribute('data-emphasized', 'false')
    expect(screen.getByTestId('compare-right')).toHaveAttribute('data-emphasized', 'true')
    expect(screen.getByTestId('compare-left')).toHaveAttribute('data-zone', 'left-primary')
    expect(screen.getByTestId('compare-right')).toHaveAttribute(
      'data-zone',
      'right-secondary',
    )
    expect(screen.getByTestId('compare-result')).toHaveAttribute(
      'data-safe-motion',
      'upward',
    )
  })
})
