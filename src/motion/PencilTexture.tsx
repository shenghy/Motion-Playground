interface PencilTextureProps {
  variant?: 'grain' | 'hatch' | 'eraser'
}

export function PencilTexture({ variant = 'grain' }: PencilTextureProps) {
  return (
    <div
      className="pencil-texture"
      data-testid="pencil-texture"
      data-variant={variant}
      aria-hidden="true"
    >
      <i />
      <i />
      <i />
    </div>
  )
}
