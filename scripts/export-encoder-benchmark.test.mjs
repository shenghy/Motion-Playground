import { describe, expect, it } from 'vitest'
import { runEncoderBenchmark } from './export-encoder-benchmark.mjs'

describe('transparent export encoder benchmark', () => {
  it('runs the real export manager and reports measurable output', async () => {
    const result = await runEncoderBenchmark({ frameCount: 2 })

    expect(result).toMatchObject({
      frames: 2,
      videoSeconds: 2 / 30,
    })
    expect(result.wallSeconds).toBeGreaterThan(0)
    expect(result.framesPerSecond).toBeGreaterThan(0)
    expect(result.outputMB).toBeGreaterThan(0)
  }, 30_000)
})
