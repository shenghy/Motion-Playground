import type { CanvasRenderResources } from '../canvas/types'
import { workerFontAssets } from './fontAssets'

interface WorkerFontSet {
  add(face: FontFace): unknown
  ready: Promise<unknown>
}

interface WorkerFontFace {
  load(): Promise<FontFace>
}

type WorkerFontFaceConstructor = new (
  family: string,
  source: string,
  descriptors?: FontFaceDescriptors,
) => WorkerFontFace

const FONT_DEFINITIONS = [
  { family: 'Syne Worker', source: workerFontAssets.display, descriptors: { weight: '400 800', style: 'normal' } },
  { family: 'IBM Plex Mono Worker', source: workerFontAssets.mono, descriptors: { weight: '400', style: 'normal' } },
  { family: 'Ma Shan Zheng Worker', source: workerFontAssets.handwriting, descriptors: { weight: '400', style: 'normal' } },
] as const

export async function loadWorkerFonts(
  fontSet: WorkerFontSet,
  FontFaceConstructor: WorkerFontFaceConstructor,
): Promise<CanvasRenderResources> {
  const faces = await Promise.all(
    FONT_DEFINITIONS.map(async ({ family, source, descriptors }) => {
      const face = new FontFaceConstructor(
        family,
        `url(${JSON.stringify(source)})`,
        descriptors,
      )
      return face.load()
    }),
  )
  for (const face of faces) fontSet.add(face)

  return {
    width: 1920,
    height: 1080,
    displayFont: 'Syne Worker, Microsoft YaHei, sans-serif',
    monoFont: 'IBM Plex Mono Worker, Microsoft YaHei, monospace',
    handwritingFont:
      'Ma Shan Zheng Worker, KaiTi, STKaiti, Microsoft YaHei, sans-serif',
  }
}
