import type { OverlayCard } from '../timeline/types'

export const EXPORT_WIDTH = 1920
export const EXPORT_HEIGHT = 1080
export const EXPORT_FPS = 30

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function calculateFrameCount(
  duration: number,
  fps = EXPORT_FPS,
) {
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(fps) ||
    fps <= 0
  ) {
    return 0
  }
  return Math.ceil(duration * fps)
}

export function calculateFrameTime(
  frameIndex: number,
  fps = EXPORT_FPS,
) {
  if (!Number.isFinite(frameIndex) || !Number.isFinite(fps) || fps <= 0) {
    return 0
  }
  return Math.max(0, frameIndex) / fps
}

export function getCardPlaybackState(
  card: Pick<OverlayCard, 'start' | 'end'>,
  frameTime: number,
) {
  const safeTime = Number.isFinite(frameTime) ? Math.max(0, frameTime) : 0
  const start = Number.isFinite(card.start) ? Math.max(0, card.start) : 0
  const end = Number.isFinite(card.end) ? Math.max(start, card.end) : start
  return {
    active: start <= safeTime && safeTime < end,
    localTime: Math.min(end - start, Math.max(0, safeTime - start)),
  }
}

export function delayedProgress(
  time: number,
  delay: number,
  duration: number,
) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return time >= delay ? 1 : 0
  }
  return clamp01((time - delay) / duration)
}

export function easeOutQuart(progress: number) {
  const value = clamp01(progress)
  return 1 - (1 - value) ** 4
}

export function interpolateKeyframes(
  progress: number,
  values: number[],
  times?: number[],
) {
  if (values.length === 0) return 0
  if (values.length === 1) return Number.isFinite(values[0]) ? values[0] : 0

  const safeProgress = clamp01(progress)
  const stops =
    times?.length === values.length
      ? times.map(clamp01)
      : values.map((_, index) => index / (values.length - 1))

  let segment = stops.length - 2
  for (let index = 0; index < stops.length - 1; index += 1) {
    if (safeProgress <= stops[index + 1]) {
      segment = index
      break
    }
  }

  const fromTime = stops[segment]
  const toTime = stops[segment + 1]
  const span = toTime - fromTime
  const segmentProgress =
    span <= 0 ? 1 : clamp01((safeProgress - fromTime) / span)
  const from = Number.isFinite(values[segment]) ? values[segment] : 0
  const to = Number.isFinite(values[segment + 1])
    ? values[segment + 1]
    : from
  return from + (to - from) * segmentProgress
}
