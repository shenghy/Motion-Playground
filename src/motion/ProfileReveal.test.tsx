import { render, screen } from '@testing-library/react'
import { ProfileReveal } from './ProfileReveal'
import type { ProfileRevealParams } from './types'

const params: ProfileRevealParams = {
  category: 'MAKER / FIELD NOTE',
  descriptor: '独立开发者 · 产品构建者',
  overline: 'BUILD IN PUBLIC',
  title: '公开构建者',
  fact1: '没有庞大团队',
  fact1Note: 'NO LARGE TEAM',
  fact2: '没有巨额预算',
  fact2Note: 'NO MASSIVE BUDGET',
  fact3: '只靠持续交付',
  fact3Note: 'SHIP EVERY WEEK',
  status: 'PROFILE / VERIFIED',
  duration: 6.4,
}

describe('ProfileReveal', () => {
  it('renders a hierarchical profile with sequential facts in safe zones', () => {
    render(<ProfileReveal params={params} />)

    expect(screen.getByText('MAKER / FIELD NOTE')).toBeInTheDocument()
    expect(screen.getByText('独立开发者 · 产品构建者')).toBeInTheDocument()
    expect(screen.getByText('BUILD IN PUBLIC')).toBeInTheDocument()
    expect(screen.getByText('公开构建者')).toBeInTheDocument()
    expect(screen.getByText('没有庞大团队')).toBeInTheDocument()
    expect(screen.getByText('没有巨额预算')).toBeInTheDocument()
    expect(screen.getByText('只靠持续交付')).toBeInTheDocument()
    expect(screen.getByText('PROFILE / VERIFIED')).toBeInTheDocument()
    expect(screen.getByTestId('profile-primary')).toHaveAttribute(
      'data-zone',
      'left-primary',
    )
    expect(screen.getByTestId('profile-primary')).toHaveAttribute(
      'data-pencil-layout',
      'field-note',
    )
    expect(screen.getAllByTestId('profile-check')).toHaveLength(3)
    expect(screen.getByTestId('profile-secondary')).toHaveAttribute(
      'data-zone',
      'right-secondary',
    )
    expect(screen.getByTestId('profile-secondary')).toHaveAttribute(
      'data-safe-motion',
      'upward',
    )
  })
})
