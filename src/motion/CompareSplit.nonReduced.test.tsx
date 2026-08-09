import { render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CompareSplitParams } from './types'

const originalMatchMedia = window.matchMedia
let CompareSplit: typeof import('./CompareSplit').CompareSplit

const params: CompareSplitParams = {
  title: '转化率',
  leftLabel: '优化前',
  leftValue: 42,
  rightLabel: '优化后',
  rightValue: 86,
  suffix: '%',
  conclusion: '提升 2.05 倍',
  emphasis: 'right',
  split: 50,
  duration: 1.5,
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
  ;({ CompareSplit } = await import('./CompareSplit'))
})

afterAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  })
})

describe('CompareSplit without reduced motion', () => {
  it('runs from the live preview clock when no sampled playback time is supplied', async () => {
    render(<CompareSplit params={params} />)

    await waitFor(() => {
      expect(screen.getByTestId('compare-upper')).not.toHaveStyle({ opacity: 0 })
      expect(screen.getByTestId('compare-upper')).not.toHaveTextContent('优化前0%')
    }, { timeout: 2000 })
  })
})
