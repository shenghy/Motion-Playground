import { describe, expect, it } from 'vitest'
import { MOTION_IDS } from '../../motion/types'
import {
  canvasRendererRegistry,
  resolveCanvasRenderer,
} from './rendererRegistry'

describe('worker-safe canvas renderer registry', () => {
  it('contains every motion exactly once', () => {
    expect(Object.keys(canvasRendererRegistry).sort()).toEqual(
      [...MOTION_IDS].sort(),
    )
    for (const motionId of MOTION_IDS) {
      expect(resolveCanvasRenderer(motionId)).toBeTypeOf('function')
    }
  })
})
