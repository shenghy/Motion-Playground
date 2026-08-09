import { describe, expect, it, vi } from 'vitest'
import type { CanvasMotionRenderer } from './types'
import type { OverlayCard } from '../../timeline/types'
import { createCanvasExportSession } from './CanvasExportSurface'

function card(
  id: string,
  start: number,
  end: number,
  zIndex: number,
  x = 0,
  y = 0,
): OverlayCard {
  return {
    id,
    motionId: 'metric-focus',
    start,
    end,
    zIndex,
    position: { x, y },
    params: { label: id },
  }
}

function canvasFixture() {
  const pixels = new Uint8ClampedArray(1920 * 1080 * 4)
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    translate: vi.fn(),
    getImageData: vi.fn(() => ({ data: pixels })),
  } as unknown as CanvasRenderingContext2D
  const png = new Blob(['png'], { type: 'image/png' })
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toBlob: vi.fn((callback: BlobCallback) => callback(png)),
  } as unknown as HTMLCanvasElement
  return { canvas, ctx, pixels, png }
}

describe('persistent canvas export session', () => {
  it('passes one-shot local time and card duration to the renderer', async () => {
    const { canvas } = canvasFixture()
    const samples: Array<{ localTime: number; localDuration: number }> = []
    const renderer: CanvasMotionRenderer<Record<string, string | number>> = ({
      localTime,
      localDuration,
    }) => samples.push({ localTime, localDuration: localDuration ?? Number.NaN })
    const session = createCanvasExportSession({
      canvas,
      cards: [card('timed', 10, 14, 0)],
      resolveRenderer: () => renderer,
      fontReady: vi.fn(async () => undefined),
    })

    await session.begin()
    session.renderFrame(11.5)

    expect(samples).toEqual([{ localTime: 1.5, localDuration: 4 }])
  })

  it('clears, filters, stably sorts, and positions active cards', async () => {
    const { canvas, ctx } = canvasFixture()
    const renderOrder: string[] = []
    const renderer: CanvasMotionRenderer<Record<string, string | number>> = ({
      params,
    }) => renderOrder.push(String(params.label))
    const session = createCanvasExportSession({
      canvas,
      cards: [
        card('high', 0, 5, 5),
        card('ended', 0, 1, 0),
        card('same-z-first', 1, 5, 1, 10, -5),
        card('same-z-second', 1, 5, 1),
      ],
      resolveRenderer: () => renderer,
      fontReady: vi.fn(async () => undefined),
    })

    await session.begin()
    session.renderFrame(2)

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1920, 1080)
    expect(renderOrder).toEqual(['same-z-first', 'same-z-second', 'high'])
    expect(ctx.translate).toHaveBeenCalledWith(192, -54)
    expect(ctx.save).toHaveBeenCalledTimes(3)
    expect(ctx.restore).toHaveBeenCalledTimes(3)
  })

  it('loads fonts once per session and exposes exact rgba and png frames', async () => {
    const { canvas, pixels, png } = canvasFixture()
    const fontReady = vi.fn(async () => undefined)
    const session = createCanvasExportSession({
      canvas,
      cards: [],
      resolveRenderer: () => vi.fn(),
      fontReady,
    })

    await session.begin()
    await session.begin()
    expect(fontReady).toHaveBeenCalledTimes(1)
    expect(canvas.width).toBe(1920)
    expect(canvas.height).toBe(1080)

    session.renderFrame(0)
    expect(session.readRgba()).toBe(pixels)
    expect(session.readRgba().byteLength).toBe(8_294_400)
    await expect(session.capturePng()).resolves.toBe(png)

    session.end()
    await session.begin()
    expect(fontReady).toHaveBeenCalledTimes(2)
  })

  it('returns frame bounds and reads only the requested rgba region', async () => {
    const { canvas, ctx } = canvasFixture()
    const regionPixels = new Uint8ClampedArray(10 * 20 * 4)
    vi.mocked(ctx.getImageData).mockReturnValueOnce({
      data: regionPixels,
    } as ImageData)
    const session = createCanvasExportSession({
      canvas,
      cards: [card('visible', 0, 5, 0, 10, 5)],
      resolveRenderer: () => vi.fn(),
      resolveBounds: () => ({ x: 20, y: 30, width: 10, height: 20 }),
      fontReady: vi.fn(async () => undefined),
    })

    await session.begin()
    expect(session.frameBounds(1)).toEqual({
      x: 212,
      y: 84,
      width: 10,
      height: 20,
    })
    session.renderFrame(1)
    expect(session.readRgbaRegion({
      x: 212,
      y: 84,
      width: 10,
      height: 20,
    })).toBe(regionPixels)
    expect(ctx.getImageData).toHaveBeenCalledWith(212, 84, 10, 20)
  })

  it('reads rgba and captures png from an OffscreenCanvas-shaped source', async () => {
    const pixels = new Uint8ClampedArray(1920 * 1080 * 4)
    const png = new Blob(['offscreen'], { type: 'image/png' })
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      clearRect: vi.fn(),
      translate: vi.fn(),
      getImageData: vi.fn(() => ({ data: pixels })),
    } as unknown as OffscreenCanvasRenderingContext2D
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
      convertToBlob: vi.fn(async () => png),
    }
    const session = createCanvasExportSession({
      canvas,
      cards: [],
      resolveRenderer: () => vi.fn(),
      fontReady: vi.fn(async () => undefined),
    })

    await session.begin()
    session.renderFrame(0)

    expect(session.readRgba()).toBe(pixels)
    await expect(session.capturePng()).resolves.toBe(png)
    expect(canvas.convertToBlob).toHaveBeenCalledWith({ type: 'image/png' })
  })

  it('fails before drawing when a card has no canvas renderer', async () => {
    const { canvas } = canvasFixture()
    const session = createCanvasExportSession({
      canvas,
      cards: [card('missing', 0, 5, 0)],
      resolveRenderer: () => undefined,
      fontReady: vi.fn(async () => undefined),
    })
    await session.begin()
    expect(() => session.renderFrame(1)).toThrow('metric-focus')
  })
})
