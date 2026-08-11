# Core Metric and Narrative Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the core metric bar treatment with a number-first poster layout and enlarge the narrative explanation to a boundary-safe 30px two-line block.

**Architecture:** Keep the existing single Canvas rendering path shared by live preview and transparent export. Remove bar-only layout and state from `metric-focus`; add a focused, measured text-layout helper for `narrative` so the renderer can draw one or two uncompressed 30px lines deterministically.

**Tech Stack:** React 19, TypeScript 6, Canvas 2D, Vitest 4, Vite 8

---

## File map

- Modify `src/motion/metricFocusLayout.ts`: allocate the complete metric safe width to value typography.
- Modify `src/motion/canvas/metricFocusState.ts`: remove the obsolete bar reveal state.
- Modify `src/motion/canvas/metricFocusState.test.ts`: assert the number-poster state contract.
- Modify `src/motion/canvas/metricFocusRenderer.ts`: delete bar drawing and rebalance number, divider, description, and trend positions.
- Modify `src/motion/canvas/metricFocusRenderer.test.ts`: replace bar-growth assertions with no-bar and safe-boundary assertions.
- Create `src/motion/canvas/narrativeTextLayout.ts`: measure and split narrative explanation text into at most two balanced lines.
- Create `src/motion/canvas/narrativeTextLayout.test.ts`: verify one-line, two-line, and width contracts.
- Modify `src/motion/canvas/narrativeRenderer.ts`: draw the measured explanation at 30px with fixed line spacing.
- Modify `src/motion/canvas/narrativeRenderer.test.ts`: verify font size, line count, and visible boundaries.

### Task 1: Convert core metric to the number-poster layout

**Files:**
- Modify: `src/motion/metricFocusLayout.ts`
- Modify: `src/motion/canvas/metricFocusState.ts`
- Test: `src/motion/canvas/metricFocusState.test.ts`
- Modify: `src/motion/canvas/metricFocusRenderer.ts`
- Test: `src/motion/canvas/metricFocusRenderer.test.ts`

- [ ] **Step 1: Replace the bar-state expectations with the number-poster contract**

In `src/motion/canvas/metricFocusState.test.ts`, remove assertions that read `bar.reveal` and add these assertions to the settled-layer test:

```ts
expect(getMetricFocusState(params, 0)).not.toHaveProperty('bar')
expect(settled).not.toHaveProperty('bar')
expect(settled.value.opacity).toBe(1)
expect(settled.value.scale).toBe(1)
expect(settled.value.blur).toBe(0)
expect(settled.pencilLine.reveal).toBe(1)
```

In `src/motion/canvas/metricFocusRenderer.test.ts`, replace `grows one decorative bar from zero to its full height` with:

```ts
it('renders a number poster without bar rectangles', () => {
  const ctx = createContext()
  renderMetricFocusToCanvas({
    ctx,
    params,
    localTime: 8,
    resources: {
      width: 1920,
      height: 1080,
      displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono',
      contentFont: 'Noto Sans SC Variable',
    },
  })

  expect(ctx.fillRect).not.toHaveBeenCalled()
  expect(ctx.strokeRect).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```powershell
npm test -- --run src/motion/canvas/metricFocusState.test.ts src/motion/canvas/metricFocusRenderer.test.ts
```

Expected: FAIL because `getMetricFocusState` still exposes `bar`, and the renderer still calls `fillRect` and `strokeRect` for the decorative column.

- [ ] **Step 3: Remove bar-only layout and state**

In `src/motion/metricFocusLayout.ts`, delete `METRIC_BAR_WIDTH` and `METRIC_BAR_GAP`, increase the poster typography, and calculate width without reserving a bar:

```ts
const NUMBER_FONT_SIZE = 156
const AFFIX_FONT_SIZE = 36

const availableGlyphWidth = METRIC_SAFE_RIGHT
  - METRIC_CONTENT_X
  - textGaps
```

In `src/motion/canvas/metricFocusState.ts`, remove the complete `bar` property from the returned object. Keep number counting, eyebrow, value, metadata, and pencil-line timings unchanged.

- [ ] **Step 4: Implement the number-poster renderer**

In `src/motion/canvas/metricFocusRenderer.ts`:

1. Remove imports of `METRIC_BAR_GAP` and `METRIC_BAR_WIDTH`.
2. Remove `BAR_HEIGHT`, `BAR_BOTTOM`, `barX`, and the entire `strokeRect`/`fillRect` block.
3. Use the full safe width for the suffix:

```ts
drawText(ctx, {
  text: params.suffix,
  x: suffixX,
  y: baseline,
  font: suffixFont,
  color: CANVAS_COLORS.accentBlue,
  maxWidth: Math.max(0, METRIC_SAFE_RIGHT - suffixX),
  ...valueTextStyle,
})
```

4. Rebalance the poster vertically without changing the safe width:

```ts
const baseline = 432

