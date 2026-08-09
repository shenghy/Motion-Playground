import { motionRegistry } from '../motion/registry'
import type { MotionId, ParameterValues } from '../motion/types'
import type { PersistedWorkspaceV1 } from '../persistence/workspaceStorage'
import type { OverlayCard } from '../timeline/types'
import type { VideoPreview } from './useVideoController'

export const MOTION_NAMES = Object.fromEntries(
  motionRegistry.map((definition) => [definition.id, definition.name]),
) as Record<MotionId, string>

export const MOTION_COLORS = Object.fromEntries(
  motionRegistry.map((definition) => [definition.id, definition.timelineColor]),
) as Record<MotionId, string>

export const MOTION_DEFAULTS = Object.fromEntries(
  motionRegistry.map((definition) => [definition.id, definition.defaults]),
) as unknown as Record<MotionId, ParameterValues>

export function createBrowserCardId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `overlay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function createUniqueCardId(cards: OverlayCard[], idFactory: () => string) {
  const requestedId = idFactory()
  if (requestedId.trim() !== '' && !cards.some((card) => card.id === requestedId)) {
    return requestedId
  }
  let fallbackId = createBrowserCardId()
  while (cards.some((card) => card.id === fallbackId)) {
    fallbackId = createBrowserCardId()
  }
  return fallbackId
}

export function cloneOverlayCards(cards: OverlayCard[]) {
  return cards.map((card) => ({
    ...card,
    position: { ...card.position },
    params: { ...card.params },
  }))
}

export function exportFingerprint(cards: OverlayCard[], duration: number) {
  return JSON.stringify({ duration, cards })
}

export function isEditableDeleteTarget(target: EventTarget | null) {
  return typeof HTMLElement !== 'undefined'
    && target instanceof HTMLElement
    && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export function createWorkspaceSnapshot(
  cards: OverlayCard[],
  parametersByMotion: Record<MotionId, ParameterValues>,
  activeId: MotionId,
  showSafeArea: boolean,
  video: VideoPreview | null,
): PersistedWorkspaceV1 {
  return {
    version: 1,
    project: { version: 1, canvas: { width: 1920, height: 1080 }, cards },
    parametersByMotion,
    activeId,
    showSafeArea,
    video: video
      ? {
          present: true,
          name: video.name,
          type: video.type,
          lastModified: video.lastModified,
        }
      : { present: false },
  }
}
