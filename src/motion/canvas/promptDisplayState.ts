import { samplePencilEase } from '../../export/canvas/timing'
import type { PromptDisplayParams } from '../types'

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function safeHoldDuration(value: number) {
  if (!Number.isFinite(value)) return 2
  return Math.min(3, Math.max(1, value))
}

function safeExitDuration(value: number) {
  return Number.isFinite(value) && value >= 0.1 && value <= 0.3 ? value : 0.18
}

export function getPromptDisplayState(
  params: PromptDisplayParams,
  localTime: number,
  localDuration: number | undefined,
  totalGlyphs: number,
) {
  const holdDuration = safeHoldDuration(params.holdDuration)
  const exitDuration = safeExitDuration(params.exitDuration)
  const fallbackDuration = 6 + holdDuration + exitDuration
  const duration = typeof localDuration === 'number'
    && Number.isFinite(localDuration)
    && localDuration > 0
    ? localDuration
    : fallbackDuration
  const time = Number.isFinite(localTime)
    ? Math.min(duration, Math.max(0, localTime))
    : 0
  const typingDuration = Math.max(0, duration - holdDuration - exitDuration)
  const glyphCount = Number.isFinite(totalGlyphs)
    ? Math.max(0, Math.floor(totalGlyphs))
    : 0
  const typingProgress = typingDuration > 0 ? clamp01(time / typingDuration) : 1
  const visibleGlyphs = glyphCount === 0
    ? 0
    : Math.min(glyphCount, Math.max(1, Math.ceil(glyphCount * typingProgress)))
  const exitStart = typingDuration + holdDuration
  const exitProgress = time <= exitStart
    ? 0
    : clamp01((time - exitStart) / exitDuration)
  const phase = time < typingDuration
    ? 'typing'
    : time < exitStart
      ? 'holding'
      : 'exiting'

  return {
    localDuration: duration,
    localTime: time,
    holdDuration,
    exitDuration,
    typingDuration,
    visibleGlyphs,
    cursorVisible: phase === 'typing' && glyphCount > 0,
    entranceProgress: samplePencilEase(clamp01(time / 0.24)),
    opacity: 1 - samplePencilEase(exitProgress),
    phase: phase as 'typing' | 'holding' | 'exiting',
  }
}

export function getPromptScrollOffset(
  localTime: number,
  typingDuration: number,
  totalGlyphs: number,
  lineStartIndices: number[],
  visibleLineCount: number,
  lineHeight: number,
) {
  const time = Number.isFinite(localTime) ? Math.max(0, localTime) : 0
  const duration = Number.isFinite(typingDuration) ? Math.max(0, typingDuration) : 0
  const glyphCount = Number.isFinite(totalGlyphs) ? Math.max(0, totalGlyphs) : 0
  const capacity = Number.isFinite(visibleLineCount)
    ? Math.max(1, Math.floor(visibleLineCount))
    : 1
  const distance = Number.isFinite(lineHeight) ? Math.max(0, lineHeight) : 0
  if (duration === 0 || glyphCount === 0 || distance === 0) return 0

  return lineStartIndices.slice(capacity).reduce((offset, revealIndex) => {
    const revealTime = duration * Math.max(0, revealIndex) / glyphCount
    const progress = samplePencilEase(clamp01((time - revealTime) / 0.18))
    return offset + distance * progress
  }, 0)
}
