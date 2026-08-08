import { renderBarCompareToCanvas } from '../../motion/canvas/barCompareRenderer'
import { renderCompareSplitToCanvas } from '../../motion/canvas/compareSplitRenderer'
import { renderMetricFocusToCanvas } from '../../motion/canvas/metricFocusRenderer'
import { renderNarrativeToCanvas } from '../../motion/canvas/narrativeRenderer'
import { renderProfileRevealToCanvas } from '../../motion/canvas/profileRevealRenderer'
import { renderShareRingToCanvas } from '../../motion/canvas/shareRingRenderer'
import { renderStepFlowToCanvas } from '../../motion/canvas/stepFlowRenderer'
import { renderAudiencePollToCanvas } from '../../motion/canvas/audiencePollRenderer'
import type { MotionId, ParameterValues } from '../../motion/types'
import type { CanvasMotionRenderer } from './types'

export const canvasRendererRegistry = {
  'narrative': renderNarrativeToCanvas as CanvasMotionRenderer<ParameterValues>,
  'metric-focus': renderMetricFocusToCanvas as CanvasMotionRenderer<ParameterValues>,
  'compare-split': renderCompareSplitToCanvas as CanvasMotionRenderer<ParameterValues>,
  'profile-reveal': renderProfileRevealToCanvas as CanvasMotionRenderer<ParameterValues>,
  'bar-compare': renderBarCompareToCanvas as CanvasMotionRenderer<ParameterValues>,
  'share-ring': renderShareRingToCanvas as CanvasMotionRenderer<ParameterValues>,
  'step-flow': renderStepFlowToCanvas as CanvasMotionRenderer<ParameterValues>,
  'audience-poll': renderAudiencePollToCanvas as CanvasMotionRenderer<ParameterValues>,
} satisfies Record<MotionId, CanvasMotionRenderer<ParameterValues>>

export function resolveCanvasRenderer(motionId: MotionId) {
  return canvasRendererRegistry[motionId]
}
