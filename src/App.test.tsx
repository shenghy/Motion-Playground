import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the motion playground shell', () => {
    render(<App />)
    expect(screen.getByText('动效预览台')).toBeInTheDocument()
    expect(document.title).toBe('动效预览台')
  })
})
