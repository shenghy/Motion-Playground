import type { MotionId, ParameterValue, ParameterValues } from '../motion/types'
import type { OverlayCard, OverlayPosition, OverlayProject } from './types'

export const MIN_CARD_DURATION = 0.2
export const DEFAULT_CARD_DURATION = 3

const INVALID_PROJECT_MESSAGE = 'JSON 项目格式无效'
let nextOverlayCardId = 1

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function clampPercentage(value: number) {
  return clamp(value, 0, 100)
}

function invalidProject(): never {
  throw new Error(INVALID_PROJECT_MESSAGE)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isParameterValues(value: unknown): value is ParameterValues {
  if (!isRecord(value)) {
    return false
  }

  return Object.values(value).every(
    (parameter): parameter is ParameterValue =>
      typeof parameter === 'string' || isFiniteNumber(parameter),
  )
}

function hasMotionDefaults(
  defaultsByMotion: Partial<Record<MotionId, ParameterValues>>,
  motionId: string,
): motionId is MotionId {
  return Object.prototype.hasOwnProperty.call(defaultsByMotion, motionId)
}

export function createOverlayCard(
  motionId: MotionId,
  start: number,
  videoDuration: number,
  zIndex: number,
  defaults: ParameterValues,
): OverlayCard {
  const requestedStart = Number.isFinite(start) ? Math.max(0, start) : 0
  const hasVideoDuration = Number.isFinite(videoDuration) && videoDuration > 0
  const upperBound = hasVideoDuration ? videoDuration : requestedStart + DEFAULT_CARD_DURATION
  const safeStart = clamp(requestedStart, 0, upperBound)

  return {
    id: `overlay-${nextOverlayCardId++}`,
    motionId,
    start: safeStart,
    end: Math.min(safeStart + DEFAULT_CARD_DURATION, upperBound),
    position: { x: 0, y: 0 },
    zIndex,
    params: { ...defaults },
  }
}

export function getActiveCards(cards: OverlayCard[], currentTime: number) {
  return cards
    .filter((card) => card.start <= currentTime && currentTime < card.end)
    .sort((left, right) => left.zIndex - right.zIndex)
}

export function moveCardTiming(
  card: OverlayCard,
  nextStart: number,
  videoDuration: number,
): OverlayCard {
  const maximumEnd = Math.max(0, Number.isFinite(videoDuration) ? videoDuration : card.end)
  const duration = Math.min(Math.max(0, card.end - card.start), maximumEnd)
  const safeNextStart = Number.isFinite(nextStart) ? nextStart : card.start
  const start = clamp(safeNextStart, 0, maximumEnd - duration)

  return {
    ...card,
    start,
    end: start + duration,
  }
}

export function resizeCardTiming(
  card: OverlayCard,
  edge: 'start' | 'end',
  time: number,
  videoDuration: number,
): OverlayCard {
  const maximumEnd = Math.max(0, Number.isFinite(videoDuration) ? videoDuration : card.end)
  const safeTime = Number.isFinite(time) ? time : edge === 'start' ? card.start : card.end

  if (edge === 'start') {
    const end = Math.min(card.end, maximumEnd)

    return {
      ...card,
      start: clamp(safeTime, 0, Math.max(0, end - MIN_CARD_DURATION)),
      end,
    }
  }

  return {
    ...card,
    end: clamp(
      safeTime,
      Math.min(maximumEnd, card.start + MIN_CARD_DURATION),
      maximumEnd,
    ),
  }
}

export function updateCardPosition(
  card: OverlayCard,
  position: OverlayPosition,
): OverlayCard {
  return {
    ...card,
    position: {
      x: clampPercentage(position.x),
      y: clampPercentage(position.y),
    },
  }
}

export function parseOverlayProject(
  text: string,
  defaultsByMotion: Partial<Record<MotionId, ParameterValues>>,
): OverlayProject {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return invalidProject()
  }

  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    !isRecord(parsed.canvas) ||
    parsed.canvas.width !== 1920 ||
    parsed.canvas.height !== 1080 ||
    !Array.isArray(parsed.cards)
  ) {
    return invalidProject()
  }

  const cards = parsed.cards.map((candidate): OverlayCard => {
    if (
      !isRecord(candidate) ||
      typeof candidate.id !== 'string' ||
      typeof candidate.motionId !== 'string' ||
      !hasMotionDefaults(defaultsByMotion, candidate.motionId) ||
      !isFiniteNumber(candidate.start) ||
      !isFiniteNumber(candidate.end) ||
      candidate.end <= candidate.start ||
      !isFiniteNumber(candidate.zIndex) ||
      !isRecord(candidate.position) ||
      !isFiniteNumber(candidate.position.x) ||
      !isFiniteNumber(candidate.position.y) ||
      !isParameterValues(candidate.params)
    ) {
      return invalidProject()
    }

    return {
      id: candidate.id,
      motionId: candidate.motionId,
      start: candidate.start,
      end: candidate.end,
      position: {
        x: clampPercentage(candidate.position.x),
        y: clampPercentage(candidate.position.y),
      },
      zIndex: candidate.zIndex,
      params: {
        ...defaultsByMotion[candidate.motionId],
        ...candidate.params,
      },
    }
  })

  return {
    version: 1,
    canvas: { width: 1920, height: 1080 },
    cards,
  }
}
