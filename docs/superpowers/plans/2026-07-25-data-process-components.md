# Data and Process Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add presenter-safe BarCompare, ShareRing, and StepFlow motion components to the existing preview workbench, increasing the registry from three to six components.

**Architecture:** Extend the explicit parameter contracts and registry already used by the first three motions. Each new component remains a self-contained React/Motion renderer with left-primary and right-secondary zones; shared numeric normalization lives in one small pure utility module, while SVG is used only for the ring arcs.

**Tech Stack:** React, TypeScript, Motion for React, SVG, CSS container units, Vitest, React Testing Library, ESLint, Vite.

---

### Task 1: Add shared data normalization with tests

**Files:**
- Create: `src/motion/dataMath.ts`
- Create: `src/motion/dataMath.test.ts`

- [x] **Step 1: Write failing normalization tests**

```ts
import { clampDataValue, normalizeShares, resolveFocusIndex } from './dataMath'

describe('dataMath', () => {
  it('clamps invalid values', () => {
    expect(clampDataValue(-2, 100)).toBe(0)
    expect(clampDataValue(140, 100)).toBe(100)
    expect(clampDataValue(Number.NaN, 100)).toBe(0)
  })

  it('normalizes shares and evenly divides an all-zero set', () => {
    expect(normalizeShares([60, 30, 10])).toEqual([60, 30, 10])
    expect(normalizeShares([0, 0])).toEqual([50, 50])
  })

  it('uses the requested focus or falls back to the largest value', () => {
    expect(resolveFocusIndex([20, 70, 10], '2')).toBe(1)
    expect(resolveFocusIndex([20, 70, 10], '9')).toBe(1)
  })
})
```

- [x] **Step 2: Run the test and confirm RED**

Run: `npm test -- --run src/motion/dataMath.test.ts`

Expected: FAIL because `./dataMath` does not exist.

- [x] **Step 3: Implement the pure helpers**

```ts
export function clampDataValue(value: number, max: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(max, Math.max(0, value))
}

export function normalizeShares(values: number[]) {
  const safe = values.map((value) => clampDataValue(value, 10000))
  const total = safe.reduce((sum, value) => sum + value, 0)
  if (total === 0) return safe.map(() => 100 / safe.length)
  return safe.map((value) => (value / total) * 100)
}

export function resolveFocusIndex(values: number[], requested: string) {
  const parsed = Number.parseInt(requested, 10) - 1
  if (parsed >= 0 && parsed < values.length) return parsed
  return values.reduce(
    (largest, value, index) => value > values[largest] ? index : largest,
    0,
  )
}
```

- [x] **Step 4: Run the test and confirm GREEN**

Run: `npm test -- --run src/motion/dataMath.test.ts`

Expected: 3 tests pass.

- [x] **Step 5: Commit**

```bash
git add src/motion/dataMath.ts src/motion/dataMath.test.ts
git commit -m "test: add motion data normalization"
```

### Task 2: Extend types, registry, preview routing, and workbench state

**Files:**
- Modify: `src/motion/types.ts`
- Modify: `src/motion/registry.ts`
- Modify: `src/components/PreviewStage.tsx`
- Modify: `src/components/Workbench.tsx`
- Modify: `src/components/Workbench.test.tsx`

- [ ] **Step 1: Extend the workbench test with six registered entries**

Add switching assertions:

```ts
expect(screen.getAllByRole('button', { name: /MetricFocus|CompareSplit|ProfileReveal|BarCompare|ShareRing|StepFlow/ })).toHaveLength(6)

fireEvent.click(screen.getByRole('button', { name: /BarCompare/ }))
expect(screen.getByText('季度增长')).toBeInTheDocument()

fireEvent.click(screen.getByRole('button', { name: /ShareRing/ }))
expect(screen.getByText('用户构成')).toBeInTheDocument()

fireEvent.click(screen.getByRole('button', { name: /StepFlow/ }))
expect(screen.getByText('发布流程')).toBeInTheDocument()
```

