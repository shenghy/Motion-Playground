import { describe, expect, it } from 'vitest'
import { buildBenchmarkVideoArguments, createBenchmarkAssets } from './create-export-benchmark-assets.mjs'

describe('export benchmark asset builder', () => {
  it('pins the exact frame count and ultrafast H.264 output', () => {
    const args = buildBenchmarkVideoArguments(11248, 'out.mp4')
    expect(args).toContain('11248')
    expect(args).toContain('ultrafast')
    expect(args.at(-1)).toBe('out.mp4')
  })

  it('requires an explicit disposable output directory', async () => {
    await expect(createBenchmarkAssets()).rejects.toThrow('explicit output directory')
  })
})
