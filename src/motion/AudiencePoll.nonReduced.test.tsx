import { render, screen, within } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AudiencePollParams } from './types'

const originalMatchMedia = window.matchMedia
let AudiencePoll: typeof import('./AudiencePoll').AudiencePoll

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

beforeAll(async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      ...originalMatchMedia(query),
      matches: false,
    }),
  })
  ;({ AudiencePoll } = await import('./AudiencePoll'))
})

afterAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  })
})

describe('AudiencePoll without reduced motion', () => {
  it('applies explicit sampled styles in the stable and full-exit phases', () => {
    const { rerender } = render(<AudiencePoll params={params} playbackTime={3.4} />)
    const primary = screen.getByTestId('audience-poll-primary')

    expect(screen.getByTestId('audience-poll-panel')).toHaveStyle({ opacity: 1 })
    for (const option of within(primary).getAllByRole('listitem')) {
      expect(option).toHaveStyle({ opacity: 1 })
    }
    expect(within(primary).getByText(params.callToAction)).toHaveStyle({ opacity: 1 })

    rerender(<AudiencePoll params={params} playbackTime={6.2} />)
    expect(screen.getByTestId('audience-poll-panel')).toHaveStyle({ opacity: 0 })
    for (const option of within(primary).getAllByRole('listitem')) {
      expect(option).toHaveStyle({ opacity: 0 })
    }
    expect(within(primary).getByText(params.callToAction)).toHaveStyle({ opacity: 0 })
  })
})
