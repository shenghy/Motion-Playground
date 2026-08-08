import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AudiencePoll } from './AudiencePoll'
import type { AudiencePollParams } from './types'

const getAudiencePollState = vi.hoisted(() => vi.fn((_params, time: number) => ({
  cycle: 6.2,
  time,
  panelOpacity: time >= 6.2 ? 0 : 1,
  header: { opacity: 1, y: 0 },
  title: { opacity: 1, y: 0 },
  options: [
    { label: 'AI 辅助开发', opacity: 1, y: 0, current: false },
    { label: '传统手写代码', opacity: 1, y: 0, current: true },
    { label: '两者结合', opacity: 0.5, y: 8, current: false },
  ],
  cta: { opacity: 1, y: 0, scale: 1.01 },
})))

vi.mock('./canvas/audiencePollState', () => ({ getAudiencePollState }))

const params: AudiencePollParams = {
  eyebrow: '08 / LIVE POLL',
  title: '你更看好哪种开发方式？',
  option1: 'AI 辅助开发',
  option2: '传统手写代码',
  option3: '两者结合',
  option4: '',
  callToAction: '把编号打在弹幕或评论区，告诉我你的选择',
  duration: 6.2,
}

describe('AudiencePoll', () => {
  beforeEach(() => getAudiencePollState.mockClear())

  it('uses the shared deterministic sampler for live and explicit playback', () => {
    const { rerender } = render(<AudiencePoll params={params} />)
    expect(getAudiencePollState).toHaveBeenCalledWith(params, expect.any(Number))

    rerender(<AudiencePoll params={params} playbackTime={3.4} />)
    expect(getAudiencePollState).toHaveBeenCalledWith(params, 3.4)
  })

  it('renders the sampler-filtered numbered options in one left primary zone', () => {
    render(<AudiencePoll params={params} playbackTime={2} />)

    const primary = screen.getByTestId('audience-poll-primary')
    expect(primary).toHaveAttribute('data-zone', 'left-primary')
    expect(within(primary).getByText('08 / LIVE POLL')).toBeInTheDocument()
    expect(within(primary).getByText('你更看好哪种开发方式？')).toBeInTheDocument()
    expect(within(primary).getAllByRole('listitem')).toHaveLength(3)
    expect(within(primary).getByText('01')).toBeInTheDocument()
    expect(within(primary).getByText('传统手写代码').closest('li'))
      .toHaveAttribute('data-current', 'true')
    expect(screen.queryByTestId('audience-poll-secondary')).not.toBeInTheDocument()
  })

  it('fully hides the independent panel background at the cycle exit', () => {
    render(<AudiencePoll params={params} playbackTime={6.2} />)

    expect(screen.getByTestId('audience-poll-panel')).toHaveStyle({ opacity: 0 })
  })
})
