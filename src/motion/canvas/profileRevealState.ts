import { delayedProgress } from '../../export/frameMath'
import { sampleCycle, samplePencilEase } from '../../export/canvas/timing'
import type { ProfileRevealParams } from '../types'

function reveal(time: number, cycle: number, start: number) {
  const enterEnd = Math.min(0.82, (start + 0.38) / cycle) * cycle
  const exitStart = Math.max(enterEnd + 0.04 * cycle, cycle - 0.58)
  const entered = samplePencilEase(delayedProgress(time, start, Math.max(0.01, enterEnd - start)))
  if (time <= exitStart) return entered
  return entered * Math.max(0, (cycle - time) / Math.max(0.01, cycle - exitStart))
}

export function getProfileRevealState(params: ProfileRevealParams, localTime: number) {
  const cycle = Math.min(10, Math.max(5.2, params.duration))
  const time = Math.round(sampleCycle(localTime, cycle, 0.72) * 1e6) / 1e6
  const layer = (start: number, distance = 18) => {
    const opacity = reveal(time, cycle, start)
    return { opacity, y: distance * (1 - opacity) }
  }
  return {
    cycle,
    time,
    card: layer(0.08, 0),
    identity: layer(0.38),
    title: layer(0.86),
    facts: [0, 1, 2].map((index) => layer(1.58 + index * 0.68)),
    footer: layer(3.7, 8),
    rail: layer(3.28, -24),
  }
}
