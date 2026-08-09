import type { MotionId, ParameterValues } from './types'

function finitePositive(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0
}

export function getNominalPlaybackDuration(
  motionId: MotionId,
  params: ParameterValues,
) {
  if (motionId === 'compare-split') {
    const duration = finitePositive(params.duration)
    return duration === 0 ? 0 : Math.max(duration + 0.5, 1.92)
  }
  if (motionId !== 'step-flow') return finitePositive(params.duration)

  const stepCount = Array.from({ length: 7 }, (_, index) =>
    String(params[`step${index + 1}`] ?? '').trim())
    .filter(Boolean)
    .length
  const hold = Math.min(2.4, Math.max(0.7, finitePositive(params.stepDuration)))
  return Math.max(3, stepCount) * hold + 1.1
}

export function fitPlaybackTimeToCard(
  localTime: number,
  cardDuration: number,
  nominalDuration: number,
) {
  const safeTime = Number.isFinite(localTime) ? Math.max(0, localTime) : 0
  const safeCardDuration = finitePositive(cardDuration)
  const safeNominalDuration = finitePositive(nominalDuration)
  if (safeCardDuration === 0 || safeNominalDuration === 0) return safeTime

  const availableAnimationTime = safeCardDuration * 0.8
  if (safeNominalDuration <= availableAnimationTime) return safeTime
  return Math.min(
    safeNominalDuration,
    safeTime * safeNominalDuration / availableAnimationTime,
  )
}

export function getCardPlaybackTime(
  motionId: MotionId,
  params: ParameterValues,
  localTime: number,
  cardDuration: number,
) {
  return fitPlaybackTimeToCard(
    localTime,
    cardDuration,
    getNominalPlaybackDuration(motionId, params),
  )
}
