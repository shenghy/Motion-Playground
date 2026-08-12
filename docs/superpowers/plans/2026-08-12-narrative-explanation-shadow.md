# Narrative Explanation Shadow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lighter deep-gray shadow to every rendered line of the narrative card's bottom white explanation text without changing its layout or the existing headline shadow.

**Architecture:** Reuse the existing Canvas `drawText` shadow option and keep the change inside the narrative Canvas renderer. Define one narrative-specific explanation shadow constant beside the existing headline shadow, apply it only to explanation draw calls, and strengthen the renderer test so each text role has an explicit shadow contract.

**Tech Stack:** TypeScript, Canvas 2D, Vitest, Vite

---

### Task 1: Add and verify the explanation shadow contract

**Files:**
- Modify: `src/motion/canvas/narrativeRenderer.test.ts:130-166`
- Modify: `src/motion/canvas/narrativeRenderer.ts:11-16,76-85`

- [ ] **Step 1: Write the failing renderer test**

Replace the existing headline-only shadow test with a role-specific test. Keep the existing headline assertions, identify explanation lines from the configured explanation string, require the approved lighter shadow on those lines, and require the remaining text to stay neutral:

```ts
it('uses strong headline shadows and lighter explanation shadows', () => {
  const { ctx, textDraws } = createContext()

  renderNarrativeToCanvas({
    ctx,
    params,
    localTime: 2,
    resources: {
      width: 1920,
      height: 1080,
      displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono',
      contentFont: 'Noto Sans SC Variable',
    },
  })

  const headlineDraws = textDraws.filter(({ text }) => (
    text === params.line1 || text === params.line2
  ))
  const explanationDraws = textDraws.filter(({ text }) => (
    params.explanation?.includes(text)
  ))
  const neutralDraws = textDraws.filter(({ text }) => (
    text !== params.line1
      && text !== params.line2
      && !params.explanation?.includes(text)
  ))

  expect(headlineDraws).toHaveLength(2)
  expect(headlineDraws.every((draw) => (
    draw.shadowColor === 'rgba(38, 40, 43, 0.8)'
      && draw.shadowBlur === 10
      && draw.shadowOffsetX === 4
      && draw.shadowOffsetY === 5
  ))).toBe(true)
  expect(explanationDraws.length).toBeGreaterThan(0)
  expect(explanationDraws.every((draw) => (
    draw.shadowColor === 'rgba(38, 40, 43, 0.8)'
      && draw.shadowBlur === 6
      && draw.shadowOffsetX === 2
      && draw.shadowOffsetY === 3
  ))).toBe(true)
  expect(neutralDraws.every((draw) => (
    draw.shadowColor === 'rgba(0, 0, 0, 0)'
      && draw.shadowBlur === 0
      && draw.shadowOffsetX === 0
      && draw.shadowOffsetY === 0
  ))).toBe(true)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- --run src/motion/canvas/narrativeRenderer.test.ts
```

Expected: FAIL in `uses strong headline shadows and lighter explanation shadows` because explanation draw calls still have transparent zero-valued shadow state.

- [ ] **Step 3: Add the minimal explanation shadow implementation**

Add this constant directly below `HEADLINE_SHADOW` in `src/motion/canvas/narrativeRenderer.ts`:

```ts
const EXPLANATION_SHADOW = {
  color: 'rgba(38, 40, 43, 0.8)',
  blur: 6,
  offsetX: 2,
  offsetY: 3,
} as const
```

Then add the shadow option to the existing explanation `drawText` call without changing any layout property:

```ts
drawText(ctx, {
  text,
  x: 132,
  y: 510 + state.explanation.y + index * 44,
  font: explanationFont,
  color: CANVAS_COLORS.muted,
  maxWidth: 660,
  alpha: state.explanation.opacity,
  shadow: EXPLANATION_SHADOW,
})
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm test -- --run src/motion/canvas/narrativeRenderer.test.ts
```

Expected: PASS with all narrative renderer tests green, including the unchanged 30px two-line safe-boundary test.

- [ ] **Step 5: Run related Canvas regression tests**

Run:

```bash
npm test -- --run src/export/canvas src/motion
```

Expected: PASS with no narrative, Canvas primitive, motion registry, or layout regressions.

- [ ] **Step 6: Run full verification**

Run:

```bash
npm test -- --run
npm run build
```

Expected: all Vitest files pass and the TypeScript/Vite build exits with code 0.

- [ ] **Step 7: Perform browser visual verification**

Start the local application:

```bash
npm run dev -- --host 127.0.0.1 --port 4177
```

Expected: Vite serves the application at `http://127.0.0.1:4177/`. Open that URL, render the narrative fixture, and verify all of the following against the approved design:

- The bottom white explanation is clearer on the gray-bright background.
- Its shadow is visibly lighter than the two 90px headline shadows.
- The explanation remains 30px, uses at most two lines, and stays inside the existing left and bottom safe boundaries.
- The blue eyebrow and divider do not gain text shadow.
- The browser console has no new error or warning caused by the change.

- [ ] **Step 8: Commit the implementation**

```bash
git add src/motion/canvas/narrativeRenderer.ts src/motion/canvas/narrativeRenderer.test.ts
git commit -m "feat: add shadow to narrative explanation"
```