drawPencilLine(ctx, {
  x1: METRIC_CONTENT_X,
  y1: 500,
  x2: METRIC_SAFE_RIGHT - 28,
  y2: 500,
  color: CANVAS_COLORS.accentBlue,
  width: 2,
  alpha: state.pencilLine.reveal,
})

// description y: 546 + state.meta.y, font: 500 32px contentFont
// trend y: 596 + state.meta.y, font: 550 19px monoFont
```

Keep the existing value transform, blur, opacity, and deterministic count-up calls intact.

- [ ] **Step 5: Run the focused tests and verify they pass**

Run:

```powershell
npm test -- --run src/motion/canvas/metricFocusState.test.ts src/motion/canvas/metricFocusRenderer.test.ts
```

Expected: both files PASS; no bar rectangle is drawn; long values still remain inside `1920 * 0.38`.

- [ ] **Step 6: Commit the core metric change**

```powershell
git add src/motion/metricFocusLayout.ts src/motion/canvas/metricFocusState.ts src/motion/canvas/metricFocusState.test.ts src/motion/canvas/metricFocusRenderer.ts src/motion/canvas/metricFocusRenderer.test.ts
git commit -m "feat: redesign core metric as number poster"
```

### Task 2: Enlarge and wrap the narrative explanation

**Files:**
- Create: `src/motion/canvas/narrativeTextLayout.ts`
- Create: `src/motion/canvas/narrativeTextLayout.test.ts`
- Modify: `src/motion/canvas/narrativeRenderer.ts`
- Test: `src/motion/canvas/narrativeRenderer.test.ts`

- [ ] **Step 1: Write failing layout-helper tests**

Create `src/motion/canvas/narrativeTextLayout.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { layoutNarrativeExplanation } from './narrativeTextLayout'

function context(widthPerCharacter: number) {
  return {
    font: '',
    measureText: vi.fn((text: string) => ({
      width: Array.from(text).length * widthPerCharacter,
    })),
  } as unknown as CanvasRenderingContext2D
}

describe('layoutNarrativeExplanation', () => {
  it('keeps short copy on one line', () => {
    expect(layoutNarrativeExplanation(context(30), '清晰说明', '400 30px Mono', 660))
      .toEqual(['清晰说明'])
  })

  it('balances long copy across two fitting lines', () => {
    const ctx = context(30)
    const lines = layoutNarrativeExplanation(
      ctx,
      '让系统处理重复步骤人只负责判断与创造让内容更加清楚',
      '400 30px Mono',
      660,
    )
    expect(lines).toHaveLength(2)
    expect(lines.join('')).toBe('让系统处理重复步骤人只负责判断与创造让内容更加清楚')
    expect(lines.every((line) => ctx.measureText(line).width <= 660)).toBe(true)
  })
})
```

- [ ] **Step 2: Add failing renderer assertions for 30px two-line output**

In `src/motion/canvas/narrativeRenderer.test.ts`, add a font history to the fake context inside `fillText`, then add:

```ts
it('draws long explanation copy as at most two uncompressed 30px lines', () => {
  const { ctx } = createContext()
  const explanation = '让系统处理重复步骤人只负责判断与创造让内容更加清楚'
  renderNarrativeToCanvas({
    ctx,
    params: { ...params, explanation },
    localTime: 2,
    resources: {
      width: 1920,
      height: 1080,
      displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono',
      contentFont: 'Noto Sans SC Variable',
    },
  })

  const explanationCalls = vi.mocked(ctx.fillText).mock.calls
    .filter(([text]) => explanation.includes(String(text)))
  expect(explanationCalls).toHaveLength(2)
  expect(explanationCalls.map(([text]) => String(text)).join('')).toBe(explanation)
  expect(explanationCalls.every(([, x, y, maxWidth]) => (
    Number(x) + Number(maxWidth) <= 792 && Number(y) + 30 <= 590
  ))).toBe(true)
})
```

The fake context must record `ctx.font` at each `fillText` call so the test can also assert that both explanation calls use a font containing `30px`.

- [ ] **Step 3: Run the narrative tests and verify they fail**

Run:

```powershell
npm test -- --run src/motion/canvas/narrativeTextLayout.test.ts src/motion/canvas/narrativeRenderer.test.ts
```

Expected: FAIL because the helper does not exist and the renderer still draws one 22px line.

- [ ] **Step 4: Implement measured, balanced text layout**

Create `src/motion/canvas/narrativeTextLayout.ts`:

```ts
export function layoutNarrativeExplanation(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  maxWidth: number,
) {
  const characters = Array.from(text)
  ctx.font = font
  if (ctx.measureText(text).width <= maxWidth || characters.length < 2) {
    return [text]
  }

  const candidates = characters.slice(1).map((_, index) => {
    const split = index + 1
    const first = characters.slice(0, split).join('')
    const second = characters.slice(split).join('')
    const firstWidth = ctx.measureText(first).width
    const secondWidth = ctx.measureText(second).width
    return { first, second, firstWidth, secondWidth }
  }).filter(({ firstWidth, secondWidth }) => (
    firstWidth <= maxWidth && secondWidth <= maxWidth
  )).sort((left, right) => (
    Math.abs(left.firstWidth - left.secondWidth)
      - Math.abs(right.firstWidth - right.secondWidth)
  ))

  const best = candidates[0]
  return best ? [best.first, best.second] : [text]
}
```

The registry already limits the field to 32 characters, so valid production input always has a balanced two-line solution at 30px within 660px. The fallback `[text]` preserves content if an unexpected font metric makes splitting impossible; the existing `drawText` safety shrink remains the final boundary guard.

- [ ] **Step 5: Draw the explanation at 30px with fixed line spacing**

In `src/motion/canvas/narrativeRenderer.ts`, import the helper and replace the current explanation `drawText` call with:

```ts
const explanationFont = `400 30px ${resources.monoFont}`
const explanationLines = layoutNarrativeExplanation(
  ctx,
  explanation,
  explanationFont,
  660,
)

