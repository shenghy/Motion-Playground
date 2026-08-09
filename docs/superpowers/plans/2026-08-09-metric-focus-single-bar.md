# Metric Focus Single-Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `metric-focus` as a dense single-bar data rail that stays entirely left of the 39% presenter safe line and exports identically to the React preview.

**Architecture:** Extend the existing deterministic metric state with one monotonic `bar.reveal` value. React and Canvas consume that shared state, use the existing JSON parameters unchanged, and independently render the same compact value-unit-bar composition inside a shared 38% safety boundary.

**Tech Stack:** React, Motion, TypeScript, CSS container units, Canvas 2D, Vitest, Testing Library, Vite, FFmpeg.

---

## File map

- Modify `src/motion/canvas/metricFocusState.ts`: expose deterministic single-bar reveal progress.
- Modify `src/motion/canvas/metricFocusState.test.ts`: lock start, completion, and hold states.
- Modify `src/motion/MetricFocus.tsx`: replace the long axis/ticks with the compact value-unit-single-bar row.
- Modify `src/motion/MetricFocus.test.tsx`: lock semantic grouping and one-bar structure.
- Modify `src/styles.css`: constrain metric-only texture/grid and content to the 38% safe region.
- Modify `src/motion/canvas/metricFocusRenderer.ts`: mirror the compact layout and dynamic suffix position.
- Modify `src/motion/canvas/metricFocusRenderer.test.ts`: prove every visible Canvas boundary stays below 729.6px.

### Task 1: Shared single-bar animation state

**Files:**
- Modify: `src/motion/canvas/metricFocusState.ts`
- Test: `src/motion/canvas/metricFocusState.test.ts`

- [ ] **Step 1: Write the failing state test**

Add assertions that describe the required one-shot bar:

```ts
expect(getMetricFocusState(params, 0).bar.reveal).toBe(0)
expect(getMetricFocusState(params, 1.2).bar.reveal).toBe(1)
expect(getMetricFocusState(params, 8).bar.reveal).toBe(1)
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm test -- --run src/motion/canvas/metricFocusState.test.ts
```

Expected: FAIL because `bar` does not exist.

- [ ] **Step 3: Implement the minimal shared state**

In `getMetricFocusState`, add a bar reveal driven by the same deterministic entrance clock as the value:

```ts
bar: {
  reveal: samplePencilEase(
    delayedProgress(time, 0.28, entranceDuration),
  ),
},
```

Do not add exit or modulo behavior.

- [ ] **Step 4: Run the state test and verify GREEN**

Run the same Vitest command. Expected: PASS.

### Task 2: Dense React composition inside the safety boundary

**Files:**
- Modify: `src/motion/MetricFocus.tsx`
- Modify: `src/styles.css`
- Test: `src/motion/MetricFocus.test.tsx`

- [ ] **Step 1: Write failing React structure tests**

Require a single semantic value rail and remove the old spreading elements:

```ts
const rail = screen.getByTestId('metric-value-rail')
expect(within(rail).getByTestId('metric-number')).toHaveTextContent('248')
expect(within(rail).getByText('%')).toBeInTheDocument()
expect(within(rail).getAllByTestId('metric-single-bar')).toHaveLength(1)
expect(screen.queryByTestId('metric-axis')).not.toBeInTheDocument()
expect(screen.queryByTestId('metric-ticks')).not.toBeInTheDocument()
```

At `playbackTime={0}`, assert the bar transform is `scaleY(0)`; after completion, assert it is no longer zero.

- [ ] **Step 2: Run the React test and verify RED**

Run:

```powershell
npm test -- --run src/motion/MetricFocus.test.tsx
```

Expected: FAIL because the value rail and single bar do not exist and the old axis/ticks remain.

- [ ] **Step 3: Implement the React value rail**

Replace the separate value/axis/ticks block with:

```tsx
<motion.div className="metric-focus__value-rail" data-testid="metric-value-rail">
  <div className="metric-focus__value">...</div>
  <div className="metric-focus__single-bar" data-testid="metric-single-bar">
    <motion.i style={{ scaleY: sampled?.bar.reveal ?? 1 }} />
  </div>
</motion.div>
```

Keep prefix, number, and suffix inside `.metric-focus__value`, with `align-items: baseline` and `white-space: nowrap`.

