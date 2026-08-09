import { describe, expect, it } from 'vitest'
import { resolveCanvasRenderer } from '../export/canvas/rendererRegistry'
import {
  getMotionDefinition,
  motionRegistry,
  resolveMotionRenderer,
} from './registry'

describe('shared motion renderer contract', () => {
  it('uses the registry renderer for preview, export, and worker resolution', () => {
    for (const definition of motionRegistry) {
      expect(resolveMotionRenderer(definition.id)).toBe(definition.canvasRenderer)
      expect(resolveCanvasRenderer(definition.id)).toBe(definition.canvasRenderer)
      expect(getMotionDefinition(definition.id).canvasRenderer).toBe(
        definition.canvasRenderer,
      )
    }
  })

  it('keeps the production registry free of React visual components', () => {
    for (const definition of motionRegistry) {
      expect(definition).not.toHaveProperty('component')
    }
  })
})
