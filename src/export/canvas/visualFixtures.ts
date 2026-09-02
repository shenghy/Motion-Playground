import { motionRegistry } from '../../motion/registry'
import type { MotionId } from '../../motion/types'
import type { OverlayCard } from '../../timeline/types'

export interface CanvasVisualFixture {
  id: string
  motionId: MotionId
  phase: 'entrance' | 'expansion' | 'stable' | 'exit'
  localTime: number
  card: OverlayCard
  expectedBounds: { left: number; top: number; right: number; bottom: number }
}

const samples = {
  'narrative': [0.24, 0.9, 2.2, 5.05],
  'metric-focus': [0.12, 0.6, 1.4, 7.8],
  'compare-split': [0.12, 0.5, 1.5, 3],
  'profile-reveal': [0.38, 2.3, 4.2, 6.2],
  'bar-compare': [0.3, 1.4, 3.2, 5.6],
  'share-ring': [0.3, 1.6, 3.4, 5.8],
  'step-flow': [0.3, 1.8, 3.8, 6],
  'audience-poll': [0.3, 1.4, 3.4, 6],
  'prompt-display': [0.2, 3, 6.1, 8.1],
  'diary-date': [0.3, 1.6, 3.2, 4.1],
  'mind-map': [0.24, 3.2, 7.6, 9.5],
  'spotlight': [0.24, 2.8, 6.8, 8.5],
  'key-points': [0.24, 2.8, 6.8, 8.5],
  'flow-chain': [0.24, 2.8, 6.8, 8.5],
  'timeline-reveal': [0.24, 3.6, 8.8, 11.1],
  'category-matrix': [0.24, 3.6, 8.8, 11.1],
  'pyramid': [0.24, 2.6, 6.6, 8.3],
  'item-grid': [0.24, 4.2, 10.6, 13.3],
} satisfies Record<MotionId, [number, number, number, number]>

const phases = ['entrance', 'expansion', 'stable', 'exit'] as const

const LOCAL_BOUNDS = { left: 0, top: 40, right: 1919, bottom: 1030 }
/** 全屏卡铺满整张画布（1920×1080），边界即画布边界 */
const FULLSCREEN_BOUNDS = { left: 0, top: 0, right: 1919, bottom: 1079 }

export const canvasVisualFixtures: CanvasVisualFixture[] = motionRegistry.flatMap((motion, motionIndex) =>
  samples[motion.id].map((localTime, phaseIndex) => ({
    id: `${motion.id}-${phases[phaseIndex]}`,
    motionId: motion.id,
    phase: phases[phaseIndex],
    localTime,
    card: {
      id: `${motion.id}-visual`,
      motionId: motion.id,
      start: 0,
      end: 10,
      position: {
        x: motionIndex % 2 === 0 ? 0 : 1.5,
        y: motionIndex % 3 === 0 ? 0 : -1,
      },
      zIndex: motionIndex,
      params: { ...motion.defaults },
    },
    expectedBounds: motion.scope === 'fullscreen'
      ? FULLSCREEN_BOUNDS
      : LOCAL_BOUNDS,
  })),
)
