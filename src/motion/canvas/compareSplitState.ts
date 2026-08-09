import { delayedProgress } from '../../export/frameMath'
import { sampleCycle, samplePencilEase } from '../../export/canvas/timing'
import type { CompareSplitParams } from '../types'
import { formatCountUp } from '../useCountUp'

function clampDuration(duration: number) {
  if (!Number.isFinite(duration)) return 1.5
  return Math.min(3, Math.max(0.6, duration))
}

function clampSplit(split: number) {
  if (!Number.isFinite(split)) return 50
  return Math.min(68, Math.max(32, split))
}

function singlePulse(time: number, start: number, duration: number) {
  const elapsed = time - start
  if (elapsed <= 0 || elapsed >= duration) return 0
  return Math.sin((elapsed / duration) * Math.PI)
}

export function getCompareSplitState(
  params: CompareSplitParams,
  localTime: number,
) {
  const duration = clampDuration(params.duration)
  const cycle = duration + 1.8
  const time = Math.round(sampleCycle(localTime, cycle, 0.55) * 1e6) / 1e6
  const verticalSplit = clampSplit(params.split)
  const exitStart = cycle - 0.48
  const panelOpacity = time <= exitStart
    ? 1
    : Math.max(0, (cycle - time) / 0.48)
  const reveal = (start: number, span: number) => (
    samplePencilEase(delayedProgress(time, start, span)) * panelOpacity
  )

  return {
    cycle,
    time,
    panelOpacity,
    verticalSplit,
    headerOpacity: reveal(0.08, 0.34),
    upperOpacity: reveal(0.28, 0.36),
    lowerOpacity: reveal(0.78, 0.42),
    scanProgress: reveal(0.58, 0.42),
    upperValue: formatCountUp(params.leftValue, duration, 0, time),
    lowerValue: formatCountUp(
      params.rightValue,
      duration,
      0,
      Math.max(0, time - 0.5),
    ),
    lowerHighlight: singlePulse(time, 1.2, 0.72),
    resultOpacity: reveal(1.28, 0.38),
    emphasis: params.emphasis,
  }
}
