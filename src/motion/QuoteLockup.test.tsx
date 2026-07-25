import { render, screen } from '@testing-library/react'
import { QuoteLockup } from './QuoteLockup'
import type { QuoteLockupParams } from './types'

const params: QuoteLockupParams = {
  eyebrow: 'FIELD NOTE / 08',
  quote: '真正的效率，不是做得更快，而是更少地做错。',
  author: 'JSPANG',
  role: 'INDEPENDENT CREATOR',
  align: 'left',
  maxWidth: 1180,
  duration: 1.6,
}

describe('QuoteLockup', () => {
  it('frames the quote and author with the selected alignment and width', () => {
    render(<QuoteLockup params={params} />)

    const quote = screen.getByText(params.quote)
    expect(quote).toHaveStyle({ maxWidth: '1180px', textAlign: 'left' })
    expect(screen.getByText('JSPANG')).toBeInTheDocument()
    expect(screen.getByText('INDEPENDENT CREATOR')).toBeInTheDocument()
    expect(screen.getByTestId('quote-primary')).toHaveAttribute(
      'data-zone',
      'left-primary',
    )
    expect(screen.getByTestId('quote-secondary')).toHaveAttribute(
      'data-zone',
      'right-secondary',
    )
  })
})
