import type { OverlayCard } from '../../timeline/types'
import { createCanvasExportSession } from '../canvas/CanvasExportSurface'
import { resolveCanvasRenderer } from '../canvas/rendererRegistry'
import { EXPORT_HEIGHT, EXPORT_WIDTH } from '../frameMath'
import { loadWorkerFonts } from '../worker/fonts'

interface ParityCommand {
  type: 'render'
  id: number
  card: OverlayCard
  time: number
}

const scope = globalThis as unknown as {
  fonts: FontFaceSet
  postMessage(message: unknown, transfer?: Transferable[]): void
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<ParityCommand>) => void,
  ): void
}

const ready = loadWorkerFonts(scope.fonts, FontFace)
scope.postMessage({ type: 'ready' })

scope.addEventListener('message', (event) => {
  void (async () => {
    try {
      const resources = await ready
      const command = event.data
      const canvas = new OffscreenCanvas(EXPORT_WIDTH, EXPORT_HEIGHT)
      const session = createCanvasExportSession({
        canvas,
        cards: [command.card],
        resolveRenderer: resolveCanvasRenderer,
        fontReady: async () => undefined,
        resources,
      })
      await session.begin()
      session.renderFrame(command.time)
      const pixels = session.readRgba()
      scope.postMessage(
        { type: 'frame', id: command.id, pixels: pixels.buffer },
        [pixels.buffer],
      )
      session.end()
    } catch (error) {
      scope.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  })()
})
