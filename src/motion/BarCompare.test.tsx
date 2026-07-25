import { render, screen } from '@testing-library/react'
import { BarCompare } from './BarCompare'
import type { BarCompareParams } from './types'

const params: BarCompareParams = {
  eyebrow: '04 / DATA COMPARISON',
  title: '季度增长',
  item1Label: 'Q1',
  item1Value: 32,
  item2Label: 'Q2',
  item2Value: 48,
  item3Label: 'Q3',
  item3Value: 67,
  item4Label: 'Q4',
  item4Value: 86,
  suffix: '%',
  focusIndex: '4',
  resultLabel: 'PEAK',
  resultNote: 'Q4 / +18 PT',
  duration: 5.8,
}

describe('BarCompare', () => {
  it('renders four comparable values with a focused peak in safe zones', () => {
    render(<BarCompare params={params} />)

    expect(screen.getByText('季度增长')).toBeInTheDocument()
    expect(screen.getByText('Q1')).toBeInTheDocument()
    expect(screen.getByText('Q4')).toBeInTheDocument()
    expect(screen.getByText('86%')).toBeInTheDocument()
    expect(screen.getAllByTestId('bar-column')).toHaveLength(4)
    expect(screen.getAllByTestId('bar-column')[3]).toHaveAttribute(
      'data-focused',
      'true',
    )
    expect(screen.getByTestId('bar-primary')).toHaveAttribute(
      'data-zone',
      'left-primary',
    )
    expect(screen.getByTestId('bar-primary')).toHaveAttribute(
      'data-pencil-layout',
      'hatched-chart',
    )
    expect(screen.getAllByTestId('bar-column')[3]).toHaveAttribute(
      'data-pencil-weight',
      'heavy',
    )
    expect(
      screen
        .getByTestId('bar-primary')
        .querySelector('[data-handwritten="true"]'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('bar-secondary')).toHaveAttribute(
      'data-zone',
      'right-secondary',
    )
  })
})
