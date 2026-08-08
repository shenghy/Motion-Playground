# Seven-Step Flow Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the step-flow motion as a left-side seven-step vertical timeline with sequential blue focus animation and preview/export parity.

**Architecture:** Extend the existing `StepFlowParams` contract and registry to seven steps, then make both React and Canvas renderers consume the same 3–7-step semantics. Keep the existing project version and rely on the current defaults-plus-overrides parser for older projects.

**Tech Stack:** React, TypeScript, Motion, Canvas 2D, CSS, Vitest, Testing Library

---

### Task 1: Extend the step-flow parameter contract

**Files:**
- Modify: `src/motion/types.ts:105-118`
- Modify: `src/motion/registry.ts:272-315`
- Modify: `src/motion/StepFlow.test.tsx`
- Modify: `src/motion/canvas/stepFlowState.test.ts`
- Modify: `src/motion/canvas/rightZoneRenderers.test.ts`

- [ ] **Step 1: Write failing seven-step parameter tests**

Update the shared `StepFlowParams` fixtures with:

```ts
step6: '最终确认',
step7: '正式发布',
focusStep: '6',
```

Add assertions in `StepFlow.test.tsx`:

```ts
expect(screen.getAllByTestId('flow-step')).toHaveLength(7)
expect(screen.getAllByTestId('flow-step')[5]).toHaveAttribute(
  'data-initial-focus',
  'true',
)
```

Add a registry assertion that the `step-flow` definition exposes `step6`, `step7`, and seven focus options.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm test -- --run src/motion/StepFlow.test.tsx src/motion/canvas/stepFlowState.test.ts
```

Expected: failures because the type, component, and state helper still stop at five steps.

- [ ] **Step 3: Extend types and registry defaults**

Change the contract to:

```ts
step5: string
step6: string
step7: string
focusStep: '1' | '2' | '3' | '4' | '5' | '6' | '7'
```

Use these seven default labels in `registry.ts`:

```ts
step1: '明确目标',
step2: '准备内容',
step3: '构建版本',
step4: '内部检查',
step5: '修正问题',
step6: '最终确认',
step7: '正式发布',
```

Add text controls for `step6` and `step7`, each with `maxLength: 12`, and add focus options `6` and `7`.

- [ ] **Step 4: Run type-aware focused tests**

Run:

```powershell
npm test -- --run src/motion/StepFlow.test.tsx src/motion/canvas/stepFlowState.test.ts src/motion/canvas/rightZoneRenderers.test.ts
npm run build
```

Expected: remaining failures are limited to five-step collection/rendering; TypeScript fixtures are complete.

- [ ] **Step 5: Commit the parameter contract**

```powershell
git add src/motion/types.ts src/motion/registry.ts src/motion/StepFlow.test.tsx src/motion/canvas/stepFlowState.test.ts src/motion/canvas/rightZoneRenderers.test.ts
git commit -m "feat: extend step flow to seven parameters"
```

### Task 2: Build the seven-step React timeline

**Files:**
- Modify: `src/motion/StepFlow.tsx`
- Modify: `src/motion/StepFlow.test.tsx`
- Modify: `src/styles.css:2918-2990`
- Modify: `src/styles.css:3509-3590`

- [ ] **Step 1: Add failing behavior and layout-contract assertions**

In `StepFlow.test.tsx`, verify seven items, configured focus, and compact filtering:

```ts
render(<StepFlow params={{ ...params, step4: '', step7: '' }} />)
expect(screen.getAllByTestId('flow-step')).toHaveLength(5)
expect(screen.getAllByTestId('flow-step').map((node) => node.textContent)).toEqual([
  '01明确目标',
  '02准备内容',
  '03构建版本',
  '04修正问题',
  '05最终确认',
])
```

Add CSS contract assertions that `.step-flow__steps` uses a single column, `.step-flow__card` ends above `var(--subtitle-safe-bottom)`, and the active/completed accents use `--motion-accent-blue`.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npm test -- --run src/motion/StepFlow.test.tsx src/layoutContract.test.ts
```

Expected: seven-step and vertical-timeline assertions fail.

- [ ] **Step 3: Collect up to seven steps in React**

Replace the source list with:

```ts
const sourceSteps = [
  params.step1,
  params.step2,
  params.step3,
  params.step4,
  params.step5,
  params.step6,
  params.step7,
]
  .map((step) => step.trim())
  .filter(Boolean)
  .slice(0, 7)
```

Keep the existing three-step fallback and sequence timing. Add `data-step-state="active|complete|upcoming"` so CSS and browser verification can distinguish progress states without parsing animation styles.

- [ ] **Step 4: Replace the curved five-step layout with a vertical timeline**

Use one straight SVG path with `viewBox="0 0 80 600"` and a centered vertical path from the first to last row. Update CSS to:

