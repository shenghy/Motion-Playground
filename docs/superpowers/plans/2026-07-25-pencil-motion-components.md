# Pencil Motion Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all six motion components as a cohesive black-paper, silver-pencil system while preserving their data behavior, controls, person safe zone, and 150px subtitle safe zone.

**Architecture:** Add one shared decorative primitive for graphite texture and use component-specific markup for semantic pencil strokes, hatching, strike-throughs, check marks, rings, and paths. Keep the registry and parameter types unchanged; the redesign is implemented inside the six renderers and their CSS so the workbench continues to drive the same props.

**Tech Stack:** React, TypeScript, Motion for React, CSS/SVG, Vitest, React Testing Library.

---

### Task 1: Add the shared graphite surface

**Files:**
- Create: `src/motion/PencilTexture.tsx`
- Create: `src/motion/PencilTexture.test.tsx`
- Modify: `src/styles.css`

- [x] **Step 1: Write the failing primitive test**

```tsx
import { render, screen } from '@testing-library/react'
import { PencilTexture } from './PencilTexture'

it('renders decorative graphite grain without exposing it to assistive technology', () => {
  render(<PencilTexture variant="hatch" />)
  expect(screen.getByTestId('pencil-texture')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByTestId('pencil-texture')).toHaveAttribute('data-variant', 'hatch')
})
```

- [x] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- --run src/motion/PencilTexture.test.tsx`

Expected: FAIL because `./PencilTexture` does not exist.

- [x] **Step 3: Implement the shared primitive**

```tsx
interface PencilTextureProps {
  variant?: 'grain' | 'hatch' | 'eraser'
}

export function PencilTexture({ variant = 'grain' }: PencilTextureProps) {
  return (
    <div
      className="pencil-texture"
      data-testid="pencil-texture"
      data-variant={variant}
      aria-hidden="true"
    >
      <i />
      <i />
      <i />
    </div>
  )
}
```

Add common CSS for `.pencil-texture`, its three irregular strokes, graphite grain, hatch, and eraser variants. The layer must use `pointer-events: none`, `mix-blend-mode: screen`, and low opacity so it never blocks the background video.

- [x] **Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- --run src/motion/PencilTexture.test.tsx`

Expected: 1 test passes.

- [x] **Step 5: Commit the primitive**

```powershell
git add src/motion/PencilTexture.tsx src/motion/PencilTexture.test.tsx src/styles.css
git commit -m "feat: add shared graphite texture"
```

### Task 2: Redesign MetricFocus and CompareSplit

**Files:**
- Modify: `src/motion/MetricFocus.tsx`
- Modify: `src/motion/MetricFocus.test.tsx`
- Modify: `src/motion/CompareSplit.tsx`
- Modify: `src/motion/CompareSplit.test.tsx`
- Modify: `src/styles.css`

- [x] **Step 1: Add failing pencil-structure assertions**

Add to each existing test:

```tsx
expect(screen.getByTestId('metric-primary')).toHaveAttribute(
  'data-pencil-layout',
  'open-frame',
)
expect(screen.getByTestId('metric-pencil-line')).toBeInTheDocument()
expect(screen.getByTestId('compare-left')).toHaveAttribute(
  'data-pencil-state',
  'struck',
)
expect(screen.getByTestId('compare-right')).toHaveAttribute(
  'data-pencil-state',
  'emphasized',
)
expect(screen.getByTestId('compare-pencil-arrow')).toBeInTheDocument()
```

- [x] **Step 2: Run both focused tests and confirm RED**

Run: `npm test -- --run src/motion/MetricFocus.test.tsx src/motion/CompareSplit.test.tsx`

Expected: FAIL on the new attributes and test IDs.

- [x] **Step 3: Implement MetricFocus open-line composition**

Import and render `<PencilTexture variant="grain" />`. Replace the four-corner closed frame treatment with an open top/left structure. Add a Motion line:

```tsx
<motion.i
  className="metric-focus__pencil-line"
  data-testid="metric-pencil-line"
  aria-hidden="true"
  initial={{ scaleX: 0 }}
  animate={{ scaleX: 1 }}
  transition={transition(0.48)}
/>
```

Keep `useCountUp`, the existing `data-zone` values, and the right-side trend rail. Add `data-pencil-layout="open-frame"` to `metric-primary`.

- [x] **Step 4: Implement CompareSplit strike-and-emphasize composition**

Import `<PencilTexture variant="eraser" />`. Keep the two semantic sections but remove their solid card backgrounds. Add `data-pencil-state="struck"` to the non-emphasized side and `data-pencil-state="emphasized"` to the emphasized side. Draw the strike line and comparison arrow with Motion elements:

```tsx
<motion.i
  className="compare-panel__strike"
  aria-hidden="true"
  initial={{ scaleX: 0 }}
  animate={{ scaleX: 1 }}
  transition={{ duration, delay: reduceMotion ? 0 : 0.5, ease }}
/>
<motion.i
  className="compare-split__pencil-arrow"
  data-testid="compare-pencil-arrow"
  aria-hidden="true"
  initial={{ scaleX: 0, opacity: 0 }}
  animate={{ scaleX: 1, opacity: 1 }}
  transition={{ duration, delay: reduceMotion ? 0 : 0.62, ease }}
/>
```

- [x] **Step 5: Replace the related CSS**

Use transparent backgrounds, silver-white borders, double pencil baselines, and `repeating-linear-gradient` only for low-opacity graphite details. Core numbers remain stable; only decorative lines receive the subtle `pencil-breathe` animation.

- [x] **Step 6: Run the focused tests and confirm GREEN**

Run: `npm test -- --run src/motion/MetricFocus.test.tsx src/motion/CompareSplit.test.tsx`

Expected: both test files pass.

- [x] **Step 7: Commit the first component pair**

```powershell
git add src/motion/MetricFocus.tsx src/motion/MetricFocus.test.tsx src/motion/CompareSplit.tsx src/motion/CompareSplit.test.tsx src/styles.css
git commit -m "feat: redraw metric and compare motions"
```

### Task 3: Redesign ProfileReveal as a checked field note

**Files:**
- Modify: `src/motion/ProfileReveal.tsx`
- Modify: `src/motion/ProfileReveal.test.tsx`
- Modify: `src/styles.css`

- [x] **Step 1: Add failing sequential-check assertions**

```tsx
expect(screen.getByTestId('profile-primary')).toHaveAttribute(
  'data-pencil-layout',
  'field-note',
)
expect(screen.getAllByTestId('profile-check')).toHaveLength(3)
```

- [x] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- --run src/motion/ProfileReveal.test.tsx`

Expected: FAIL because the new layout marker and check elements are absent.

- [x] **Step 3: Implement the field-note hierarchy**

Render `<PencilTexture variant="grain" />` and add `data-pencil-layout="field-note"`. Preserve the existing `reveal()` sequence. Replace the cross glyph with an animated square and check:

```tsx
<motion.b
  className="profile-reveal__check"
  data-testid="profile-check"
  aria-hidden="true"
  initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
  animate={{ opacity: 1, scale: 1, rotate: -2 }}
  transition={{ delay: reduceMotion ? 0 : 1.72 + index * 0.68, ease }}
>
  ✓
</motion.b>
```

Keep title and facts legible and stationary during their hold phase. Keep the secondary status rail in `right-secondary`.

- [x] **Step 4: Replace the related CSS**

Make the profile card open on its right and bottom edges, add ruled-pencil separators, use a Chinese handwriting font stack for fact notes, and keep the title in the existing readable display face.

- [x] **Step 5: Run the focused test and confirm GREEN**

Run: `npm test -- --run src/motion/ProfileReveal.test.tsx`

Expected: the test file passes.

- [x] **Step 6: Commit ProfileReveal**

```powershell
git add src/motion/ProfileReveal.tsx src/motion/ProfileReveal.test.tsx src/styles.css
git commit -m "feat: turn profile motion into field notes"
```

### Task 4: Redesign BarCompare and ShareRing

**Files:**
- Modify: `src/motion/BarCompare.tsx`
- Modify: `src/motion/BarCompare.test.tsx`
- Modify: `src/motion/ShareRing.tsx`
- Modify: `src/motion/ShareRing.test.tsx`
- Modify: `src/styles.css`

- [x] **Step 1: Add failing data-visual assertions**

```tsx
expect(screen.getByTestId('bar-primary')).toHaveAttribute(
  'data-pencil-layout',
  'hatched-chart',
)
expect(screen.getAllByTestId('bar-column')[3]).toHaveAttribute(
  'data-pencil-weight',
  'heavy',
)
expect(screen.getByTestId('share-primary')).toHaveAttribute(
  'data-pencil-layout',
  'drawn-ring',
)
expect(screen.getAllByTestId('share-segment')[0]).toHaveAttribute(
  'data-pencil-weight',
  'double',
)
```

- [x] **Step 2: Run both focused tests and confirm RED**

Run: `npm test -- --run src/motion/BarCompare.test.tsx src/motion/ShareRing.test.tsx`

Expected: FAIL on the new pencil attributes.

- [x] **Step 3: Implement hatched bars**

Render `<PencilTexture variant="hatch" />`, set `data-pencil-layout="hatched-chart"` on the primary section, and set each column's `data-pencil-weight` to `heavy` for the focus index and `light` otherwise. Keep the existing normalized heights and loop timings.

- [x] **Step 4: Implement the double-line share ring**

Render `<PencilTexture variant="eraser" />` and set `data-pencil-layout="drawn-ring"`. Keep SVG dash-array animation. Add a second low-opacity focused circle directly behind the primary focused segment to create a double-pencil line, and mark the primary segment with `data-pencil-weight="double"`; all other segments use `data-pencil-weight="faded"`.

- [x] **Step 5: Replace the related CSS**

Use diagonal graphite hatching for bars. Focused bars gain border width and hatch density, not color. Ring segments use silver-white opacity levels; the focused ring receives a rough doubled edge while other segments resemble erased graphite.

- [x] **Step 6: Run the focused tests and confirm GREEN**

Run: `npm test -- --run src/motion/BarCompare.test.tsx src/motion/ShareRing.test.tsx`

Expected: both test files pass, including zero-value normalization.

- [x] **Step 7: Commit the data visualization pair**

```powershell
git add src/motion/BarCompare.tsx src/motion/BarCompare.test.tsx src/motion/ShareRing.tsx src/motion/ShareRing.test.tsx src/styles.css
git commit -m "feat: pencil sketch data visualizations"
```

### Task 5: Redesign StepFlow as a five-step drawn path

**Files:**
- Modify: `src/motion/StepFlow.tsx`
- Modify: `src/motion/StepFlow.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add failing path and focus assertions**