- [ ] **Step 2: Run the workbench test and confirm RED**

Run: `npm test -- --run src/components/Workbench.test.tsx`

Expected: FAIL because the three buttons do not exist.

- [ ] **Step 3: Add explicit parameter contracts**

Add `BarCompareParams`, `ShareRingParams`, and `StepFlowParams`. Bar and share params contain `item1Label` through `item4Label`, matching numeric values, a string focus index, suffix, conclusion copy, and duration. Step params contain `step1` through `step5`, a string focus index, status copy, and `stepDuration`.

Update:

```ts
export type MotionId =
  | 'metric-focus'
  | 'compare-split'
  | 'profile-reveal'
  | 'bar-compare'
  | 'share-ring'
  | 'step-flow'
```

- [ ] **Step 4: Register entries 04–06**

Add definitions with these identities and defaults:

```ts
{
  id: 'bar-compare',
  index: '04',
  name: 'BarCompare',
  category: 'DATA / COLUMN',
  description: '柱状数据对比',
}
{
  id: 'share-ring',
  index: '05',
  name: 'ShareRing',
  category: 'SHARE / RATIO',
  description: '环形占比分析',
}
{
  id: 'step-flow',
  index: '06',
  name: 'StepFlow',
  category: 'PROCESS / FLOW',
  description: '步骤流程讲解',
}
```

Use default bar data `Q1 32`, `Q2 48`, `Q3 67`, `Q4 86`; share data `核心用户 62`, `成长用户 20`, `观察用户 12`, `其他 6`; and five release steps from “明确目标” through “正式发布”.

- [ ] **Step 5: Route the components and initialize playback keys**

Import each renderer in `PreviewStage.tsx`, add switch cases, and add zero-valued keys for the new IDs in `Workbench.tsx`.

- [ ] **Step 6: Run TypeScript-aware tests**

Run: `npm test -- --run src/components/Workbench.test.tsx`

Expected: component modules remain missing until Tasks 3–5, but the registry/type errors are resolved.

### Task 3: Build BarCompare with TDD

**Files:**
- Create: `src/motion/BarCompare.tsx`
- Create: `src/motion/BarCompare.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing component test**

Render four defaults and assert title, labels, values, exactly four `data-testid="bar-column"` elements, `data-focused="true"` on Q4, plus `bar-primary`/`bar-secondary` safe-zone markers.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- --run src/motion/BarCompare.test.tsx`

Expected: FAIL because `BarCompare.tsx` does not exist.

- [ ] **Step 3: Implement the presenter-safe renderer**

Build data items from non-empty labels, clamp values to `0–9999`, derive the focus with `resolveFocusIndex`, and calculate each height relative to the maximum:

```ts
const height = maximum === 0 ? 12 : Math.max(12, (item.value / maximum) * 100)
```

Animate the baseline first, then the columns with `scaleY`, then labels and values. Apply `data-zone="left-primary"` to the main card and `data-zone="right-secondary"` to the conclusion rail.

- [ ] **Step 4: Add scoped Precision Spatial styles**

Add `.bar-compare__card`, `.bar-compare__plot`, `.bar-compare__column`, and `.bar-compare__result` rules. Keep the card within left `4%–35%`, result within right `87%–97%`, use gray columns, and make only the focused column wider and cold white.

- [ ] **Step 5: Run the focused test**

Run: `npm test -- --run src/motion/BarCompare.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/motion/BarCompare.tsx src/motion/BarCompare.test.tsx src/styles.css src/motion/types.ts src/motion/registry.ts src/components/PreviewStage.tsx src/components/Workbench.tsx src/components/Workbench.test.tsx
git commit -m "feat: add presenter-safe bar comparison"
```

### Task 4: Build ShareRing with SVG and TDD

