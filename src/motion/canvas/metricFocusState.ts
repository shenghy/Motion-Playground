import {
  delayedProgress,
  interpolateKeyframes,
} from '../../export/frameMath'
import { samplePencilEase } from '../../export/canvas/timing'
import { formatCountUp } from '../useCountUp'
import type { MetricFocusParams } from '../types'

interface LayerState {
  opacity: number
  x: number
  y: number
  scale: number
}

function enter(
  time: number,
  delay: number,
  duration: number,
  from: Partial<Pick<LayerState, 'x' | 'y' | 'scale'>> = {},
): LayerState {
  const progress = samplePencilEase(delayedProgress(time, delay, duration))
  return {
    opacity: progress,
    x: (from.x ?? 0) * (1 - progress),
    y: (from.y ?? 0) * (1 - progress),
    scale: (from.scale ?? 1) + (1 - (from.scale ?? 1)) * progress,
  }
}

export function getMetricFocusState(
  params: MetricFocusParams,
  localTime: number,
) {
  const time = Number.isFinite(localTime) ? Math.max(0, localTime) : 0
  const duration = Math.max(0.2, params.duration)
  const entranceDuration = duration * 0.42
  const scanProgress = Math.min(1, time / duration)
  const easedScan = samplePencilEase(scanProgress)

  return {
    number: formatCountUp(
      params.value,
      duration,
      params.decimals,
      time,
    ),
    eyebrow: enter(time, 0.12, entranceDuration, { y: 28 }),
    value: enter(time, 0.2, entranceDuration, { scale: 0.94 }),
    meta: enter(time, 0.42, entranceDuration, { y: 22 }),
    pencilLine: {
      reveal: samplePencilEase(delayedProgress(time, 0.48, entranceDuration)),
    },
    ticks: {
      reveal: samplePencilEase(delayedProgress(time, 0.55, entranceDuration)),
    },
    secondary: enter(time, 0.5, entranceDuration, { x: 34 }),
    scan: {
      scaleX: interpolateKeyframes(easedScan, [0, 1, 1], [0, 0.45, 1]),
      opacity: interpolateKeyframes(easedScan, [0, 1, 0.25], [0, 0.45, 1]),
    },
  }
}
