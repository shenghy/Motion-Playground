import type { MotionId, ParameterValue, ParameterValues } from '../motion/types'
import type { OverlayCard, OverlayPosition, OverlayProject } from './types'

export const MIN_CARD_DURATION = 0.2
export const DEFAULT_CARD_DURATION = 3

const TIMING_EPSILON = 1e-9
const INVALID_PROJECT_MESSAGE = 'JSON 项目格式无效'
const VIDEO_TOO_SHORT_MESSAGE = '视频时长不足'

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function clampPercentage(value: number) {
  return clamp(value, 0, 100)
}

function assertSufficientVideoDuration(videoDuration: number) {
  if (!Number.isFinite(videoDuration) || videoDuration < MIN_CARD_DURATION) {
    throw new Error(VIDEO_TOO_SHORT_MESSAGE)
  }
}

function invalidProject(): never {
  throw new Error(INVALID_PROJECT_MESSAGE)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
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
  return (
    Object.prototype.hasOwnProperty.call(defaultsByMotion, motionId) &&
    isParameterValues(
      (defaultsByMotion as Record<string, ParameterValues | undefined>)[motionId],
    )
  )
}

function paramsMatchDefaults(
  params: unknown,
  defaults: ParameterValues,
): params is ParameterValues {
  return (
    isParameterValues(params) &&
    Object.entries(params).every(
      ([key, value]) =>
        Object.prototype.hasOwnProperty.call(defaults, key) &&
        typeof value === typeof defaults[key],
    )
  )
}

export function createOverlayCard(
  id: string,
  motionId: MotionId,
  start: number,
  videoDuration: number,
  zIndex: number,
  defaults: ParameterValues,
): OverlayCard {
  assertSufficientVideoDuration(videoDuration)

  const requestedStart = Number.isFinite(start) ? Math.max(0, start) : 0
  const safeStart = clamp(requestedStart, 0, videoDuration - MIN_CARD_DURATION)

  return {
    id,
    motionId,
    start: safeStart,
    end: Math.min(safeStart + DEFAULT_CARD_DURATION, videoDuration),
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
  assertSufficientVideoDuration(videoDuration)

  const duration = clamp(
    card.end - card.start,
    MIN_CARD_DURATION,
    videoDuration,
  )
  const safeNextStart = Number.isFinite(nextStart) ? nextStart : card.start
  const start = clamp(safeNextStart, 0, videoDuration - duration)

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
  assertSufficientVideoDuration(videoDuration)

  const safeTime = Number.isFinite(time) ? time : edge === 'start' ? card.start : card.end

  if (edge === 'start') {
    const end = clamp(card.end, MIN_CARD_DURATION, videoDuration)

    return {
      ...card,
      start: clamp(safeTime, 0, end - MIN_CARD_DURATION),
      end,
    }
  }

  const start = clamp(card.start, 0, videoDuration - MIN_CARD_DURATION)

  return {
    ...card,
    start,
    end: clamp(safeTime, start + MIN_CARD_DURATION, videoDuration),
  }
}

export function updateCardPosition(
  card: OverlayCard,
  position: OverlayPosition,
): OverlayCard {
  return {
    ...card,
    position: {
      x: Number.isFinite(position.x)
        ? clampPercentage(position.x)
        : clampPercentage(Number.isFinite(card.position.x) ? card.position.x : 0),
      y: Number.isFinite(position.y)
        ? clampPercentage(position.y)
        : clampPercentage(Number.isFinite(card.position.y) ? card.position.y : 0),
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

  const cardIds = new Set<string>()
  const cards = parsed.cards.map((candidate): OverlayCard => {
    if (
      !isRecord(candidate) ||
      typeof candidate.id !== 'string' ||
      candidate.id.trim() === '' ||
      cardIds.has(candidate.id) ||
      typeof candidate.motionId !== 'string' ||
      !hasMotionDefaults(defaultsByMotion, candidate.motionId) ||
      !isFiniteNumber(candidate.start) ||
      candidate.start < 0 ||
      !isFiniteNumber(candidate.end) ||
      candidate.end - candidate.start < MIN_CARD_DURATION - TIMING_EPSILON ||
      !isFiniteNumber(candidate.zIndex) ||
      !isRecord(candidate.position) ||
      !isFiniteNumber(candidate.position.x) ||
      !isFiniteNumber(candidate.position.y) ||
      !paramsMatchDefaults(
        candidate.params,
        defaultsByMotion[candidate.motionId] as ParameterValues,
      )
    ) {
      return invalidProject()
    }

    cardIds.add(candidate.id)
    const defaults = defaultsByMotion[candidate.motionId] as ParameterValues

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
        ...defaults,
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
