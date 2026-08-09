import {
  motionRegistry,
  resolveMotionRenderer,
} from '../../motion/registry'
import type { MotionId, ParameterValues } from '../../motion/types'
import type { CanvasMotionRenderer } from './types'

export const canvasRendererRegistry = Object.fromEntries(
  motionRegistry.map(({ id, canvasRenderer }) => [id, canvasRenderer]),
) as Record<MotionId, CanvasMotionRenderer<ParameterValues>>

export function resolveCanvasRenderer(motionId: MotionId) {
  return resolveMotionRenderer(motionId) as CanvasMotionRenderer<ParameterValues>
}
