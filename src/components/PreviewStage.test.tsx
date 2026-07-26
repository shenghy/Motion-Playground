import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { getMotionDefinition } from '../motion/registry'
import type { MotionId } from '../motion/types'
import type { OverlayCard } from '../timeline/types'
import { PreviewStage } from './PreviewStage'

function makeCard(
  id: string,
  motionId: MotionId,
  start: number,
  end: number,
  zIndex: number,
  position = { x: 20, y: 30 },
): OverlayCard {
  return {
    id,
    motionId,
    start,
    end,
    position,
    zIndex,
    params: { ...getMotionDefinition(motionId).defaults },
  }
}

function createProps(
  overrides: Partial<React.ComponentProps<typeof PreviewStage>> = {},
) {
  const definition = getMotionDefinition('metric-focus')
  return {
    motionId: definition.id,
    motionName: definition.name,
    params: definition.defaults,
    playbackKey: 0,
    showSafeArea: true,
    ...overrides,
  }
}

function mockStageRect(stage: HTMLElement, width = 960, height = 540) {
  vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({
    x: 100,
    y: 50,
    left: 100,
    top: 50,
    right: 100 + width,
    bottom: 50 + height,
    width,
    height,
    toJSON: () => ({}),
  })
}

function firePointer(
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel' | 'lostpointercapture',
  pointerId: number,
  clientX: number,
  clientY: number,
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
    clientY: { value: clientY },
  })
  fireEvent(target, event)
}

