import { render, screen } from '@testing-library/react'
import { ShareRing } from './ShareRing'
import type { ShareRingParams } from './types'

const params: ShareRingParams = {
  eyebrow: '05 / SHARE ANALYSIS',
  title: '用户构成',
  item1Label: '核心用户',
  item1Value: 62,
  item2Label: '成长用户',
  item2Value: 20,
  item3Label: '观察用户',
  item3Value: 12,
  item4Label: '其他',
  item4Value: 6,
  focusIndex: '1',
  centerLabel: 'PRIMARY',
  resultLabel: 'SHARE',
  resultNote: 'DOMINANT / 01',
  duration: 6,
}

describe('ShareRing', () => {
  it('renders a four-part grayscale share analysis in safe zones', () => {
    render(<ShareRing params={params} />)

    expect(screen.getByText('用户构成')).toBeInTheDocument()
    expect(screen.getAllByTestId('share-segment')).toHaveLength(4)
    expect(screen.getByTestId('share-center-value')).toHaveTextContent('62%')
    expect(screen.getByText('核心用户')).toBeInTheDocument()
    expect(screen.getAllByTestId('share-segment')[0]).toHaveAttribute(
      'data-focused',
      'true',
    )
    expect(screen.getByTestId('share-primary')).toHaveAttribute(
      'data-zone',
      'left-primary',
    )
    expect(screen.getByTestId('share-primary')).toHaveAttribute(
      'data-pencil-layout',
      'drawn-ring',
    )
    expect(screen.getAllByTestId('share-segment')[0]).toHaveAttribute(
      'data-pencil-weight',
      'double',
    )
    expect(
      screen
        .getByTestId('share-primary')
        .querySelector('.motion-content-text'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('share-primary').querySelector(
        '.motion-handwriting, [data-handwritten]',
      ),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('share-secondary')).not.toBeInTheDocument()
  })

  it('evenly divides an all-zero set', () => {
    render(
      <ShareRing
        params={{
          ...params,
          item1Value: 0,
          item2Value: 0,
          item3Label: '',
          item4Label: '',
        }}
      />,
    )

    expect(screen.getByTestId('share-center-value')).toHaveTextContent('50%')
    expect(screen.getAllByTestId('share-segment')).toHaveLength(2)
  })
})
