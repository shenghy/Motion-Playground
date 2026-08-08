import { delayedProgress } from '../../export/frameMath'
import { sampleCycle, samplePencilEase } from '../../export/canvas/timing'
import { resolveFocusIndex } from '../dataMath'
import type { StepFlowParams } from '../types'

export function getStepFlowState(params: StepFlowParams, localTime: number) {
  const source = [
    params.step1,
    params.step2,
    params.step3,
    params.step4,
    params.step5,
    params.step6,
    params.step7,
  ]
    .map((step) => step.trim()).filter(Boolean).slice(0, 7)
  const steps = source.length >= 3 ? source : ['明确目标', '执行方案', '验证结果']
  const focusIndex = resolveFocusIndex(steps.map(() => 1), params.focusStep)
  const orderedIndexes = Array.from(
    { length: steps.length },
    (_, offset) => (focusIndex + offset) % steps.length,
  )
  const hold = Math.min(2.4, Math.max(0.7, params.stepDuration))
  const cycle = steps.length * hold + 1.1
  const time = Math.round(sampleCycle(localTime, cycle, 0.72) * 1e6) / 1e6
  const headerOpacity = samplePencilEase(delayedProgress(time, 0, cycle * 0.08))
    * (time > cycle * 0.91 ? Math.max(0, (cycle - time) / (cycle * 0.09)) : 1)
  const connectorReveal = samplePencilEase(delayedProgress(time, 0, cycle * 0.9))
  const items = steps.map((label, index) => {
    const order = orderedIndexes.indexOf(index)
    const start = 0.42 + order * hold
    const end = start + hold
    const entering = samplePencilEase(delayedProgress(time, start, 0.18))
    const leaving = time <= end - 0.18
      ? 1
      : 1 - samplePencilEase(delayedProgress(time, end - 0.18, 0.18))
    const active = Math.max(0, Math.min(entering, leaving))
    const completed = time >= end
    return {
      label,
      index,
      order,
      active,
      completed,
      opacity: active > 0 ? 0.4 + active * 0.6 : completed ? 0.68 : 0.4,
      scale: 1 + active * 0.1,
    }
  })
  return { cycle, time, steps, focusIndex, orderedIndexes, headerOpacity, connectorReveal, items }
}
