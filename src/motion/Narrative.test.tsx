import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Narrative } from './Narrative'
import type { NarrativeParams } from './types'

const getNarrativeState = vi.hoisted(() => vi.fn(() => ({
  cycle: 5.2,
  time: 0,
  line1: { opacity: 1, y: 0, blur: 0 },
  line2: { opacity: 1, y: 0, blur: 0 },
  ruleProgress: 1,
  explanation: { opacity: 1, y: 0, blur: 0 },
})))

vi.mock('./canvas/narrativeState', () => ({ getNarrativeState }))

const params: NarrativeParams = {
  line1: '把复杂的工作',
  line2: '交给自动化',
  explanation: '让系统处理重复步骤，人只负责判断与创造。',
  duration: 5.2,
}

describe('Narrative', () => {
  beforeEach(() => {
    getNarrativeState.mockClear()
  })

  it('uses the shared deterministic sampler for the live preview', () => {
    render(<Narrative params={params} />)

    expect(getNarrativeState).toHaveBeenCalledWith(params, expect.any(Number))
  })

  it('renders two headline rows and one explanation in the left primary zone', () => {
    render(<Narrative params={params} />)

    const primary = screen.getByTestId('narrative-primary')
    expect(primary).toHaveAttribute('data-zone', 'left-primary')
    expect(within(primary).getByText('把复杂的工作')).toBeInTheDocument()
    expect(within(primary).getByText('交给自动化')).toBeInTheDocument()
    expect(
      within(primary).getByText('让系统处理重复步骤，人只负责判断与创造。'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('narrative-secondary')).not.toBeInTheDocument()
  })

  it('uses stable fallback copy for empty values', () => {
    render(
      <Narrative
        params={{ ...params, line1: '', line2: '', explanation: '' }}
      />,
    )

    expect(screen.getByText('当前内容')).toBeInTheDocument()
    expect(screen.getByText('正在讲述')).toBeInTheDocument()
    expect(screen.getByText('补充当前视频内容的简短解释。')).toBeInTheDocument()
  })
})