- [ ] **Step 4: Implement metric-only CSS safety and density**

Use these hard layout constraints:

```css
.metric-focus > .canvas-grid,
.metric-focus > .pencil-texture {
  right: auto;
  width: 38%;
}

.metric-focus__frame[data-metric-layout='data-rail'] {
  left: 6.35%;
  width: 31.65%;
}

.metric-focus__value-rail {
  display: flex;
  align-items: flex-end;
}

.metric-focus__value {
  display: flex;
  align-items: baseline;
  white-space: nowrap;
}

.metric-focus__single-bar i {
  transform-origin: center bottom;
}
```

Set a compact number size near `6.8cqw`, reduce vertical margins, and keep the description/trend above the subtitle safe area.

- [ ] **Step 5: Run React and layout tests**

Run:

```powershell
npm test -- --run src/motion/MetricFocus.test.tsx src/layoutContract.test.ts
```

Expected: PASS.

### Task 3: Canvas parity and strict 38% drawing boundary

**Files:**
- Modify: `src/motion/canvas/metricFocusRenderer.ts`
- Test: `src/motion/canvas/metricFocusRenderer.test.ts`

- [ ] **Step 1: Write the failing Canvas boundary test**

Collect all line endpoints, rectangle right edges, and text maximum right edges, then enforce the design boundary:

```ts
const safeRight = 1920 * 0.38
expect(lineEndpoints.every(([x]) => Number(x) <= safeRight)).toBe(true)
expect(rectangleRightEdges.every((right) => right <= safeRight)).toBe(true)
expect(textRightEdges.every((right) => right <= safeRight)).toBe(true)
expect(ctx.fillRect).toHaveBeenCalledWith(
  expect.any(Number),
  expect.any(Number),
  expect.any(Number),
  expect.any(Number),
)
```

Also render at `localTime: 0` and completion to assert the bar fill height grows from `0` to the fixed visual height.

- [ ] **Step 2: Run the Canvas test and verify RED**

Run:

```powershell
npm test -- --run src/motion/canvas/metricFocusRenderer.test.ts
```

Expected: FAIL because the current grid and 1010px axis cross the 729.6px boundary.

- [ ] **Step 3: Implement the compact Canvas renderer**

Use constants that make the boundary auditable:

```ts
const SAFE_RIGHT = 1920 * 0.38
const CONTENT_X = 122
const BAR_WIDTH = 24
const BAR_HEIGHT = 112
```

Draw the grid only to `SAFE_RIGHT`. Measure prefix, formatted number, and suffix with their actual fonts, then place the bar after the suffix. Draw one track with `strokeRect` and one fill with:

```ts
const visibleHeight = BAR_HEIGHT * state.bar.reveal
ctx.fillRect(barX, barBottom - visibleHeight, BAR_WIDTH, visibleHeight)
```

Remove the old long axis and eleven ticks. Clamp the bar and all text max widths before `SAFE_RIGHT`.

- [ ] **Step 4: Run Canvas and parity-focused tests**

Run:

```powershell
npm test -- --run src/motion/canvas/metricFocusRenderer.test.ts src/export/canvas/visualFixtures.test.ts src/motion/MetricFocus.test.tsx
```

Expected: PASS.

### Task 4: Full verification and transparent export

**Files:**
- Verify all modified source and test files.

- [ ] **Step 1: Run static and full automated verification**

```powershell
npm run lint
npm test -- --run
npm run build
git diff --check
```

Expected: lint succeeds, all test files pass, production build succeeds, and diff check emits no errors.

- [ ] **Step 2: Run a real 60-frame transparent MOV export**

```powershell
$env:BENCHMARK_FRAMES='60'
node scripts\run-worker-export-benchmark.mjs short
```

Expected: `status=completed`, 60/60 frames, and Canvas parity differences all zero.

- [ ] **Step 3: Verify the MOV contract**

```powershell
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,pix_fmt,width,height,r_frame_rate,nb_frames -of default=noprint_wrappers=1 '<benchmark outputPath>'
```

Expected: ProRes, `yuva444p12le`, 1920×1080, 30fps, 60 frames.

- [ ] **Step 4: Review the final diff**

Confirm no JSON schema changes, no modifications to the other seven motion components, no loops, and no content beyond 38% for `metric-focus`.
