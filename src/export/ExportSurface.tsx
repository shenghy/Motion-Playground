import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import type { OverlayCard } from '../timeline/types'
import {
  createCanvasExportSession,
  type CanvasExportSession,
} from './canvas/CanvasExportSurface'
import { resolveCanvasRenderer } from './canvas/rendererRegistry'
import { EXPORT_HEIGHT, EXPORT_WIDTH } from './frameMath'

export interface ExportSurfaceHandle {
  beginCaptureSession(): Promise<void>
  prepareFrame(time: number): Promise<void>
  capturePng(): Promise<Blob>
  renderRgba(time: number): Uint8ClampedArray
  endCaptureSession(): void
}

interface ExportSurfaceProps {
  cards: OverlayCard[]
}

export const ExportSurface = forwardRef<
  ExportSurfaceHandle,
  ExportSurfaceProps
>(function ExportSurface({ cards }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sessionRef = useRef<CanvasExportSession | null>(null)

  useEffect(() => () => {
    sessionRef.current?.end()
    sessionRef.current = null
  }, [cards])

  const requireSession = () => {
    if (sessionRef.current) return sessionRef.current
    if (!canvasRef.current) throw new Error('透明导出舞台尚未准备完成')
    sessionRef.current = createCanvasExportSession({
      canvas: canvasRef.current,
      cards,
      resolveRenderer: resolveCanvasRenderer,
      fontReady: async () => {
        await document.fonts?.ready
      },
    })
    return sessionRef.current
  }

  useImperativeHandle(ref, () => ({
    beginCaptureSession: () => requireSession().begin(),
    async prepareFrame(time) {
      requireSession().renderFrame(time)
    },
    capturePng: () => requireSession().capturePng(),
    renderRgba(time) {
      const session = requireSession()
      session.renderFrame(time)
      return session.readRgba()
    },
    endCaptureSession() {
      sessionRef.current?.end()
      sessionRef.current = null
    },
  }))

  return (
    <div className="export-surface-host" aria-hidden="true">
      <canvas
        ref={canvasRef}
        width={EXPORT_WIDTH}
        height={EXPORT_HEIGHT}
        data-testid="export-surface"
        data-background="transparent"
      />
    </div>
  )
})
