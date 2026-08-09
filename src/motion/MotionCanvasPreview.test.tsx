import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getMotionDefinition } from './registry'
import { MotionCanvasPreview } from './MotionCanvasPreview'

describe('MotionCanvasPreview', () => {
  it('draws sampled playback with the registry renderer and export resources', async () => {
    const definition = getMotionDefinition('metric-focus')
    const original = definition.canvasRenderer
    const renderer = vi.fn(original)
    definition.canvasRenderer = renderer

    try {
      render(
        <MotionCanvasPreview
          motionId="metric-focus"
          params={definition.defaults}
          playbackTime={1.25}
          playbackDuration={3}
          label="metric preview"
        />,
      )

      const canvas = screen.getByRole('img', { name: 'metric preview' })
      expect(canvas).toHaveAttribute('width', '1920')
      expect(canvas).toHaveAttribute('height', '1080')
      expect(canvas).toHaveAttribute('data-playback-time', '1.25')
      await waitFor(() => expect(renderer).toHaveBeenCalled())
      expect(renderer).toHaveBeenLastCalledWith(expect.objectContaining({
        params: definition.defaults,
        localTime: 1.25,
        localDuration: 3,
        resources: expect.objectContaining({ width: 1920, height: 1080 }),
      }))
    } finally {
      definition.canvasRenderer = original
    }
  })
})
