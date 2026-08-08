export interface CanvasRenderResources {
  width: 1920
  height: 1080
  displayFont: string
  monoFont: string
  contentFont: string
}

export interface CanvasMotionRenderInput<T> {
  ctx: CanvasRenderingContext2D
  params: T
  localTime: number
  resources: CanvasRenderResources
}

export type CanvasMotionRenderer<T> = (
  input: CanvasMotionRenderInput<T>,
) => void
