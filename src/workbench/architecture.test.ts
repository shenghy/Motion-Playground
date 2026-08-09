import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Workbench architecture boundary', () => {
  it('keeps the page coordinator below 950 lines', () => {
    const source = readFileSync(join(
      process.cwd(), 'src/components/Workbench.tsx',
    ), 'utf8')
    expect(source.split(/\r?\n/).length).toBeLessThanOrEqual(950)
  })
})