describe('PreviewStage overlays', () => {
  it('reports finite media time and duration and exposes a clamped seek controller', () => {
    const onMediaTimeChange = vi.fn()
    const onMediaDurationChange = vi.fn()
    const onSeekControllerReady = vi.fn()
    const { unmount } = render(
      <PreviewStage
        {...createProps({
          videoUrl: 'blob:preview',
          onMediaTimeChange,
          onMediaDurationChange,
          onSeekControllerReady,
        })}
      />,
    )
    const video = screen.getByTestId('presenter-video') as HTMLVideoElement
    Object.defineProperty(video, 'duration', {
      configurable: true,
      value: 120,
    })
    video.currentTime = 12.5

    fireEvent.loadedMetadata(video)
    fireEvent.durationChange(video)
    fireEvent.timeUpdate(video)
    video.currentTime = 14
    fireEvent.seeking(video)

    expect(onMediaDurationChange).toHaveBeenCalledWith(120)
    expect(onMediaTimeChange).toHaveBeenCalledWith(12.5)
    expect(onMediaTimeChange).toHaveBeenCalledWith(14)

    const seek = onSeekControllerReady.mock.calls[0][0] as (time: number) => void
    seek(200)
    expect(video.currentTime).toBe(120)
    seek(-10)
    expect(video.currentTime).toBe(0)

    unmount()
    expect(onSeekControllerReady).toHaveBeenLastCalledWith(null)
  })

  it('keeps the same video element while overlay props change', () => {
    const firstCard = makeCard('first', 'metric-focus', 0, 4, 0)
    const { rerender } = render(
      <PreviewStage
        {...createProps({
          videoUrl: 'blob:stable',
          overlayCards: [firstCard],
          currentTime: 1,
        })}
      />,
    )
    const video = screen.getByTestId('presenter-video')

    rerender(
      <PreviewStage
        {...createProps({
          videoUrl: 'blob:stable',
          overlayCards: [
            firstCard,
            makeCard('second', 'compare-split', 2, 6, 1),
          ],
          selectedCardId: 'first',
          currentTime: 3,
        })}
      />,
    )

    expect(screen.getByTestId('presenter-video')).toBe(video)
  })

  it('renders active cards in z-index order with half-open timing', () => {
    const activeHigh = makeCard('high', 'metric-focus', 0, 2, 5, { x: 0, y: 0 })
    const ended = makeCard('ended', 'profile-reveal', 0, 1, 0)
    const activeLow = makeCard('low', 'compare-split', 1, 3, 1)

    render(
      <PreviewStage
        {...createProps({
          overlayCards: [activeHigh, ended, activeLow],
          currentTime: 1,
        })}
      />,
    )

    const activeOverlays = screen.getAllByTestId(/^overlay-card-/)
    expect(
      activeOverlays.map((element) =>
        element.getAttribute('data-overlay-card-id'),
      ),
    ).toEqual(['low', 'high'])
    expect(activeOverlays[0]).toHaveStyle({
      transform: 'translate(20%, 30%)',
      zIndex: '1',
    })
    expect(activeOverlays[1]).toHaveStyle({
      transform: 'translate(0%, 0%)',
      zIndex: '5',
    })
    expect(activeOverlays[0]).not.toHaveStyle({ left: '20%', top: '30%' })
    expect(screen.queryByTestId('overlay-card-ended')).not.toBeInTheDocument()
  })

  it('uses internal media time for active cards when currentTime is uncontrolled', () => {
    render(
      <PreviewStage
        {...createProps({
          videoUrl: 'blob:internal-time',
          overlayCards: [makeCard('later', 'metric-focus', 1, 3, 0)],
        })}
      />,
    )
    const video = screen.getByTestId('presenter-video') as HTMLVideoElement
    expect(screen.queryByTestId('overlay-card-later')).not.toBeInTheDocument()

    video.currentTime = 1.5
    fireEvent.timeUpdate(video)

    expect(screen.getByTestId('overlay-card-later')).toBeInTheDocument()
  })

  it('preserves the legacy single-motion preview when cards are empty', () => {
    const { container } = render(<PreviewStage {...createProps()} />)

    expect(container.querySelector('.motion-slot')).toBeInTheDocument()
    expect(screen.getByLabelText('核心指标 +248%')).toBeInTheDocument()
    expect(screen.queryByTestId('overlay-card')).not.toBeInTheDocument()
    expect(screen.getByTestId('presenter-safe-area')).toBeInTheDocument()
    expect(screen.getByTestId('subtitle-safe-area')).toBeInTheDocument()
  })

  it('selects an unselected overlay card by click', () => {
    const onSelectOverlayCard = vi.fn()
    render(
      <PreviewStage
        {...createProps({
          overlayCards: [makeCard('select-me', 'metric-focus', 0, 3, 0)],
          selectedCardId: null,
          currentTime: 1,
          onSelectOverlayCard,
        })}
      />,
    )
    const overlay = screen.getByTestId('overlay-card-select-me')

    firePointer(overlay, 'pointerdown', 1, 100, 50)
    firePointer(screen.getByTestId('preview-stage'), 'pointerup', 1, 100, 50)
    fireEvent.click(overlay)

    expect(onSelectOverlayCard).toHaveBeenCalledTimes(1)
    expect(onSelectOverlayCard).toHaveBeenLastCalledWith('select-me')
  })

  it('selects only once for a selected-card pointer and click sequence', () => {
    const onSelectOverlayCard = vi.fn()
    render(
      <PreviewStage
        {...createProps({
          overlayCards: [makeCard('selected', 'metric-focus', 0, 3, 0)],
          selectedCardId: 'selected',
          currentTime: 1,
          onSelectOverlayCard,
        })}
      />,
    )
    const stage = screen.getByTestId('preview-stage')
    const overlay = screen.getByTestId('overlay-card-selected')
    mockStageRect(stage)

    firePointer(overlay, 'pointerdown', 1, 100, 50)
    firePointer(stage, 'pointerup', 1, 100, 50)
    fireEvent.click(overlay)

    expect(onSelectOverlayCard).toHaveBeenCalledTimes(1)
    expect(onSelectOverlayCard).toHaveBeenCalledWith('selected')
  })

  it('drags only the selected card by canvas percentages and clamps output', () => {
    const onCardPositionChange = vi.fn()
    render(
      <PreviewStage
        {...createProps({
          overlayCards: [makeCard('selected', 'metric-focus', 0, 3, 0)],
          selectedCardId: 'selected',
          currentTime: 1,
          onCardPositionChange,
        })}
      />,
    )
    const stage = screen.getByTestId('preview-stage')
    const overlay = screen.getByTestId('overlay-card-selected')
    const setPointerCapture = vi.fn()
    Object.defineProperty(overlay, 'setPointerCapture', {
      configurable: true,
      value: setPointerCapture,
    })
    mockStageRect(stage)

    firePointer(overlay, 'pointerdown', 7, 100, 50)
    expect(setPointerCapture).toHaveBeenCalledWith(7)
    firePointer(stage, 'pointermove', 7, 292, 158)
    firePointer(stage, 'pointermove', 7, 2000, -500)

    expect(onCardPositionChange).toHaveBeenNthCalledWith(1, 'selected', {
      x: 40,
      y: 50,
    })
    expect(onCardPositionChange).toHaveBeenNthCalledWith(2, 'selected', {
      x: 100,
      y: 0,
    })
  })

  it('does not drag an unselected card', () => {
    const onCardPositionChange = vi.fn()
    render(
      <PreviewStage
        {...createProps({
          overlayCards: [makeCard('unselected', 'metric-focus', 0, 3, 0)],
          selectedCardId: null,
          currentTime: 1,
          onCardPositionChange,
        })}
      />,
    )
    const stage = screen.getByTestId('preview-stage')
    const overlay = screen.getByTestId('overlay-card-unselected')
    mockStageRect(stage)

    firePointer(overlay, 'pointerdown', 1, 100, 50)
    firePointer(stage, 'pointermove', 1, 300, 200)

    expect(onCardPositionChange).not.toHaveBeenCalled()
  })

  it('normalizes non-finite pointer deltas and starting positions', () => {
    const onCardPositionChange = vi.fn()
    const unsafe = makeCard('unsafe', 'metric-focus', 0, 3, 0, {
      x: Number.NaN,
      y: Number.POSITIVE_INFINITY,
    })
    render(
      <PreviewStage
        {...createProps({
          overlayCards: [unsafe],
          selectedCardId: 'unsafe',
          currentTime: 1,
          onCardPositionChange,
        })}
      />,
    )
    const stage = screen.getByTestId('preview-stage')
    const overlay = screen.getByTestId('overlay-card-unsafe')
    mockStageRect(stage)

    firePointer(overlay, 'pointerdown', 1, 100, 50)
    firePointer(stage, 'pointermove', 1, Number.NaN, Number.POSITIVE_INFINITY)

    expect(onCardPositionChange).toHaveBeenCalledWith('unsafe', { x: 0, y: 0 })
  })

  it('isolates pointers, clears cancel/lost capture, and defends zero canvas rect', () => {
    const onCardPositionChange = vi.fn()
    render(
      <PreviewStage
        {...createProps({
          overlayCards: [makeCard('selected', 'metric-focus', 0, 3, 0)],
          selectedCardId: 'selected',
          currentTime: 1,
          onCardPositionChange,
        })}
      />,
    )
    const stage = screen.getByTestId('preview-stage')
    const overlay = screen.getByTestId('overlay-card-selected')
    mockStageRect(stage)

    firePointer(overlay, 'pointerdown', 1, 100, 50)
    firePointer(stage, 'pointermove', 2, 200, 100)
    expect(onCardPositionChange).not.toHaveBeenCalled()
    firePointer(stage, 'pointercancel', 2, 0, 0)
    firePointer(stage, 'pointermove', 1, 200, 100)
    expect(onCardPositionChange).toHaveBeenCalledTimes(1)
    firePointer(stage, 'pointercancel', 1, 0, 0)
    firePointer(stage, 'pointermove', 1, 300, 200)
    expect(onCardPositionChange).toHaveBeenCalledTimes(1)

    firePointer(overlay, 'pointerdown', 3, 100, 50)
    firePointer(stage, 'lostpointercapture', 3, 0, 0)
    firePointer(stage, 'pointermove', 3, 200, 100)
    expect(onCardPositionChange).toHaveBeenCalledTimes(1)

    mockStageRect(stage, 0, 0)
    firePointer(overlay, 'pointerdown', 4, 100, 50)
    firePointer(stage, 'pointermove', 4, 200, 100)
    expect(onCardPositionChange).toHaveBeenCalledTimes(1)
  })
})
