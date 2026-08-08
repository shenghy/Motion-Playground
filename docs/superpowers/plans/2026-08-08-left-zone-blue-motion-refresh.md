# Left-Zone Blue Motion Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Metric Focus as the selected Axis Reading composition, add one shared deep-blue accent system, and keep every motion's visible content inside the left 60% of the video.

**Architecture:** Preserve the current typed motion registry and parameter schemas. React motion components and their Canvas renderers will adopt the same left-zone contract and shared accent tokens; right-side auxiliary nodes/draw calls are removed while Compare Split retains both datasets inside its left-side composition.

**Tech Stack:** React 19, TypeScript, Motion, Canvas 2D/OffscreenCanvas, Vitest, Testing Library, CSS.

---

### Task 1: Establish the shared accent and left-zone contracts

**Files:**
- Modify: `src/export/canvas/primitives.ts`
- Modify: `src/styles.css`
- Test: `src/export/canvas/primitives.test.ts`

- [ ] **Step 1: Write the failing Canvas color contract test**

Add an assertion that the exported primitive palette exposes one canonical deep blue:

```ts
expect(CANVAS_COLORS.accentBlue).toBe('#2f67b2')
expect(CANVAS_COLORS.accentBlueMuted).toBe('rgba(47,103,178,.42)')
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- --run src/export/canvas/primitives.test.ts`

Expected: FAIL because the two accent keys do not exist.

- [ ] **Step 3: Add the canonical React and Canvas tokens**

Add to `CANVAS_COLORS`:

```ts
accentBlue: '#2f67b2',
accentBlueMuted: 'rgba(47,103,178,.42)',
```

Add to `.motion-canvas[data-pencil-style='silver-on-black']`:

```css
--motion-accent-blue: #2f67b2;
--motion-accent-blue-muted: rgba(47, 103, 178, .42);
--motion-accent-blue-faint: rgba(47, 103, 178, .16);
--motion-content-width: 60%;
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- --run src/export/canvas/primitives.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the shared contracts**

```powershell
git add src/export/canvas/primitives.ts src/export/canvas/primitives.test.ts src/styles.css
git commit -m "feat: add motion accent and left-zone tokens"
```

### Task 2: Rebuild Metric Focus as Axis Reading

**Files:**
- Modify: `src/motion/MetricFocus.tsx`
- Modify: `src/motion/MetricFocus.test.tsx`
- Modify: `src/motion/canvas/metricFocusRenderer.ts`
- Modify: `src/motion/canvas/metricFocusRenderer.test.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing React structure assertions**

Require the new layout contract and remove the old auxiliary area:

```ts
expect(screen.getByTestId('metric-primary')).toHaveAttribute(
  'data-metric-layout',
  'axis-reading',
)
expect(screen.getByTestId('metric-axis')).toBeInTheDocument()
expect(screen.getByTestId('metric-ticks')).toBeInTheDocument()
expect(screen.queryByTestId('metric-secondary')).not.toBeInTheDocument()
```

- [ ] **Step 2: Write a failing Canvas boundary assertion**

Record Canvas draw calls and assert that Metric Focus does not draw text or panels at `x >= 1152` and that at least one accent-blue axis call exists.

- [ ] **Step 3: Run Metric Focus tests and confirm RED**

Run: `npm test -- --run src/motion/MetricFocus.test.tsx src/motion/canvas/metricFocusRenderer.test.ts`

Expected: FAIL because the old secondary panel remains and the new axis markers are absent.

- [ ] **Step 4: Implement the React Axis Reading structure**

Use one `metric-focus__frame` with:

```tsx
<span className="metric-focus__english">QUARTERLY GROWTH / 02</span>
<motion.div className="metric-focus__value">...</motion.div>
<motion.div className="metric-focus__axis" data-testid="metric-axis" />
<motion.div className="metric-focus__ticks" data-testid="metric-ticks">...</motion.div>
<motion.div className="metric-focus__meta">...</motion.div>
```

Delete the `metric-focus__secondary` aside. Keep the count-up and reduced-motion behavior.

- [ ] **Step 5: Implement matching CSS and Canvas output**

