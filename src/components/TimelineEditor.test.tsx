import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import type { OverlayCard } from '../timeline/types'
import { TimelineEditor } from './TimelineEditor'

const cards: OverlayCard[] = [
  {
    id: 'card-1',
    motionId: 'metric-focus',
    start: 1,
    end: 3,
    position: { x: 0, y: 0 },
    zIndex: 0,
    params: {},
  },
  {
    id: 'card-2',
    motionId: 'compare-split',
    start: 5,
    end: 8,
    position: { x: 0, y: 0 },
    zIndex: 1,
    params: {},
  },
]

const motionNames = {
  'metric-focus': '核心指标',
}

function createProps(
  overrides: Partial<React.ComponentProps<typeof TimelineEditor>> = {},
) {
  return {
    cards,
    duration: 10,
    currentTime: 4,
    selectedCardId: null,
    motionNames,
    onDropMotion: vi.fn(),
    onSelectCard: vi.fn(),
    onMoveCard: vi.fn(),
    onResizeCard: vi.fn(),
    onSeek: vi.fn(),
    onDeleteCard: vi.fn(),
    ...overrides,
  }
}

function mockTrackRect(track: HTMLElement, left = 100, width = 400) {
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
    x: left,
    y: 0,
    left,
    top: 0,
    right: left + width,
    bottom: 60,
    width,
    height: 60,
    toJSON: () => ({}),
  })
}

function createDataTransfer(motionId = 'metric-focus') {
  return {
    types: ['application/x-overlay-motion'],
    dropEffect: 'none',
    getData: vi.fn(() => motionId),
  }
}

function dropAt(
  track: HTMLElement,
  clientX: number,
  dataTransfer: ReturnType<typeof createDataTransfer>,
) {
  const event = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    clientX: { value: clientX },
    dataTransfer: { value: dataTransfer },
  })
  fireEvent(track, event)
}

describe('TimelineEditor', () => {
  it('accepts motion drops at a clamped track time and allows copy drag-over', () => {
    const props = createProps()
    render(<TimelineEditor {...props} />)
    const track = screen.getByTestId('timeline-track')
    mockTrackRect(track)
    const dataTransfer = createDataTransfer()

    expect(fireEvent.dragOver(track, { dataTransfer })).toBe(false)
    expect(dataTransfer.dropEffect).toBe('copy')

    dropAt(track, 300, dataTransfer)
    dropAt(track, 700, dataTransfer)

    expect(props.onDropMotion).toHaveBeenNthCalledWith(1, 'metric-focus', 5)
    expect(props.onDropMotion).toHaveBeenNthCalledWith(2, 'metric-focus', 10)
  })

  it('rejects drops without a video and shows a Chinese status', () => {
    const props = createProps({ duration: 0 })
    render(<TimelineEditor {...props} />)
    const track = screen.getByTestId('timeline-track')
    mockTrackRect(track)

    expect(screen.getByRole('status')).toHaveTextContent('请先导入视频')
    dropAt(track, 200, createDataTransfer())

    expect(props.onDropMotion).not.toHaveBeenCalled()
  })

  it('renders card percentages, names, selected state, and the playhead', () => {
    render(<TimelineEditor {...createProps({ selectedCardId: 'card-1' })} />)

    const firstCard = screen.getByRole('button', { name: '选择核心指标片段' })
    const fallbackCard = screen.getByRole('button', {
      name: '选择compare-split片段',
    })

    expect(firstCard).toHaveStyle({ left: '10%', width: '20%' })
    expect(firstCard).toHaveAttribute('aria-pressed', 'true')
    expect(fallbackCard).toHaveStyle({ left: '50%', width: '30%' })
    expect(screen.getByTestId('timeline-playhead')).toHaveStyle({ left: '40%' })
  })

  it('selects a card and seeks when the empty track is clicked', () => {
    const props = createProps()
    render(<TimelineEditor {...props} />)
    const track = screen.getByTestId('timeline-track')
    mockTrackRect(track)

    fireEvent.click(screen.getByRole('button', { name: '选择核心指标片段' }))
    fireEvent.click(track, { clientX: 200 })

    expect(props.onSelectCard).toHaveBeenCalledWith('card-1')
    expect(props.onSeek).toHaveBeenCalledWith(2.5)
  })

  it('moves a card body by pointer delta and clamps the requested start', () => {
    const props = createProps()
    render(<TimelineEditor {...props} />)
    const track = screen.getByTestId('timeline-track')
    const card = screen.getByRole('button', { name: '选择核心指标片段' })
    mockTrackRect(track)

    fireEvent.pointerDown(card, { clientX: 140, pointerId: 1 })
    fireEvent.pointerMove(track, { clientX: 220, pointerId: 1 })
    fireEvent.pointerMove(track, { clientX: -500, pointerId: 1 })

    expect(props.onMoveCard).toHaveBeenNthCalledWith(1, 'card-1', 3)
    expect(props.onMoveCard).toHaveBeenNthCalledWith(2, 'card-1', 0)
  })

  it('resizes both card edges by pointer delta and clamps their target time', () => {
    const props = createProps()
    render(<TimelineEditor {...props} />)
    const track = screen.getByTestId('timeline-track')
    const startHandle = screen.getByRole('button', {
      name: '调整核心指标片段开始时间',
    })
    const endHandle = screen.getByRole('button', {
      name: '调整核心指标片段结束时间',
    })
    mockTrackRect(track)

    fireEvent.pointerDown(startHandle, { clientX: 140, pointerId: 1 })
    fireEvent.pointerMove(track, { clientX: 180, pointerId: 1 })
    fireEvent.pointerUp(track, { pointerId: 1 })
    fireEvent.pointerDown(endHandle, { clientX: 140, pointerId: 2 })
    fireEvent.pointerMove(track, { clientX: 900, pointerId: 2 })

    expect(props.onResizeCard).toHaveBeenNthCalledWith(1, 'card-1', 'start', 2)
    expect(props.onResizeCard).toHaveBeenNthCalledWith(2, 'card-1', 'end', 10)
    expect(props.onSelectCard).not.toHaveBeenCalled()
  })

  it('deletes only a selected card that still exists', () => {
    const props = createProps({ selectedCardId: 'card-2' })
    const { rerender } = render(<TimelineEditor {...props} />)

    fireEvent.click(screen.getByRole('button', { name: '删除选中片段' }))
    expect(props.onDeleteCard).toHaveBeenCalledWith('card-2')

    rerender(<TimelineEditor {...createProps({ selectedCardId: 'missing' })} />)
    expect(
      screen.queryByRole('button', { name: '删除选中片段' }),
    ).not.toBeInTheDocument()
  })

  it('does not emit position callbacks when the track has no width', () => {
    const props = createProps()
    render(<TimelineEditor {...props} />)
    const track = screen.getByTestId('timeline-track')
    const card = screen.getByRole('button', { name: '选择核心指标片段' })
    mockTrackRect(track, 100, 0)

    fireEvent.click(track, { clientX: 200 })
    dropAt(track, 200, createDataTransfer())
    fireEvent.pointerDown(card, { clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(track, { clientX: 200, pointerId: 1 })

    expect(props.onSeek).not.toHaveBeenCalled()
    expect(props.onDropMotion).not.toHaveBeenCalled()
    expect(props.onMoveCard).not.toHaveBeenCalled()
  })
})