```tsx
expect(screen.getByTestId('flow-primary')).toHaveAttribute(
  'data-pencil-layout',
  'drawn-path',
)
expect(screen.getByTestId('flow-path')).toBeInTheDocument()
expect(screen.getAllByTestId('flow-step')[2]).toHaveAttribute(
  'data-pencil-weight',
  'double',
)
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- --run src/motion/StepFlow.test.tsx`

Expected: FAIL on the new path and pencil markers.

- [ ] **Step 3: Implement the drawn path**

Render `<PencilTexture variant="grain" />`. Replace the straight connector with a decorative SVG path:

```tsx
const connectorTransition = reduceMotion
  ? { duration: 0 }
  : {
      duration: cycle,
      times: [0, 0.12, 0.9, 1],
      repeat: Infinity,
      repeatDelay: 0.72,
      ease,
    }

<svg
  className="step-flow__path"
  data-testid="flow-path"
  viewBox="0 0 80 420"
  preserveAspectRatio="none"
  aria-hidden="true"
>
  <motion.path
    d="M42 6 C26 72 56 128 38 198 C22 264 56 330 38 414"
    pathLength={1}
    initial={reduceMotion ? false : { pathLength: 0 }}
    animate={reduceMotion ? { pathLength: 1 } : { pathLength: [0, 1, 1, 0] }}
    transition={connectorTransition}
  />
</svg>
```

Set `data-pencil-layout="drawn-path"` on the primary section and `data-pencil-weight="double"` only on the initially focused step. Preserve three-step fallback behavior.

- [ ] **Step 4: Replace the related CSS**

Place five steps along the existing left-side vertical layout, offset alternating nodes by a small amount to follow the curved path. The current node uses a larger double border; completed and upcoming nodes use opacity rather than color.

- [ ] **Step 5: Run the focused test and confirm GREEN**

Run: `npm test -- --run src/motion/StepFlow.test.tsx`

Expected: both five-step and compact three-step tests pass.

- [ ] **Step 6: Commit StepFlow**

```powershell
git add src/motion/StepFlow.tsx src/motion/StepFlow.test.tsx src/styles.css
git commit -m "feat: draw pencil step path"
```

### Task 6: Verify the full workbench and safe zones

**Files:**
- Modify: `src/components/Workbench.test.tsx`
- Modify: `docs/superpowers/plans/2026-07-25-pencil-motion-components.md`

- [ ] **Step 1: Add a workbench-level style assertion**

After selecting each component in the existing six-component test, assert that the active `.motion-canvas` has `data-pencil-style="silver-on-black"`. Add this attribute to the root element of all six renderers.

- [ ] **Step 2: Run the workbench test and confirm RED, then add the six root attributes**

Run: `npm test -- --run src/components/Workbench.test.tsx`

Expected: FAIL before the root attributes are added, then PASS after every renderer uses:

```tsx
<div className="motion-canvas …" data-pencil-style="silver-on-black">
```

- [ ] **Step 3: Run complete automated verification**

Run:

```powershell
npm test -- --run
npm run lint
npm run build
git diff --check
```

Expected: all tests pass, ESLint exits 0, Vite production build exits 0, and `git diff --check` emits no errors.

- [ ] **Step 4: Inspect all six components in the browser**

At the local preview URL, switch through 核心指标、对比卡片、人物信息、柱状对比、环形占比、步骤流程. For each component verify:

- `data-pencil-style="silver-on-black"` is present.
- The primary element remains in `data-zone="left-primary"`.
- Secondary content remains in `data-zone="right-secondary"`.
- No component content crosses the person safe rectangle.
- No component content enters the bottom 150px subtitle safe area.
- Text remains Chinese and no element is clipped.

- [ ] **Step 5: Mark all plan checkboxes complete and commit**

```powershell
git add src docs/superpowers/plans/2026-07-25-pencil-motion-components.md
git commit -m "test: verify pencil motion workbench"
```
