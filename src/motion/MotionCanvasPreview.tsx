import { useEffect, useRef, useState } from 'react'
import { DEFAULT_CANVAS_RESOURCES } from '../export/canvas/CanvasExportSurface'
import type { CanvasMotionRenderer } from '../export/canvas/types'
import { getNominalPlaybackDuration } from './playbackTiming'
import { resolveMotionRenderer } from './registry'
import type { MotionId, ParameterValues } from './types'

interface MotionCanvasPreviewProps {
  motionId: MotionId
  params: ParameterValues
  playbackTime?: number
  playbackDuration?: number
  label: string
}

function finiteTime(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value)
    : 0
}

export function MotionCanvasPreview({
  motionId,
  params,
  playbackTime,
  playbackDuration,
  label,
}: MotionCanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) {
      setError('浏览器无法创建动效预览画布')
      return
    }

    const renderer = resolveMotionRenderer(motionId) as unknown as
      CanvasMotionRenderer<ParameterValues>
    let frameId: number | null = null
    let cancelled = false

    const draw = (localTime: number) => {
      context.clearRect(0, 0, canvas.width, canvas.height)
      renderer({
        ctx: context,
        params,
        localTime,
        localDuration: playbackDuration,
        resources: DEFAULT_CANVAS_RESOURCES,
      })
      canvas.dataset.playbackTime = String(localTime)
    }

    const start = async () => {
      try {
        await document.fonts?.ready
        if (cancelled) return
        if (playbackTime !== undefined) {
          draw(finiteTime(playbackTime))
          return
        }

        const duration = Math.max(
          0.2,
          getNominalPlaybackDuration(motionId, params),
        )
        const startedAt = performance.now()
        const animate = (now: number) => {
          if (cancelled) return
          const localTime = Math.min(duration, (now - startedAt) / 1000)
          draw(localTime)
          if (localTime < duration) {
            frameId = requestAnimationFrame(animate)
          }
        }
        draw(0)
        frameId = requestAnimationFrame(animate)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : '动效预览渲染失败')
        }
      }
    }

    void start()
    return () => {
      cancelled = true
      if (frameId !== null) cancelAnimationFrame(frameId)
    }
  }, [motionId, params, playbackDuration, playbackTime])

  return (
    <>
      <canvas
        ref={canvasRef}
        className="motion-canvas motion-canvas-preview"
        width={1920}
        height={1080}
        role="img"
        aria-label={label}
        data-pencil-style="silver-on-black"
        data-motion-id={motionId}
        data-playback-time={playbackTime === undefined ? 'auto' : finiteTime(playbackTime)}
      />
      <span className="motion-canvas-preview__description">
        {Object.entries(params).map(([key, value]) =>
          typeof value === 'string' ? <span key={key}>{value}</span> : null,
        )}
      </span>
      {error && <span className="motion-canvas-preview__error" role="status">{error}</span>}
    </>
  )
}
