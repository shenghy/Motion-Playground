import type { MotionId, ParameterValues } from '../motion/types'

export interface OverlayPosition {
  x: number
  y: number
}

export interface OverlayCard {
  id: string
  motionId: MotionId
  start: number
  end: number
  position: OverlayPosition
  zIndex: number
  params: ParameterValues
}

export interface OverlayProject {
  version: 1
  canvas: {
    width: 1920
    height: 1080
  }
  cards: OverlayCard[]
}
