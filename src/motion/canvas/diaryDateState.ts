import { delayedProgress } from '../../export/frameMath'
import { sampleOnce, samplePencilEase } from '../../export/canvas/timing'
import type { DiaryDateParams } from '../types'

interface DiaryDateLayerState {
  opacity: number
  y: number
  blur: number
}

function clampDuration(duration: number) {
  if (!Number.isFinite(duration)) return 4.2
  return Math.min(8, Math.max(3.2, duration))
}

function layer(
  time: number,
  start: number,
  entranceDuration = 0.44,
): DiaryDateLayerState {
  const entered = samplePencilEase(
    delayedProgress(time, start, entranceDuration),
  )
  return {
    opacity: entered,
    y: 22 * (1 - entered),
    blur: 10 * (1 - entered),
  }
}

export function getDiaryDateState(
  params: DiaryDateParams,
  localTime: number,
) {
  const cycle = clampDuration(params.duration)
  const time = Math.round(sampleOnce(localTime, cycle) * 1e6) / 1e6
  const ruleEntered = samplePencilEase(delayedProgress(time, 0.82, 0.38))

  return {
    cycle,
    time,
    eyebrow: layer(time, 0.18),
    ruleProgress: ruleEntered,
    dateLine: layer(time, 0.42),
    note: layer(time, 1.04, 0.42),
  }
}
