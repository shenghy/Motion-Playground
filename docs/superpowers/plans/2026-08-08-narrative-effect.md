# Narrative Effect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-position “叙述” motion effect with two large left-aligned lines, a small explanation, sequential reveal animation, and matching React/Canvas export rendering.

**Architecture:** Add `NarrativeParams` and register a focused React component plus a deterministic canvas state/renderer pair. The state sampler owns timing so interactive preview and transparent export share the same layer sequence; the registry remains the source of truth for defaults, controls, ordering, and renderers.

**Tech Stack:** React, TypeScript, Motion, Canvas 2D, Vitest, Testing Library, Vite

---

## File map

- Create `src/motion/Narrative.tsx`: semantic left-only React render tree.
- Create `src/motion/Narrative.test.tsx`: rendered copy, fallback, and zone contract.
- Create `src/motion/canvas/narrativeState.ts`: deterministic cycle sampling.
- Create `src/motion/canvas/narrativeState.test.ts`: reveal order and exit behavior.
- Create `src/motion/canvas/narrativeRenderer.ts`: left-only Canvas 2D drawing.
- Create `src/motion/canvas/narrativeRenderer.test.ts`: text and coordinate contract.
- Modify `src/motion/types.ts`: ID and params type.
- Modify `src/motion/registry.ts`: first registry definition and renumbering.
- Modify `src/export/canvas/rendererRegistry.ts`: worker renderer registration.
- Modify `src/components/ComponentRail.tsx`: dynamic component count.
- Modify `src/components/Workbench.test.tsx`: first-item selection/add behavior.
- Modify `src/styles.css`: narrative stage and rail-preview styling.

### Task 1: Define and register the first-position motion

**Files:**
- Modify: `src/motion/types.ts`
- Modify: `src/motion/registry.ts`
- Modify: `src/components/Workbench.test.tsx`
- Create: `src/motion/Narrative.tsx`
- Create: `src/motion/canvas/narrativeRenderer.ts`

- [ ] **Step 1: Write the failing registry assertion**

Add a focused test in `src/components/Workbench.test.tsx`:

```tsx
it('places 叙述 first in the component library', () => {
  render(<Workbench />)
  const choices = screen.getAllByRole('button', { name: /^选择组件/ })
  expect(choices[0]).toHaveAccessibleName('选择组件叙述')
  expect(motionRegistry[0]).toMatchObject({ id: 'narrative', index: '01', name: '叙述' })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run src/components/Workbench.test.tsx -t "places 叙述 first"`

Expected: FAIL because no `narrative` definition exists.

- [ ] **Step 3: Add the ID, params, and minimal registry entry**

Add to `MOTION_IDS` before `metric-focus` and define:

```ts
export interface NarrativeParams extends ParameterValues {
  line1: string
  line2: string
  explanation: string
  duration: number
}
```

Register first with defaults:

```ts
{
  id: 'narrative',
  index: '01',
  name: '叙述',
  category: '文字 / 叙述',
  description: '双行大字内容概述',
  component: Narrative,
  canvasRenderer: renderNarrativeToCanvas,
  defaults: {
    line1: '把复杂的工作',
    line2: '交给自动化',
    explanation: '让系统处理重复步骤，人只负责判断与创造。',
    duration: 5.2,
  },
  controls: [
    { type: 'text', key: 'line1', label: '第一排大字', maxLength: 12 },
    { type: 'text', key: 'line2', label: '第二排大字', maxLength: 12 },
    { type: 'text', key: 'explanation', label: '小字解释', maxLength: 32 },
    { type: 'number', key: 'duration', label: '动画时长', min: 3.2, max: 8, step: 0.2, suffix: '秒' },
  ],
}
```