Constrain the composition to the left 60%, use deep blue for the English eyebrow, unit, leading axis segment and ticks, retain a cold-white main number, and delete all secondary panel draw calls. Remove the old full-width scan decoration.

- [ ] **Step 6: Run Metric Focus tests and confirm GREEN**

Run: `npm test -- --run src/motion/MetricFocus.test.tsx src/motion/canvas/metricFocusRenderer.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit Metric Focus**

```powershell
git add src/motion/MetricFocus.tsx src/motion/MetricFocus.test.tsx src/motion/canvas/metricFocusRenderer.ts src/motion/canvas/metricFocusRenderer.test.ts src/styles.css
git commit -m "feat: redesign metric focus as axis reading"
```

### Task 3: Remove auxiliary right-side content from four motions

**Files:**
- Modify: `src/motion/ProfileReveal.tsx`
- Modify: `src/motion/BarCompare.tsx`
- Modify: `src/motion/ShareRing.tsx`
- Modify: `src/motion/StepFlow.tsx`
- Modify: `src/motion/ProfileReveal.test.tsx`
- Modify: `src/motion/BarCompare.test.tsx`
- Modify: `src/motion/ShareRing.test.tsx`
- Modify: `src/motion/StepFlow.test.tsx`
- Modify: `src/motion/canvas/profileRevealRenderer.ts`
- Modify: `src/motion/canvas/barCompareRenderer.ts`
- Modify: `src/motion/canvas/shareRingRenderer.ts`
- Modify: `src/motion/canvas/stepFlowRenderer.ts`
- Create: `src/motion/canvas/rightZoneRenderers.test.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing React removal assertions**

Replace old right-side expectations with:

```ts
expect(screen.queryByTestId('profile-secondary')).not.toBeInTheDocument()
expect(screen.queryByTestId('bar-secondary')).not.toBeInTheDocument()
expect(screen.queryByTestId('share-secondary')).not.toBeInTheDocument()
expect(screen.queryByTestId('flow-secondary')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run the four component tests and confirm RED**

Run: `npm test -- --run src/motion/ProfileReveal.test.tsx src/motion/BarCompare.test.tsx src/motion/ShareRing.test.tsx src/motion/StepFlow.test.tsx`

Expected: FAIL because the auxiliary asides still render.

- [ ] **Step 3: Delete the React auxiliary nodes**

Remove `profile-reveal__rail`, `bar-compare__result`, `share-ring__result`, and `step-flow__status`. Do not delete their parameter fields or change registry defaults.

- [ ] **Step 4: Write the Canvas right-zone regression test**

Render Profile Reveal, Bar Compare, Share Ring and Step Flow into one recording context per renderer. Assert that panel/text/line coordinates do not enter `x >= 1152`, then run `npm test -- --run src/motion/canvas/rightZoneRenderers.test.ts` and confirm it fails against the old right-side draw calls.

- [ ] **Step 5: Delete matching Canvas right-side drawing**

Remove each renderer's `rx`/`railX` panel and all text/line calls using those coordinates. Ensure remaining draw calls stay below the 1152px left-zone boundary.

- [ ] **Step 6: Apply deep-blue auxiliary emphasis**

Use the shared token for profile checks, the focused bar, the focused ring segment, active step number/circle, English headers and short accent lines. Keep unselected data gray and primary text cold white.

- [ ] **Step 7: Run focused React and Canvas tests**

Run: `npm test -- --run src/motion/ProfileReveal.test.tsx src/motion/BarCompare.test.tsx src/motion/ShareRing.test.tsx src/motion/StepFlow.test.tsx src/motion/canvas`

Expected: PASS.

- [ ] **Step 8: Commit the four motions**

```powershell
git add src/motion/ProfileReveal* src/motion/BarCompare* src/motion/ShareRing* src/motion/StepFlow* src/motion/canvas/profileRevealRenderer.ts src/motion/canvas/barCompareRenderer.ts src/motion/canvas/shareRingRenderer.ts src/motion/canvas/stepFlowRenderer.ts src/motion/canvas/rightZoneRenderers.test.ts src/styles.css
git commit -m "feat: remove motion right-side auxiliaries"
```

### Task 4: Reflow Compare Split and accent Narrative

**Files:**
- Modify: `src/motion/CompareSplit.tsx`
- Modify: `src/motion/CompareSplit.test.tsx`
- Modify: `src/motion/Narrative.tsx`
- Modify: `src/motion/Narrative.test.tsx`
- Modify: `src/motion/canvas/compareSplitRenderer.ts`
- Modify: `src/motion/canvas/narrativeRenderer.ts`
- Create: `src/motion/canvas/compareSplitRenderer.test.ts`
- Modify: `src/motion/canvas/narrativeRenderer.test.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing left-zone semantic tests**

