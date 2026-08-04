import { delayedProgress } from '../../export/frameMath'
import { samplePencilEase } from '../../export/canvas/timing'
import type { CompareSplitParams } from '../types'
import { formatCountUp } from '../useCountUp'

export function getCompareSplitState(params: CompareSplitParams, localTime: number) {
  const time = Number.isFinite(localTime) ? Math.max(0, localTime) : 0
  const duration = Math.max(0.2, params.duration)
  const entrance = duration * 0.45
  const split = Math.min(68, Math.max(32, params.split))
  const primaryWidth = 27 + ((split - 32) / 36) * 7
  const reveal = (delay: number) => samplePencilEase(delayedProgress(time, delay, entrance))
  return {
    split,
    primaryWidth,
    emphasis: params.emphasis,
    leftValue: formatCountUp(params.leftValue, duration, 0, time),
    rightValue: formatCountUp(params.rightValue, duration, 0, time),
    headerOpacity: reveal(0.12),
    leftReveal: reveal(0.1),
    rightReveal: reveal(0.22),
    leftMeter: Math.max(0.08, params.leftValue / 100) * reveal(0.36),
    rightMeter: Math.max(0.08, params.rightValue / 100) * reveal(0.48),
    strikeReveal: reveal(0.5),
    resultOpacity: reveal(0.62),
  }
}
