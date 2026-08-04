import { describe, expect, it } from 'vitest'
import {
  buildChromeArguments,
  parseBenchmarkMode,
} from './run-worker-export-benchmark.mjs'

describe('worker export browser benchmark runner', () => {
  it('accepts only short or long modes', () => {
    expect(parseBenchmarkMode('short')).toBe('short')
    expect(parseBenchmarkMode('long')).toBe('long')
    expect(() => parseBenchmarkMode('other')).toThrow('short 或 long')
  })

  it('uses a dedicated profile, debugging port, and hidden benchmark URL', () => {
    const args = buildChromeArguments({
      profileDirectory: 'C:\\Temp\\worker-profile-1',
      debuggingPort: 49321,
      appUrl: 'http://127.0.0.1:45001/',
      mode: 'short',
    })
    expect(args).toContain('--headless=new')
    expect(args).toContain('--remote-debugging-port=49321')
    expect(args).toContain('--user-data-dir=C:\\Temp\\worker-profile-1')
    expect(args.at(-1)).toBe(
      'http://127.0.0.1:45001/?worker-export-benchmark=1&mode=short',
    )
  })
})
