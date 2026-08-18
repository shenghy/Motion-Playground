import { act, fireEvent, render, screen } from '@testing-library/react'
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

const motionColors = {
  'metric-focus': '#4D8FD8',
  'compare-split': '#D39A43',
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
    motionColors,
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

function createDataTransfer(
  motionId = 'metric-focus',
  types = ['application/x-overlay-motion'],
) {
  return {
    types,
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

function firePointer(
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel' | 'lostpointercapture',
  pointerId: number,
  clientX = 0,
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
  })
  fireEvent(target, event)
}

function fireWheel(
  target: HTMLElement,
  options: {
    deltaX?: number
    deltaY?: number
    clientX?: number
    shiftKey?: boolean
  } = {},
) {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaX: options.deltaX ?? 0,
    deltaY: options.deltaY ?? 0,
    clientX: options.clientX ?? 0,
    shiftKey: options.shiftKey ?? false,
  })
  let dispatched = true
  act(() => {
    dispatched = target.dispatchEvent(event)
  })
  return dispatched
}

function getClip(motionLabel: string) {
  const body = screen.getByRole('button', { name: motionLabel })
  return body.parentElement as HTMLElement
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

  it('rejects empty, unknown, and wrong-MIME motion drops', () => {
    const props = createProps()
    render(<TimelineEditor {...props} />)
    const track = screen.getByTestId('timeline-track')
    mockTrackRect(track)

    dropAt(track, 200, createDataTransfer(''))
    dropAt(track, 200, createDataTransfer('not-a-motion'))
    dropAt(track, 200, createDataTransfer('metric-focus', ['text/plain']))

    expect(props.onDropMotion).not.toHaveBeenCalled()
  })

  it('accepts a known motion drop when its display name is missing', () => {
    const props = createProps()
    render(<TimelineEditor {...props} />)
    const track = screen.getByTestId('timeline-track')
    mockTrackRect(track)

    dropAt(track, 200, createDataTransfer('compare-split'))

    expect(props.onDropMotion).toHaveBeenCalledWith('compare-split', 2.5)
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

    const firstCard = screen.getByRole('button', {
      name: '选择核心指标片段，可用左右方向键微调时间',
    })
    const fallbackCard = screen.getByRole('button', {
      name: '选择compare-split片段，可用左右方向键微调时间',
    })
    const firstClip = firstCard.parentElement
    const fallbackClip = fallbackCard.parentElement

    expect(firstClip).toHaveStyle({ left: '10%', width: '20%' })
    expect(firstCard).toHaveAttribute('aria-pressed', 'true')
    expect(fallbackClip).toHaveStyle({ left: '50%', width: '30%' })
    expect(screen.getByTestId('timeline-playhead')).toHaveStyle({ left: '40%' })

    const startHandle = screen.getByRole('button', {
      name: '调整核心指标片段开始时间',
    })
    expect(firstCard).not.toContainElement(startHandle)
    expect(firstCard.parentElement).toBe(startHandle.parentElement)
  })

  it('renders adaptive ruler ticks for the visible time range', () => {
    render(<TimelineEditor {...createProps()} />)

    const ruler = screen.getByTestId('timeline-ruler')
    const ticks = ruler.querySelectorAll('.timeline-editor__tick')

    expect(ticks).toHaveLength(11)
    expect(ticks[0]).toHaveTextContent('0s')
    expect(ticks[10]).toHaveTextContent('10s')
  })

  it('zooms the time scale around the cursor with the mouse wheel', () => {
    const props = createProps()
    render(<TimelineEditor {...props} />)
    const track = screen.getByTestId('timeline-track')
    mockTrackRect(track)

    // clientX 300 → 轨道中点；放大后视窗 1s–9s
    const dispatched = fireWheel(track, { deltaY: -120, clientX: 300 })
    expect(dispatched).toBe(false)

    const clip = getClip('选择核心指标片段，可用左右方向键微调时间')
    expect(clip).toHaveStyle({ left: '0%', width: '25%' })
    expect(screen.getByTestId('timeline-playhead')).toHaveStyle({ left: '37.5%' })
    expect(screen.getByTestId('timeline-zoom-label')).toHaveTextContent('1s – 9s')

    const ticks = screen
      .getByTestId('timeline-ruler')
      .querySelectorAll('.timeline-editor__tick')
    expect(ticks).toHaveLength(9)
    expect(ticks[0]).toHaveTextContent('1s')
    expect(ticks[8]).toHaveTextContent('9s')

    // 缩放后点击空轨道按视窗映射时间：轨道 1/4 处 → 1 + 0.25×8 = 3s
    fireEvent.click(track, { clientX: 200 })
    expect(props.onSeek).toHaveBeenCalledWith(3)
  })

  it('keeps the full range when zooming out beyond the whole video', () => {
    render(<TimelineEditor {...createProps()} />)
    const track = screen.getByTestId('timeline-track')
    mockTrackRect(track)

    fireWheel(track, { deltaY: 120, clientX: 300 })

    const clip = getClip('选择核心指标片段，可用左右方向键微调时间')
    expect(clip).toHaveStyle({ left: '10%', width: '20%' })
    expect(
      screen.queryByTestId('timeline-zoom-label'),
    ).not.toBeInTheDocument()
  })

  it('limits zoom-in to a one-second window', () => {
    render(<TimelineEditor {...createProps()} />)
    const track = screen.getByTestId('timeline-track')
    mockTrackRect(track)

    for (let index = 0; index < 12; index += 1) {
      fireWheel(track, { deltaY: -120, clientX: 300 })
    }

    expect(screen.getByTestId('timeline-zoom-label')).toHaveTextContent(
      '4.5s – 5.5s',
    )
  })

  it('pans the zoomed view with shift-wheel and horizontal wheel', () => {
    render(<TimelineEditor {...createProps()} />)
    const track = screen.getByTestId('timeline-track')
    mockTrackRect(track)

    fireWheel(track, { deltaY: -120, clientX: 300 })
    // 视窗 1s–9s；Shift+滚轮上移 -200px → 偏移 -4s → 起点 0s（视窗 0s–8s）
    fireWheel(track, { deltaY: -200, clientX: 0, shiftKey: true })
    // 横向滚轮 +200px → 偏移 +4s → 起点钳制到 2s（视窗 2s–10s）
    fireWheel(track, { deltaX: 200, clientX: 0 })

    const clip = getClip('选择核心指标片段，可用左右方向键微调时间')
    expect(clip).toHaveStyle({ left: '0%', width: '12.5%' })
    expect(screen.getByTestId('timeline-playhead')).toHaveStyle({ left: '25%' })
    expect(screen.getByTestId('timeline-zoom-label')).toHaveTextContent(
      '2s – 10s',
    )
  })

  it('resets the zoom via the button or when the video duration changes', () => {
    const props = createProps()
    const { rerender } = render(<TimelineEditor {...props} />)
    const track = screen.getByTestId('timeline-track')
    mockTrackRect(track)

    fireWheel(track, { deltaY: -120, clientX: 300 })
    expect(screen.getByTestId('timeline-zoom-label')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重置缩放' }))
    const clip = getClip('选择核心指标片段，可用左右方向键微调时间')
    expect(clip).toHaveStyle({ left: '10%', width: '20%' })
    expect(
      screen.queryByTestId('timeline-zoom-label'),
    ).not.toBeInTheDocument()

    fireWheel(track, { deltaY: -120, clientX: 300 })
    rerender(<TimelineEditor {...createProps({ duration: 20 })} />)

    expect(
      screen.queryByTestId('timeline-zoom-label'),
    ).not.toBeInTheDocument()
    expect(clip).toHaveStyle({ left: '5%', width: '10%' })
  })

  it('sets each timeline card color without changing its timing geometry', () => {
    const { container } = render(<TimelineEditor {...createProps()} />)
    const clips = container.querySelectorAll('.timeline-editor__card')

    expect(clips[0]).toHaveStyle({
      left: '10%',
      width: '20%',
      '--timeline-card-color': '#4D8FD8',
    })
    expect(clips[1]).toHaveStyle({
      left: '50%',
      width: '30%',
      '--timeline-card-color': '#D39A43',
    })
  })

  it('uses neutral gray when a motion color is unavailable', () => {
    const { container } = render(
      <TimelineEditor {...createProps({ motionColors: {} })} />,
    )

    expect(container.querySelector('.timeline-editor__card')).toHaveStyle({
      '--timeline-card-color': '#777A7D',
    })
  })

  it('selects a card by click or keyboard and seeks on empty-track click', () => {
    const props = createProps()
    render(<TimelineEditor {...props} />)
    const track = screen.getByTestId('timeline-track')
    const card = screen.getByRole('button', {
      name: '选择核心指标片段，可用左右方向键微调时间',
    })
    mockTrackRect(track)

    fireEvent.click(card)
    fireEvent.keyDown(card, { key: 'Enter' })
    fireEvent.keyDown(card, { key: ' ' })
    fireEvent.click(track, { clientX: 200 })

    expect(props.onSelectCard).toHaveBeenCalledTimes(3)
    expect(props.onSelectCard).toHaveBeenLastCalledWith('card-1')
    expect(props.onSeek).toHaveBeenCalledWith(2.5)
  })

  it('nudges a card body by fixed keyboard steps without selecting or resizing', () => {
    const props = createProps()
    render(<TimelineEditor {...props} />)
    const card = screen.getByRole('button', {
      name: '选择核心指标片段，可用左右方向键微调时间',
    })

    const right = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
    const shiftedLeft = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    card.dispatchEvent(right)
    card.dispatchEvent(shiftedLeft)

    expect(right.defaultPrevented).toBe(true)
    expect(shiftedLeft.defaultPrevented).toBe(true)
    expect(props.onMoveCard).toHaveBeenNthCalledWith(1, 'card-1', 1.1)
    expect(props.onMoveCard).toHaveBeenNthCalledWith(2, 'card-1', 0.5)
    expect(props.onSelectCard).not.toHaveBeenCalled()
    expect(props.onResizeCard).not.toHaveBeenCalled()
  })

  it('moves a card body by pointer delta and clamps the requested start', () => {
    const props = createProps()
    render(<TimelineEditor {...props} />)
    const track = screen.getByTestId('timeline-track')
    const card = screen.getByRole('button', {
      name: '选择核心指标片段，可用左右方向键微调时间',
    })
    mockTrackRect(track)

    firePointer(card, 'pointerdown', 1, 140)
    firePointer(track, 'pointermove', 1, 220)
    firePointer(track, 'pointermove', 1, -500)

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

    firePointer(startHandle, 'pointerdown', 1, 140)
    firePointer(track, 'pointermove', 1, 180)
    firePointer(track, 'pointerup', 1)
    firePointer(endHandle, 'pointerdown', 2, 140)
    firePointer(track, 'pointermove', 2, 900)

    expect(props.onResizeCard).toHaveBeenNthCalledWith(1, 'card-1', 'start', 2)
    expect(props.onResizeCard).toHaveBeenNthCalledWith(2, 'card-1', 'end', 10)
    expect(props.onSelectCard).not.toHaveBeenCalled()
  })

  it('resizes handles by arrow key without selecting the card', () => {
    const props = createProps()
    render(<TimelineEditor {...props} />)
    const startHandle = screen.getByRole('button', {
      name: '调整核心指标片段开始时间',
    })
    const endHandle = screen.getByRole('button', {
      name: '调整核心指标片段结束时间',
    })

    fireEvent.keyDown(startHandle, { key: 'ArrowRight' })
    fireEvent.keyDown(endHandle, { key: 'ArrowLeft' })

    expect(props.onResizeCard).toHaveBeenNthCalledWith(1, 'card-1', 'start', 1.1)
    expect(props.onResizeCard).toHaveBeenNthCalledWith(2, 'card-1', 'end', 2.9)
    expect(props.onSelectCard).not.toHaveBeenCalled()
  })

  it('isolates pointer gestures by id and clears matching cancel or lost capture', () => {
    const props = createProps()
    render(<TimelineEditor {...props} />)
    const track = screen.getByTestId('timeline-track')
    const card = screen.getByRole('button', {
      name: '选择核心指标片段，可用左右方向键微调时间',
    })
    const setPointerCapture = vi.fn()
    Object.defineProperty(card, 'setPointerCapture', {
      configurable: true,
      value: setPointerCapture,
    })
    mockTrackRect(track)

    firePointer(card, 'pointerdown', 7, 140)
    expect(setPointerCapture).toHaveBeenCalledWith(7)
    firePointer(card, 'pointerdown', 8, 140)
    expect(setPointerCapture).toHaveBeenCalledTimes(1)
    firePointer(track, 'pointermove', 8, 220)
    expect(props.onMoveCard).not.toHaveBeenCalled()
    firePointer(track, 'pointercancel', 8)
    firePointer(track, 'pointermove', 7, 220)
    expect(props.onMoveCard).toHaveBeenCalledTimes(1)
    firePointer(track, 'pointercancel', 7)
    firePointer(track, 'pointermove', 7, 260)
    expect(props.onMoveCard).toHaveBeenCalledTimes(1)

    firePointer(card, 'pointerdown', 9, 140)
    firePointer(track, 'lostpointercapture', 9)
    firePointer(track, 'pointermove', 9, 220)
    expect(props.onMoveCard).toHaveBeenCalledTimes(1)
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
    const card = screen.getByRole('button', {
      name: '选择核心指标片段，可用左右方向键微调时间',
    })
    mockTrackRect(track, 100, 0)

    fireEvent.click(track, { clientX: 200 })
    dropAt(track, 200, createDataTransfer())
    firePointer(card, 'pointerdown', 1, 100)
    firePointer(track, 'pointermove', 1, 200)

    expect(props.onSeek).not.toHaveBeenCalled()
    expect(props.onDropMotion).not.toHaveBeenCalled()
    expect(props.onMoveCard).not.toHaveBeenCalled()
  })

  it.each([
    ['non-finite', Number.NaN, '请先导入视频'],
    ['shorter than the model minimum', 0.1, '视频时长不足，无法添加动效'],
  ])('treats a %s duration as unavailable for all interactions', (_name, duration, status) => {
    const props = createProps({ duration })
    render(<TimelineEditor {...props} />)
    const track = screen.getByTestId('timeline-track')
    const card = screen.getByRole('button', {
      name: '选择核心指标片段，可用左右方向键微调时间',
    })
    mockTrackRect(track)

    expect(screen.getByRole('status')).toHaveTextContent(status)
    dropAt(track, 200, createDataTransfer())
    fireEvent.click(track, { clientX: 200 })
    firePointer(card, 'pointerdown', 1, 100)
    firePointer(track, 'pointermove', 1, 200)

    expect(props.onDropMotion).not.toHaveBeenCalled()
    expect(props.onSeek).not.toHaveBeenCalled()
    expect(props.onMoveCard).not.toHaveBeenCalled()
  })
})