```css
.step-flow__steps {
  grid-template-rows: repeat(var(--step-count), minmax(0, 1fr));
  gap: .14cqw;
  margin-top: .7cqw;
}

.step-flow__step {
  width: 92%;
  grid-template-columns: 1.7cqw minmax(0, 1fr);
  gap: .62cqw;
  padding: .08cqw .1cqw;
}
```

Set `--step-count` from the component and keep the card bottom at `calc(var(--subtitle-safe-bottom) + 3%)`. Use deep blue for active/complete progress and gray for upcoming steps; the current step scales no more than `1.12` so seven rows never collide.

- [ ] **Step 5: Run React and CSS tests**

```powershell
npm test -- --run src/motion/StepFlow.test.tsx src/layoutContract.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 6: Commit the React timeline**

```powershell
git add src/motion/StepFlow.tsx src/motion/StepFlow.test.tsx src/styles.css src/layoutContract.test.ts
git commit -m "feat: redesign step flow as a vertical timeline"
```

### Task 3: Match the Canvas export renderer

**Files:**
- Modify: `src/motion/canvas/stepFlowState.ts`
- Modify: `src/motion/canvas/stepFlowState.test.ts`
- Modify: `src/motion/canvas/stepFlowRenderer.ts`
- Create: `src/motion/canvas/stepFlowRenderer.test.ts`

- [ ] **Step 1: Write failing state and renderer tests**

Expect seven-step focus order:

```ts
expect(getStepFlowState(params, 0).orderedIndexes).toEqual([
  5, 6, 0, 1, 2, 3, 4,
])
```

In `stepFlowRenderer.test.ts`, provide a mocked Canvas context and assert:

```ts
expect(drawnText).toEqual(expect.arrayContaining([
  '明确目标', '准备内容', '构建版本', '内部检查',
  '修正问题', '最终确认', '正式发布',
]))
expect(stepTextCalls.every(([, x]) => Number(x) < 1152)).toBe(true)
expect(stepTextCalls.every(([, , y]) => Number(y) < 900)).toBe(true)
```

- [ ] **Step 2: Run Canvas tests and verify RED**

```powershell
npm test -- --run src/motion/canvas/stepFlowState.test.ts src/motion/canvas/stepFlowRenderer.test.ts
```

Expected: the state contains five items and the renderer omits steps six and seven.

- [ ] **Step 3: Extend state collection and draw a straight seven-row path**

Collect `step1` through `step7`, filter blanks, and slice at seven. In the renderer use fixed left-side coordinates:

```ts
const firstY = 330
const lastY = 820
const gap = (lastY - firstY) / Math.max(1, state.items.length - 1)
const x = 166
```

Draw one straight dashed connector from `(x, firstY)` to `(x, lastY)`. Draw 48px number boxes, labels to their right, and use `CANVAS_COLORS.accentBlue` for active/completed progress. Keep every label left of x=1152 and every row above y=900.

- [ ] **Step 4: Run Canvas and export-registry tests**

```powershell
npm test -- --run src/motion/canvas/stepFlowState.test.ts src/motion/canvas/stepFlowRenderer.test.ts src/export/canvas/rendererRegistry.test.ts src/export/canvas/registryCoverage.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit Canvas parity**

```powershell
git add src/motion/canvas/stepFlowState.ts src/motion/canvas/stepFlowState.test.ts src/motion/canvas/stepFlowRenderer.ts src/motion/canvas/stepFlowRenderer.test.ts
git commit -m "feat: export seven-step flow timeline"
```

### Task 4: Verify compatibility and final visual behavior

**Files:**
- Modify: `src/persistence/workspaceStorage.test.ts`
- Modify: `src/timeline/project.test.ts`

- [ ] **Step 1: Add backward-compatibility tests**

Create a version-1 step-flow card and workspace parameter set containing only `step1` through `step5`. Parse them with current defaults and assert that the original five fields are preserved while `step6` and `step7` are filled from defaults.

- [ ] **Step 2: Run compatibility tests**

```powershell
npm test -- --run src/persistence/workspaceStorage.test.ts src/timeline/project.test.ts
```

Expected: both files pass and no schema version change is required.

- [ ] **Step 3: Run the complete verification suite**

```powershell
npm test -- --run
npm run lint
npm run build
git diff --check
```

Expected: zero failed tests, zero lint errors, successful production build, and no whitespace errors.

- [ ] **Step 4: Verify in the browser**

Start the Vite app, select “步骤流程,” and confirm at 1920×1080 composition scale:

- exactly seven default rows are visible;
- the current row advances with deep-blue focus;
- the right side contains no motion content;
- the last row stays above the subtitle safe area;
- parameter controls expose steps six and seven and focus options 1–7.

- [ ] **Step 5: Request code review and address findings**

Review the complete diff from `07e721a` to `HEAD`, fix every Critical or Important issue, and rerun the affected focused tests.

- [ ] **Step 6: Commit compatibility coverage**

```powershell
git add src/persistence/workspaceStorage.test.ts src/timeline/project.test.ts
git commit -m "test: cover seven-step flow compatibility"
```
