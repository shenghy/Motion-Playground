import { render, screen } from '@testing-library/react'
import { PencilTexture } from './PencilTexture'

describe('PencilTexture', () => {
  it('renders decorative graphite grain without exposing it to assistive technology', () => {
    render(<PencilTexture variant="hatch" />)

    expect(screen.getByTestId('pencil-texture')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(screen.getByTestId('pencil-texture')).toHaveAttribute(
      'data-variant',
      'hatch',
    )
  })
})
