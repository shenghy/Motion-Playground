import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

describe('workspace layout CSS contract', () => {
  it('widens the right panel and hides rail scrollbars while retaining vertical scrolling', () => {
    expect(css).toContain('clamp(420px, 30vw, 470px)')
    expect(css).toMatch(/\.rail-list\s*\{[^}]*overflow-x:\s*hidden/s)
    expect(css).toMatch(/\.rail-list\s*\{[^}]*overflow-y:\s*auto/s)
    expect(css).toMatch(
      /\.rail-list::-webkit-scrollbar\s*\{[^}]*display:\s*none/s,
    )
  })

  it('styles accessible tab states and readable panel hierarchy', () => {
    expect(css).toContain('.parameter-tabs')
    expect(css).toContain(".parameter-tab[aria-selected='true']")
    expect(css).toContain('.parameter-tabpanel')
  })
})
