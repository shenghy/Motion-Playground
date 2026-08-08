import { delayedProgress } from '../../export/frameMath'
import { sampleCycle, samplePencilEase } from '../../export/canvas/timing'
import type { AudiencePollParams } from '../types'

const FALLBACK_OPTIONS = ['选项一', '选项二'] as const

function clampDuration(duration: number) {
  if (!Number.isFinite(duration)) return 6.2
  return Math.min(10, Math.max(4.8, duration))
}

function resolveOptions(params: AudiencePollParams) {
  const options = [params.option1, params.option2, params.option3, params.option4]
    .map((option) => option.trim())
    .filter(Boolean)
    .slice(0, 4)
  return options.length >= 2 ? options : [...FALLBACK_OPTIONS]
}

function exitOpacity(time: number, cycle: number) {
  const exitDuration = 0.55
  const exitStart = cycle - exitDuration
  if (time <= exitStart) return 1
  return Math.max(0, (cycle - time) / exitDuration)
}

function layer(time: number, cycle: number, start: number, duration: number) {
  const entered = samplePencilEase(delayedProgress(time, start, duration))
  const exit = exitOpacity(time, cycle)
  return {
    opacity: entered * exit,
    y: 14 * (1 - entered) - 4 * (1 - exit),
  }
}

export function getAudiencePollState(
  params: AudiencePollParams,
  localTime: number,
) {
  const cycle = clampDuration(params.duration)
  const time = Math.round(sampleCycle(localTime, cycle, 0.72) * 1e6) / 1e6
  const labels = resolveOptions(params)
  const optionStart = 0.86
  const optionStagger = 0.34
  const currentIndex = Math.max(
    0,
    Math.min(labels.length - 1, Math.floor((time - optionStart) / optionStagger)),
  )
  const options = labels.map((label, index) => {
    const sampled = layer(time, cycle, optionStart + index * optionStagger, 0.34)
    return {
      ...sampled,
      label,
      current: time >= optionStart && index === currentIndex && sampled.opacity > 0,
    }
  })
  const ctaStart = optionStart + labels.length * optionStagger + 0.18
  const cta = layer(time, cycle, ctaStart, 0.4)
  const pulse = cta.opacity > 0
    ? 1 + Math.sin(Math.max(0, time - ctaStart) * Math.PI * 1.25) * 0.012
    : 1

  return {
    cycle,
    time,
    header: layer(time, cycle, 0.1, 0.38),
    title: layer(time, cycle, 0.34, 0.44),
    options,
    cta: { ...cta, scale: pulse },
  }
}