Create temporary exported component/renderer shells that render nothing, then renumber existing definitions `02`–`07` so TypeScript can compile while later tests drive behavior.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- --run src/components/Workbench.test.tsx -t "places 叙述 first"`

Expected: PASS.

### Task 2: Implement deterministic layer timing

**Files:**
- Create: `src/motion/canvas/narrativeState.test.ts`
- Create: `src/motion/canvas/narrativeState.ts`

- [ ] **Step 1: Write the failing state-order test**

```ts
const params: NarrativeParams = { line1: '第一排', line2: '第二排', explanation: '解释', duration: 5.2 }

it('reveals line1, line2, rule, then explanation', () => {
  const early = getNarrativeState(params, 0.5)
  const middle = getNarrativeState(params, 1.3)
  expect(early.line1.opacity).toBeGreaterThan(early.line2.opacity)
  expect(middle.line2.opacity).toBeGreaterThan(0)
  expect(middle.ruleProgress).toBeGreaterThan(0)
  expect(middle.explanation.opacity).toBeLessThanOrEqual(middle.line2.opacity)
})

it('fades all layers near the cycle end', () => {
  const held = getNarrativeState(params, 3)
  const exiting = getNarrativeState(params, 5.05)
  expect(exiting.line1.opacity).toBeLessThan(held.line1.opacity)
  expect(exiting.explanation.opacity).toBeLessThan(held.explanation.opacity)
})
```

- [ ] **Step 2: Run the state tests and verify RED**

Run: `npm test -- --run src/motion/canvas/narrativeState.test.ts`

Expected: FAIL because `getNarrativeState` does not exist.

- [ ] **Step 3: Implement the sampled state**

Clamp duration to `3.2–8`, sample a repeating cycle, and return:

```ts
{
  cycle,
  time,
  line1: { opacity, y, blur },
  line2: { opacity, y, blur },
  ruleProgress,
  explanation: { opacity, y },
}
```

Use starts `0.18`, `0.46`, `0.82`, `1.04`, a short eased entrance for each layer, a common exit beginning `cycle - 0.55`, and `samplePencilEase` for deterministic export-safe easing.

- [ ] **Step 4: Run the state tests and verify GREEN**

Run: `npm test -- --run src/motion/canvas/narrativeState.test.ts`

Expected: 2 tests PASS.

### Task 3: Build the React narrative component

**Files:**
- Create: `src/motion/Narrative.test.tsx`
- Modify: `src/motion/Narrative.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing component contract tests**

