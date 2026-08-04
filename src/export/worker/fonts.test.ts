import { describe, expect, it, vi } from 'vitest'
import { loadWorkerFonts } from './fonts'

describe('worker font loading', () => {
  it('loads and registers all exact export font families', async () => {
    const loadedFaces: unknown[] = []
    const FontFaceConstructor = vi.fn(function (
      this: { load: () => Promise<unknown> },
      family: string,
      source: string,
      descriptors?: FontFaceDescriptors,
    ) {
      const face = { family, source, descriptors }
      this.load = vi.fn(async () => {
        loadedFaces.push(face)
        return face
      })
    })
    const fontSet = {
      add: vi.fn(),
      ready: Promise.resolve(),
    }

    const resources = await loadWorkerFonts(
      fontSet,
      FontFaceConstructor as never,
    )

    expect(FontFaceConstructor).toHaveBeenCalledWith(
      'Syne Worker',
      expect.stringContaining('url('),
      expect.objectContaining({ weight: '400 800' }),
    )
    expect(FontFaceConstructor).toHaveBeenCalledWith(
      'IBM Plex Mono Worker',
      expect.stringContaining('url('),
      expect.any(Object),
    )
    expect(FontFaceConstructor).toHaveBeenCalledWith(
      'Ma Shan Zheng Worker',
      expect.stringContaining('url('),
      expect.any(Object),
    )
    expect(loadedFaces).toHaveLength(3)
    expect(fontSet.add).toHaveBeenCalledTimes(3)
    expect(resources).toEqual({
      width: 1920,
      height: 1080,
      displayFont: 'Syne Worker, Microsoft YaHei, sans-serif',
      monoFont: 'IBM Plex Mono Worker, Microsoft YaHei, monospace',
      handwritingFont:
        'Ma Shan Zheng Worker, KaiTi, STKaiti, Microsoft YaHei, sans-serif',
    })
  })

  it('does not register a face whose load fails', async () => {
    const FontFaceConstructor = vi.fn(function (this: {
      load: () => Promise<unknown>
    }) {
      this.load = vi.fn(async () => {
        throw new Error('font unavailable')
      })
    })
    const fontSet = { add: vi.fn(), ready: Promise.resolve() }

    await expect(
      loadWorkerFonts(fontSet, FontFaceConstructor as never),
    ).rejects.toThrow('font unavailable')
    expect(fontSet.add).not.toHaveBeenCalled()
  })

  it('finishes from loaded faces when Worker FontFaceSet.ready stays pending', async () => {
    const FontFaceConstructor = vi.fn(function (this: {
      load: () => Promise<unknown>
    }) {
      this.load = vi.fn(async () => ({}))
    })
    const fontSet = {
      add: vi.fn(),
      ready: new Promise(() => undefined),
    }

    const outcome = await Promise.race([
      loadWorkerFonts(fontSet, FontFaceConstructor as never)
        .then(() => 'loaded'),
      new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 20)),
    ])

    expect(outcome).toBe('loaded')
    expect(fontSet.add).toHaveBeenCalledTimes(3)
  })
})
