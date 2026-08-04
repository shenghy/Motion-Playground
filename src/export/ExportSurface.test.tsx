import { act, createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMotionDefinition } from '../motion/registry'
import type { OverlayCard } from '../timeline/types'
import { ExportSurface, type ExportSurfaceHandle } from './ExportSurface'

function card(): OverlayCard {
  return {
    id: 'metric',
    motionId: 'metric-focus',
    start: 0,
    end: 4,
    zIndex: 0,
    position: { x: 0, y: 0 },
    params: { ...getMotionDefinition('metric-focus').defaults },
  }
}

describe('Canvas ExportSurface', () => {
  const pixels = new Uint8ClampedArray(1920 * 1080 * 4)
  const clearRect = vi.fn()
  const getImageData = vi.fn(() => ({ data: pixels }))
  const toBlob = vi.fn((callback: BlobCallback) => {
    callback(new Blob(['png'], { type: 'image/png' }))
  })

  beforeEach(() => {
    clearRect.mockClear()
    getImageData.mockClear()
    toBlob.mockClear()
    const noop = vi.fn()
    const ctx = new Proxy({
      clearRect,
      getImageData,
      measureText: vi.fn((text: string) => ({ width: text.length * 20 })),
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      font: '10px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      filter: 'none',
    } as unknown as CanvasRenderingContext2D, {
      get(target, property, receiver) {
        if (property in target) return Reflect.get(target, property, receiver)
        return noop
      },
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation(toBlob)
  })

  it('renders deterministic rgba and png frames on one transparent canvas', async () => {
    const ref = createRef<ExportSurfaceHandle>()
    const { container } = render(<ExportSurface ref={ref} cards={[card()]} />)

    await act(() => ref.current!.beginCaptureSession())
    await act(() => ref.current!.prepareFrame(1))
    const rgba = ref.current!.renderRgba(2)
    const png = await ref.current!.capturePng()

    expect(clearRect).toHaveBeenCalledTimes(2)
    expect(rgba).toBe(pixels)
    expect(rgba.byteLength).toBe(8_294_400)
    expect(png.type).toBe('image/png')
    expect(screen.getByTestId('export-surface')).toHaveAttribute(
      'data-background',
      'transparent',
    )
    expect(container.querySelector('video')).toBeNull()
    ref.current!.endCaptureSession()
  })
})
