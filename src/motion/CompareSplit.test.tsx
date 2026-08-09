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
  it('renders one safe card with ordered baseline and result tracks', () => {
    render(<CompareSplit params={params} playbackTime={2.4} />)

    expect(screen.getByText('BEFORE')).toBeInTheDocument()
    expect(screen.getByText('AFTER')).toBeInTheDocument()
    expect(screen.getByText('2.05× IMPROVEMENT')).toBeInTheDocument()
    expect(screen.getByText('03 / 对比研究')).toBeInTheDocument()
    expect(screen.queryByText('双项对比')).not.toBeInTheDocument()
    expect(screen.getByTestId('compare-card')).toHaveAttribute(
      'data-zone',
      'left-primary',
    )
    expect(screen.getByTestId('compare-upper')).toHaveTextContent('BEFORE')
    expect(screen.getByTestId('compare-lower')).toHaveTextContent('AFTER')
    expect(
      screen.getByTestId('compare-upper').compareDocumentPosition(
        screen.getByTestId('compare-lower'),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByTestId('compare-upper')).toHaveAttribute(
      'data-emphasized',
      'false',
    )
    expect(screen.getByTestId('compare-lower')).toHaveAttribute(
      'data-emphasized',
      'true',
    )
    expect(screen.getByTestId('compare-scan')).toBeInTheDocument()
    expect(screen.queryByTestId('compare-pencil-arrow')).not.toBeInTheDocument()
    expect(
      screen.getByTestId('compare-upper').querySelector(
        '.motion-handwriting, [data-handwritten]',
      ),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('compare-result')).toHaveAttribute(
      'data-zone',
      'left-primary',
    )
    expect(screen.getByTestId('compare-result')).toHaveAttribute(
      'data-safe-motion',
      'upward',
    )
  })

  it('maps left emphasis to the upper track without changing order', () => {
    render(
      <CompareSplit
        params={{ ...params, emphasis: 'left', split: 32 }}
        playbackTime={2.4}
      />,
    )

    expect(screen.getByTestId('compare-upper')).toHaveAttribute(
      'data-emphasized',
      'true',
    )
    expect(screen.getByTestId('compare-lower')).toHaveAttribute(
      'data-emphasized',
      'false',
    )
    expect(screen.getByTestId('compare-card')).toHaveStyle({
      '--compare-split': '32%',
    })
  })
})