```tsx
it('renders two headline rows and one explanation in the left primary zone', () => {
  render(<Narrative params={params} />)
  const primary = screen.getByTestId('narrative-primary')
  expect(primary).toHaveAttribute('data-zone', 'left-primary')
  expect(within(primary).getByText('把复杂的工作')).toBeInTheDocument()
  expect(within(primary).getByText('交给自动化')).toBeInTheDocument()
  expect(within(primary).getByText('让系统处理重复步骤，人只负责判断与创造。')).toBeInTheDocument()
  expect(screen.queryByTestId('narrative-secondary')).not.toBeInTheDocument()
})

it('uses stable fallback copy for empty values', () => {
  render(<Narrative params={{ ...params, line1: '', line2: '', explanation: '' }} />)
  expect(screen.getByText('当前内容')).toBeInTheDocument()
  expect(screen.getByText('正在讲述')).toBeInTheDocument()
  expect(screen.getByText('补充当前视频内容的简短解释。')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the component tests and verify RED**

Run: `npm test -- --run src/motion/Narrative.test.tsx`

Expected: FAIL because the component shell does not render the contract.

- [ ] **Step 3: Implement semantic markup and styling**

Render one `section.narrative__content` with `data-zone="left-primary"`, a mono eyebrow, two separate `<h2>` lines, a decorative rule, and a `<p>` explanation. Bind the four layers to `getNarrativeState` when `playbackTime` is supplied; otherwise use Motion keyframes with the same starts. Under reduced motion, render final opacity and zero transforms.

Add CSS that anchors the group near `left: 6.8%`, `top: 17.5%`, limits it to `44%` width, uses large cold-white display text, muted explanation text, and creates no right-side element.

- [ ] **Step 4: Run the component tests and verify GREEN**

Run: `npm test -- --run src/motion/Narrative.test.tsx`

Expected: 2 tests PASS.

### Task 4: Add matching Canvas export rendering

**Files:**
- Create: `src/motion/canvas/narrativeRenderer.test.ts`
- Modify: `src/motion/canvas/narrativeRenderer.ts`
- Modify: `src/export/canvas/rendererRegistry.ts`

- [ ] **Step 1: Write a failing renderer test**

Use a recording 2D context and assert the renderer draws `NARRATIVE / 01`, both headline lines, and the explanation with every text `x` coordinate below `960`. Also assert `canvasRendererRegistry.narrative` resolves to the renderer.

- [ ] **Step 2: Run the renderer tests and verify RED**

Run: `npm test -- --run src/motion/canvas/narrativeRenderer.test.ts src/export/canvas/rendererRegistry.test.ts`

Expected: FAIL because the renderer does not yet draw and the worker registry lacks `narrative`.

- [ ] **Step 3: Implement left-only drawing and registry mapping**

Use `getNarrativeState`, `drawText`, and `drawPencilLine` with fixed 1920×1080 positions: eyebrow at `(132, 188)`, headlines at `(132, 250)` and `(132, 350)`, rule from `(132, 474)` toward `(262, 474)`, and explanation at `(132, 510)`. Do not issue any narrative draw call with `x >= 960`.

Register:

```ts
'narrative': renderNarrativeToCanvas as CanvasMotionRenderer<ParameterValues>,
```

- [ ] **Step 4: Run renderer and coverage tests and verify GREEN**

Run: `npm test -- --run src/motion/canvas/narrativeRenderer.test.ts src/export/canvas/rendererRegistry.test.ts src/export/canvas/registryCoverage.test.ts src/export/canvas/visualFixtures.test.ts`

Expected: all selected tests PASS.

### Task 5: Update component-library presentation

**Files:**
- Modify: `src/components/ComponentRail.tsx`
- Modify: `src/components/ComponentRail.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing rail tests**

Add a `narrative` item before current fixtures and assert the first button is “选择组件叙述”. Add a footer assertion that an `items` array of seven renders “7 个组件”.

- [ ] **Step 2: Run rail tests and verify RED**

Run: `npm test -- --run src/components/ComponentRail.test.tsx`

Expected: footer assertion FAIL because it is hard-coded to 6.

- [ ] **Step 3: Implement dynamic count and narrative thumbnail**

Change the footer to `{items.length} 个组件`. Add `.rail-item__preview--narrative` rules that suggest two stacked headline bars and a shorter explanation bar, all on the left side of the thumbnail.

- [ ] **Step 4: Run rail tests and verify GREEN**

Run: `npm test -- --run src/components/ComponentRail.test.tsx`

Expected: all rail tests PASS.

### Task 6: Full verification and documentation checkpoint

**Files:**
- Modify: `docs/superpowers/plans/2026-08-08-narrative-effect.md`

- [ ] **Step 1: Run all automated tests**

Run: `npm test -- --run`

Expected: exit 0 with zero failures.

- [ ] **Step 2: Run static checks and production build**

Run: `npm run lint`

Expected: exit 0.

Run: `npm run build`

Expected: exit 0 and a fresh `dist` bundle.

- [ ] **Step 3: Check patch hygiene and requirement coverage**

Run: `git diff --check`

Expected: exit 0. Confirm the registry starts with `narrative`, the rail reports 7, the React tree has no secondary narrative node, and Canvas narrative coordinates stay left of `x=960`.

- [ ] **Step 4: Commit the implementation**

```bash
git add src docs/superpowers/plans/2026-08-08-narrative-effect.md
git commit -m "feat: add narrative motion effect"
```