**Files:**
- Create: `src/motion/ShareRing.tsx`
- Create: `src/motion/ShareRing.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing ring tests**

Assert four `data-testid="share-segment"` circles, center value `62%`, four legend labels, focused segment state, and both safe zones. Add a zero-total case expecting a `50%` center value for two active items.

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm test -- --run src/motion/ShareRing.test.tsx`

Expected: FAIL because `ShareRing.tsx` does not exist.

- [ ] **Step 3: Implement the SVG ring**

Use a shared radius and circumference:

```ts
const radius = 42
const circumference = 2 * Math.PI * radius
const length = circumference * percentage / 100
const gap = 2.4
```

Rotate the SVG `-90deg`, accumulate prior percentages into `strokeDashoffset`, animate `pathLength`, and vary stroke width and opacity based on focus/rank. Render the center percentage and compact legend separately from the SVG.

- [ ] **Step 4: Add scoped ring styles**

Add `.share-ring__card`, `.share-ring__visual`, `.share-ring__legend`, and `.share-ring__result`. Use only cold white and neutral gray strokes; no colored legend dots.

- [ ] **Step 5: Run the focused test**

Run: `npm test -- --run src/motion/ShareRing.test.tsx`

Expected: both tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/motion/ShareRing.tsx src/motion/ShareRing.test.tsx src/styles.css
git commit -m "feat: add grayscale share ring"
```

### Task 5: Build StepFlow with five-step sequencing and TDD

**Files:**
- Create: `src/motion/StepFlow.tsx`
- Create: `src/motion/StepFlow.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing component test**

Assert five step titles, five `data-testid="flow-step"` elements, the configured initial focus, current status copy, and both safe-zone markers. Add a three-step case by blanking steps four and five and assert only three rows render.

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm test -- --run src/motion/StepFlow.test.tsx`

Expected: FAIL because `StepFlow.tsx` does not exist.

- [ ] **Step 3: Implement normalized looping keyframes**

Filter blank steps and derive a rotating order from `focusStep`. Each row uses opacity, scale, and height keyframes so one step expands to `1.5×` while completed and upcoming steps remain subdued. The right rail renders timed overlays for the same ordered steps. When reduced motion is enabled, show only the configured focus as active with no loop.

- [ ] **Step 4: Add scoped process styles**

Add `.step-flow__card`, `.step-flow__steps`, `.step-flow__step`, `.step-flow__connector`, and `.step-flow__status`. Fit five steps inside the left card; use white for active, medium gray for completed, deep gray for upcoming.

- [ ] **Step 5: Run the focused test**

Run: `npm test -- --run src/motion/StepFlow.test.tsx`

Expected: both tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/motion/StepFlow.tsx src/motion/StepFlow.test.tsx src/styles.css
git commit -m "feat: add animated five-step flow"
```

### Task 6: Polish the six-component workbench and verify

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/ComponentRail.tsx`
- Modify: `docs/superpowers/plans/2026-07-25-data-process-components.md`

- [ ] **Step 1: Add rail thumbnails and six-module copy**

Create distinct monochrome miniatures for `bar-compare`, `share-ring`, and `step-flow`. Change the footer to `06 MODULES`; keep `.rail-list` vertically scrollable and preserve keyboard focus.

- [ ] **Step 2: Run the complete automated suite**

Run:

```bash
npm test -- --run
npm run lint
npm run build
```

Expected: all tests pass, ESLint exits zero, and Vite creates `dist/`.

- [ ] **Step 3: Verify in the browser**

At `http://127.0.0.1:4173/`:

- confirm six rail buttons;
- inspect all three animations on the presenter image;
- change one value/text parameter in each component;
- use reset and replay;
- compare bounding boxes for both zones against the presenter-safe area;
- test maximum text/data entries for overflow;
- confirm no runtime errors are visible.

- [ ] **Step 4: Mark the plan complete and commit**

```bash
git add src docs/superpowers/plans/2026-07-25-data-process-components.md
git commit -m "feat: complete data motion collection"
```
