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
    expect(css).toMatch(/:root\s*\{[^}]*--motion-accent-blue:\s*#2f67b2/s)
    expect(css).toContain('.parameter-tabs')
    expect(css).toContain(".parameter-tab[aria-selected='true']")
    expect(css).toContain('.parameter-tabpanel')
  })

  it('keeps the seven-step flow in one compact column above the subtitle zone', () => {
    expect(css).toMatch(
      /\.step-flow__card\[data-pencil-layout='drawn-path'\]\s*\{[^}]*width:\s*33%/s,
    )
    expect(css).toMatch(
      /\.step-flow__steps\s*\{[^}]*grid-template-rows:\s*repeat\(var\(--step-count\),\s*minmax\(0,\s*1fr\)\)/s,
    )
    expect(css).toMatch(
      /\.step-flow__card\[data-pencil-layout='drawn-path'\]\s*\{[^}]*bottom:\s*calc\(var\(--subtitle-safe-bottom\)\s*\+\s*3%\)/s,
    )
    expect(css).toMatch(
      /\.step-flow__step\s*\{[^}]*width:\s*92%[^}]*grid-template-columns:\s*1\.7cqw\s+minmax\(0,\s*1fr\)/s,
    )
  })

  it('uses the right-panel gray hierarchy across the component rail', () => {
    expect(css).toMatch(/\.component-rail\s*\{[^}]*background:\s*#24282d/s)
    expect(css).toMatch(/\.rail-heading\s*\{[^}]*background:\s*#24282d/s)
    expect(css).toMatch(/\.rail-list\s*\{[^}]*background:\s*#1c2024/s)
    expect(css).toMatch(/\.rail-footer\s*\{[^}]*background:\s*#202429/s)
  })
})