Assert that both comparison groups remain present but are marked as left-zone content:

```ts
expect(screen.getByTestId('compare-left')).toHaveAttribute('data-zone', 'left-primary')
expect(screen.getByTestId('compare-right')).toHaveAttribute('data-zone', 'left-primary')
expect(screen.getByTestId('compare-result')).toHaveAttribute('data-zone', 'left-primary')
```

Assert Narrative retains no right-side nodes and exposes its accent eyebrow marker.

- [ ] **Step 2: Run Compare and Narrative tests and confirm RED**

Run: `npm test -- --run src/motion/CompareSplit.test.tsx src/motion/Narrative.test.tsx src/motion/canvas/compareSplitRenderer.test.ts src/motion/canvas/narrativeRenderer.test.ts`

Expected: FAIL because Compare's second group still declares `right-secondary` and Canvas occupies the right half.

- [ ] **Step 3: Reflow Compare inside the left zone**

Keep both labels, values, emphasis state and conclusion. Place the two compact panels within a container capped at 60% canvas width; place the conclusion directly below them within the same boundary.

- [ ] **Step 4: Update Canvas Compare coordinates**

Use two compact boxes within `x = 82..1110`; keep the conclusion within the same range and use deep blue for the emphasized meter/label accents.

- [ ] **Step 5: Accent Narrative without changing its layout**

Apply deep blue to `NARRATIVE / 01`, its short rule and matching Canvas calls. Keep its two-line headline and explanatory copy unchanged.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run: `npm test -- --run src/motion/CompareSplit.test.tsx src/motion/Narrative.test.tsx src/motion/canvas/compareSplitRenderer.test.ts src/motion/canvas/narrativeRenderer.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit Compare and Narrative**

```powershell
git add src/motion/CompareSplit* src/motion/Narrative* src/motion/canvas/compareSplitRenderer* src/motion/canvas/narrativeRenderer* src/styles.css
git commit -m "feat: confine comparison motions to left zone"
```

### Task 5: Verify parity, review, and finish master

**Files:**
- Verify: `src/motion/**`
- Verify: `src/export/canvas/**`
- Verify: `docs/superpowers/specs/2026-08-08-left-zone-blue-accent-metric-redesign.md`

- [ ] **Step 1: Search for obsolete right-side rendering**

Run:

```powershell
rg -n "right-secondary|metric-secondary|profile-secondary|bar-secondary|share-secondary|flow-secondary|railX|const rx = 1670" src/motion
```

Expected: no active motion rendering matches; test names may appear only in negative assertions.

- [ ] **Step 2: Run the full automated verification**

Run:

```powershell
npm test -- --run
npm run lint
npm run build
git diff --check
```

Expected: all tests pass, ESLint exits 0, production build exits 0, and diff check is empty.

- [ ] **Step 3: Verify the local page visually**

Inspect all seven motion previews. Confirm the Metric Focus Axis Reading layout, auxiliary deep-blue usage, empty video right side, preserved Compare semantics, and no visible React/Canvas mismatch.

- [ ] **Step 4: Request code review**

Review the implementation against commit `1716ec7` and the design spec. Fix all Critical and Important findings, then repeat Step 2.

- [ ] **Step 5: Commit final review fixes if needed**

```powershell
git add src docs
git commit -m "fix: align left-zone motion parity"
```

- [ ] **Step 6: Confirm master is clean**

Run: `git status --porcelain; git branch --show-current; git log -6 --oneline`

Expected: empty status, branch `master`, and all implementation commits visible.
