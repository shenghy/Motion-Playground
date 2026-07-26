import { act, createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getMotionDefinition } from '../motion/registry'
import type { OverlayCard } from '../timeline/types'
import {
  ExportSurface,
  type ExportSurfaceHandle,
} from './ExportSurface'

function card(
  id: string,
  start: number,
  end: number,
  zIndex: number,
): OverlayCard {
  return {
    id,
    motionId: 'metric-focus',
    start,
    end,
    zIndex,
    position: { x: 12, y: 24 },
    params: { ...getMotionDefinition('metric-focus').defaults },
  }
}

describe('ExportSurface', () => {
  it('renders only active transparent cards in layer order', async () => {
    const ref = createRef<ExportSurfaceHandle>()
    const { container } = render(
      <ExportSurface
        ref={ref}
        cards={[
          card('high', 0, 4, 5),
          card('ended', 0, 1, 0),
          card('low', 1, 5, 1),
        ]}
      />,
    )

    await act(() => ref.current!.prepareFrame(2))

    expect(
      screen.getAllByTestId(/^export-card-/).map((node) => node.dataset.cardId),
    ).toEqual(['low', 'high'])
    expect(screen.getByTestId('export-card-low')).toHaveStyle({
      transform: 'translate(12%, 24%)',
      zIndex: '1',
    })
    expect(screen.queryByTestId('export-card-ended')).not.toBeInTheDocument()
    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('.presenter-safe-area')).toBeNull()
    expect(screen.getByTestId('export-surface')).toHaveAttribute(
      'data-background',
      'transparent',
    )
  })
})
