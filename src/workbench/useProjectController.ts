import { useState } from 'react'
import { motionRegistry } from '../motion/registry'
import type { MotionId, ParameterValues } from '../motion/types'
import type { OverlayCard } from '../timeline/types'

export interface OverlayWorkspaceState {
  cards: OverlayCard[]
  selectedCardId: string | null
  playbackKeys: Record<string, number>
}

export function createInitialParameters() {
  return Object.fromEntries(
    motionRegistry.map(({ id, defaults }) => [id, { ...defaults }]),
  ) as unknown as Record<MotionId, ParameterValues>
}

export function createOverlayWorkspaceState(): OverlayWorkspaceState {
  return { cards: [], selectedCardId: null, playbackKeys: {} }
}

export function createMotionPlaybackKeys() {
  return Object.fromEntries(
    motionRegistry.map(({ id }) => [id, 0]),
  ) as Record<MotionId, number>
}

export function useProjectController() {
  const [activeId, setActiveId] = useState<MotionId>('metric-focus')
  const [showSafeArea, setShowSafeArea] = useState(true)
  const [parameters, setParameters] = useState(createInitialParameters)
  const [overlayWorkspace, setOverlayWorkspace] = useState(
    createOverlayWorkspaceState,
  )
  const [projectError, setProjectError] = useState('')
  const [playbackKeys, setPlaybackKeys] = useState(createMotionPlaybackKeys)

  return {
    activeId,
    setActiveId,
    showSafeArea,
    setShowSafeArea,
    parameters,
    setParameters,
    overlayWorkspace,
    setOverlayWorkspace,
    projectError,
    setProjectError,
    playbackKeys,
    setPlaybackKeys,
  }
}
