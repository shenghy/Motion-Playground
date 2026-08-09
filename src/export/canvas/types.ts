export interface CanvasRenderResources {
  width: 1920
  height: 1080
  displayFont: string
  monoFont: string
  contentFont: string
}

export interface CanvasFrameRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CanvasMotionRenderInput<T> {
  ctx: CanvasRenderingContext2D
  params: T
  localTime: number
  localDuration?: number
  resources: CanvasRenderResources
}

export type CanvasMotionRenderer<T> = (
  input: CanvasMotionRenderInput<T>,
) => void
