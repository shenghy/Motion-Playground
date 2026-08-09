import { delayedProgress } from '../../export/frameMath'
import { samplePencilEase } from '../../export/canvas/timing'
import { formatCountUp } from '../useCountUp'
import type { MetricFocusParams } from '../types'

interface LayerState {
  opacity: number
  x: number
  y: number
  scale: number
  blur: number
}

function enter(
  time: number,
  delay: number,
  duration: number,
  from: Partial<Pick<LayerState, 'x' | 'y' | 'scale' | 'blur'>> = {},
): LayerState {
  const progress = samplePencilEase(delayedProgress(time, delay, duration))
  return {
    opacity: progress,
    x: (from.x ?? 0) * (1 - progress),
    y: (from.y ?? 0) * (1 - progress),
    scale: (from.scale ?? 1) + (1 - (from.scale ?? 1)) * progress,
    blur: (from.blur ?? 0) * (1 - progress),
  }
}

export function getMetricFocusState(
  params: MetricFocusParams,
  localTime: number,
) {
  const time = Number.isFinite(localTime) ? Math.max(0, localTime) : 0
  const duration = Math.max(0.2, params.duration)
  const entranceDuration = duration * 0.42
  return {
    number: formatCountUp(
      params.value,
      duration,
      params.decimals,
      time,
    ),
    eyebrow: enter(time, 0.12, entranceDuration, { y: 18 }),
    value: enter(time, 0.2, entranceDuration, { scale: 0.94, blur: 12 }),
    bar: {
      reveal: samplePencilEase(
        delayedProgress(time, 0.28, entranceDuration),
      ),
    },
    meta: enter(time, 0.42, entranceDuration, { y: 18 }),
    pencilLine: {
      reveal: samplePencilEase(delayedProgress(time, 0.48, entranceDuration)),
    },
    ticks: {
      reveal: samplePencilEase(delayedProgress(time, 0.55, entranceDuration)),
    },
  }
}
