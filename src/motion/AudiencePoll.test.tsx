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

  it('does not publish a stale current option in live mode', () => {
    const { container } = render(<AudiencePoll params={params} />)

    expect(container.querySelectorAll('[data-current]')).toHaveLength(0)
  })

  it('renders the sampler-filtered numbered options in one left primary zone', () => {
    render(<AudiencePoll params={params} playbackTime={2} />)

    const primary = screen.getByTestId('audience-poll-primary')
    expect(primary).toHaveAttribute('data-zone', 'left-primary')
    expect(within(primary).getByText('08 / LIVE POLL')).toBeInTheDocument()
    expect(within(primary).getByRole('heading', { name: params.title })).toBeInTheDocument()
    expect(within(primary).getAllByRole('listitem')).toHaveLength(3)
    expect(within(primary).getByText('01')).toBeInTheDocument()
    expect(within(primary).getByText('传统手写代码').closest('li'))
      .toHaveAttribute('data-current', 'true')
    expect(screen.queryByTestId('audience-poll-secondary')).not.toBeInTheDocument()
  })

  it('keeps the panel visible at the cycle exit when reduced motion is preferred', () => {
    render(<AudiencePoll params={params} playbackTime={6.2} />)

    expect(screen.getByTestId('audience-poll-panel')).toHaveStyle({ opacity: 1 })
  })

  it('renders the shared deterministic title lines and typography contract', () => {
    const title = '这是一个需要稳定换行展示的中文投票问题吗'
    const { container } = render(
      <AudiencePoll params={{ ...params, title }} playbackTime={2} />,
    )
    const heading = container.querySelector('.audience-poll__card > h2')
    const lines = heading?.querySelectorAll('[data-poll-title-line]') ?? []

    expect(Array.from(lines, (line) => line.textContent)).toEqual([
      '这是一个需要稳定换行',
      '展示的中文投票问题吗',
    ])
    expect(heading).toHaveStyle({
      fontWeight: '500',
      letterSpacing: '0.025em',
      textWrap: 'nowrap',
    })
    expect(container.querySelector('.audience-poll__option .motion-content-text'))
      .toHaveStyle({ fontWeight: '500', letterSpacing: '0.035em' })
    expect(container.querySelector('.audience-poll__cta'))
      .toHaveStyle({ fontWeight: '500', letterSpacing: '0.035em' })
  })

  it.each([
    ['wide Latin', 'WWWWWWWWWWWWWWWWWWWW', ['WWWWWWWWWW', 'WWWWWWWWWW']],
    ['lowercase m', 'mmmmmmmmmmmmmmmmmmmm', ['mmmmmmmmmm', 'mmmmmmmmmm']],
    ['lowercase w', 'wwwwwwwwwwwwwwwwwwww', ['wwwwwwwwww', 'wwwwwwwwww']],
    ['at sign', '@@@@@@@@@@@@@@@@@@@@', ['@@@@@@@@@@', '@@@@@@@@@@']],
    ['percent sign', '%%%%%%%%%%%%%%%%%%%%', ['%%%%%%%%%%', '%%%%%%%%%%']],
    ['over-limit ZWJ', '👨‍👩‍👧‍👦'.repeat(6), ['👨‍👩‍👧‍👦…']],
  ])('renders canonical %s title lines', (_label, title, expectedLines) => {
    const { container } = render(
      <AudiencePoll params={{ ...params, title }} playbackTime={2} />,
    )

    expect(Array.from(
      container.querySelectorAll('[data-poll-title-line]'),
      (line) => line.textContent,
    )).toEqual(expectedLines)
  })
})
