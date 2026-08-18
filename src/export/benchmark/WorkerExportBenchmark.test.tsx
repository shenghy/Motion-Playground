import { describe, expect, it } from 'vitest'
import { motionRegistry } from '../../motion/registry'
import {
  benchmarkFrameCount,
  createBenchmarkCards,
  resolveBenchmarkMode,
} from './WorkerExportBenchmark'

describe('worker export benchmark contract', () => {
  it('selects exact short and long frame counts', () => {
    expect(benchmarkFrameCount('short')).toBe(300)
    expect(benchmarkFrameCount('long')).toBe(11_248)
  })

  it('defaults to short and accepts only the long query value', () => {
    expect(resolveBenchmarkMode(new URLSearchParams())).toBe('short')
    expect(resolveBenchmarkMode(new URLSearchParams('mode=long'))).toBe('long')
    expect(resolveBenchmarkMode(new URLSearchParams('mode=other'))).toBe('short')
  })

  it('covers every registered motion and keeps visible content through the long final frame', () => {
    const short = createBenchmarkCards('short')
    const long = createBenchmarkCards('long')
    expect(new Set(short.map((card) => card.motionId))).toEqual(
      new Set(motionRegistry.map((motion) => motion.id)),
    )
    expect(short).toHaveLength(motionRegistry.length)
    expect(long.some((card) => card.end >= 11_248 / 30)).toBe(true)
  })
})