explanationLines.forEach((text, index) => {
  drawText(ctx, {
    text,
    x: 132,
    y: 510 + state.explanation.y + index * 44,
    font: explanationFont,
    color: CANVAS_COLORS.muted,
    maxWidth: 660,
    alpha: state.explanation.opacity,
  })
})
```

- [ ] **Step 6: Run the focused narrative tests and verify they pass**

Run:

```powershell
npm test -- --run src/motion/canvas/narrativeTextLayout.test.ts src/motion/canvas/narrativeRenderer.test.ts
```

Expected: PASS; short copy stays on one line, long copy is two 30px lines, and the second line ends above y=590.

- [ ] **Step 7: Commit the narrative readability change**

```powershell
git add src/motion/canvas/narrativeTextLayout.ts src/motion/canvas/narrativeTextLayout.test.ts src/motion/canvas/narrativeRenderer.ts src/motion/canvas/narrativeRenderer.test.ts
git commit -m "feat: enlarge narrative explanation text"
```

### Task 3: Regression and visual verification

**Files:**
- Verify: `src/motion/canvas/metricFocusRenderer.test.ts`
- Verify: `src/motion/canvas/narrativeRenderer.test.ts`
- Verify: `src/motion/rendererContract.test.ts`
- Verify: `src/export/canvas/CanvasExportSurface.test.ts`

- [ ] **Step 1: Run all motion and export-facing tests**

Run:

```powershell
npm test -- --run src/motion src/export/canvas
```

Expected: PASS with no renderer, registry, visual fixture, or export-surface regressions.

- [ ] **Step 2: Run the complete test suite**

Run:

```powershell
npm test -- --run
```

Expected: all tests PASS. If unrelated dirty-worktree tests fail, record the exact unrelated files and still require every changed-file and motion/export test from Steps 1 and 2 to pass.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm run build
```

Expected: TypeScript and Vite build successfully with exit code 0.

- [ ] **Step 4: Inspect both default and maximum-content frames**

Start the local app with the repository launcher or `npm run dev`, then inspect `metric-focus` and `narrative` at their settled frames using default parameters and maximum-length parameters. Confirm:

- no bar track or filled column appears;
- the core number and unit are the first visual focus;
- all metric content remains left of x=729.6;
- the narrative headline is unchanged;
- the narrative explanation is visibly 30px, uses at most two lines, and ends above y=590.

- [ ] **Step 5: Commit only if verification required a targeted correction**

```powershell
git add src/motion/metricFocusLayout.ts src/motion/canvas/metricFocusState.ts src/motion/canvas/metricFocusState.test.ts src/motion/canvas/metricFocusRenderer.ts src/motion/canvas/metricFocusRenderer.test.ts src/motion/canvas/narrativeTextLayout.ts src/motion/canvas/narrativeTextLayout.test.ts src/motion/canvas/narrativeRenderer.ts src/motion/canvas/narrativeRenderer.test.ts
git commit -m "fix: preserve metric and narrative safe bounds"
```

If verification requires no correction, do not create an empty commit.
