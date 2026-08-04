import { act, createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { getFontEmbedCSS, toBlob } from 'html-to-image'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMotionDefinition } from '../motion/registry'
import type { OverlayCard } from '../timeline/types'
import {
  ExportSurface,
  type ExportSurfaceHandle,
} from './ExportSurface'

vi.mock('html-to-image', () => ({
  getFontEmbedCSS: vi.fn(),
  toBlob: vi.fn(),
}))

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
  beforeEach(() => {
    vi.mocked(getFontEmbedCSS).mockReset()
    vi.mocked(getFontEmbedCSS).mockResolvedValue('embedded-fonts')
    vi.mocked(toBlob).mockReset()
    vi.mocked(toBlob).mockResolvedValue(
      new Blob(['png'], { type: 'image/png' }),
    )
  })

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

  it('reuses embedded font CSS within one capture session', async () => {
    const ref = createRef<ExportSurfaceHandle>()
    render(<ExportSurface ref={ref} cards={[card('card-1', 0, 4, 0)]} />)

    await act(() => ref.current!.beginCaptureSession())
    await act(() => ref.current!.prepareFrame(1))
    await ref.current!.capturePng()
    await ref.current!.capturePng()

    expect(getFontEmbedCSS).toHaveBeenCalledTimes(1)
    expect(toBlob).toHaveBeenCalledTimes(2)
    expect(toBlob).toHaveBeenLastCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ fontEmbedCSS: 'embedded-fonts' }),
    )

    ref.current!.endCaptureSession()
    await act(() => ref.current!.beginCaptureSession())
    expect(getFontEmbedCSS).toHaveBeenCalledTimes(2)
  })

  it('uses one paint boundary to prepare each deterministic frame', async () => {
    const ref = createRef<ExportSurfaceHandle>()
    const animationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(16)
        return 1
      })
    render(<ExportSurface ref={ref} cards={[card('card-1', 0, 4, 0)]} />)

    await act(() => ref.current!.prepareFrame(2))

    expect(animationFrame).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('export-card-card-1')).toHaveAttribute(
      'data-playback-time',
      '2',
    )
    animationFrame.mockRestore()
  })
})
