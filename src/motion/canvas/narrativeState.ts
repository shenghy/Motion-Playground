import { delayedProgress } from '../../export/frameMath'
import { sampleCycle, samplePencilEase } from '../../export/canvas/timing'
import type { NarrativeParams } from '../types'

interface NarrativeLayerState {
  opacity: number
  y: number
  blur: number
}

function clampDuration(duration: number) {
  if (!Number.isFinite(duration)) return 5.2
  return Math.min(8, Math.max(3.2, duration))
}

function exitOpacity(time: number, cycle: number) {
  const exitDuration = 0.55
  const exitStart = cycle - exitDuration
  if (time <= exitStart) return 1
  return Math.max(0, (cycle - time) / exitDuration)
}

function layer(
  time: number,
  cycle: number,
  start: number,
  entranceDuration = 0.44,
): NarrativeLayerState {
  const entered = samplePencilEase(
    delayedProgress(time, start, entranceDuration),
  )
  const opacity = entered * exitOpacity(time, cycle)
  return {
    opacity,
    y: 22 * (1 - entered) - 6 * (1 - exitOpacity(time, cycle)),
    blur: 10 * (1 - entered),
  }
}

export function getNarrativeState(
  params: NarrativeParams,
  localTime: number,
) {
  const cycle = clampDuration(params.duration)
  const time = Math.round(sampleCycle(localTime, cycle, 0.72) * 1e6) / 1e6
  const exit = exitOpacity(time, cycle)
  const ruleEntered = samplePencilEase(delayedProgress(time, 0.82, 0.38))

  return {
    cycle,
    time,
    line1: layer(time, cycle, 0.18),
    line2: layer(time, cycle, 0.46),
    ruleProgress: ruleEntered * exit,
    explanation: layer(time, cycle, 1.04, 0.42),
  }
}
