# Comparison Card Safe Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unsafe horizontal comparison card with a vertically stacked two-track card that ends at 38.15% of the video width and renders identically in React preview and Canvas export.

**Architecture:** Keep the existing `compare-split` id and `CompareSplitParams` schema. Add one focused layout module for 1920×1080 geometry and CSS contract values, expand the existing shared state sampler to own all timing and count-up behavior, and make both React and Canvas consume those two shared contracts. Preserve old workspace data while relabeling controls from left/right to baseline/result and reinterpreting `split` as the vertical divider percentage.

**Tech Stack:** React 19, TypeScript, Motion, Canvas 2D, Vitest, Testing Library, CSS.

---

## File map

- Create `src/motion/canvas/compareSplitLayout.ts`: shared safe-zone geometry and vertical-track divider calculation.
- Create `src/motion/canvas/compareSplitLayout.test.ts`: layout, split clamping, and safe-line contract tests.
- Modify `src/motion/canvas/compareSplitState.ts`: deterministic loop, count-up, scan, single highlight, result, and exit sampling.
- Modify `src/motion/canvas/compareSplitState.test.ts`: timing and reduced-motion-independent state contract tests.
- Modify `src/motion/CompareSplit.tsx`: semantic vertical-track React markup consuming shared state.
- Modify `src/motion/CompareSplit.test.tsx`: vertical order, safe zones, emphasis, defaults, and absence of the horizontal arrow.
- Modify `src/styles.css`: fixed 6.35%/31.8% safe card, stacked tracks, blue accents, and overflow protection.
- Modify `src/layoutContract.test.ts`: CSS right-edge proof against the 39% presenter line.
- Modify `src/motion/canvas/compareSplitRenderer.ts`: Canvas rendering using shared layout and state.
- Modify `src/motion/canvas/compareSplitRenderer.test.ts`: coordinate, ordering, content, emphasis, and boundary-length assertions.
- Modify `src/motion/registry.ts`: baseline/result and upper/lower control labels without changing keys.
- Modify `src/components/Workbench.test.tsx`: parameter-panel wording and old-project compatibility check.

### Task 1: Lock the vertical layout and safe-line contract

**Files:**
- Create: `src/motion/canvas/compareSplitLayout.ts`
- Create: `src/motion/canvas/compareSplitLayout.test.ts`
- Modify: `src/layoutContract.test.ts`

- [ ] **Step 1: Write failing layout tests**

Add assertions that derive the CSS right edge from `left: 6.35%` and `width: 31.8%`, require it to remain below the `.presenter-safe-area` value of `39%`, and require Canvas coordinates to end at `x = 732`.

```ts
expect(compareLeft).toBe(6.35)
expect(compareWidth).toBe(31.8)
expect(compareLeft + compareWidth).toBe(38.15)
expect(compareLeft + compareWidth).toBeLessThan(safeLine)
expect(COMPARE_SPLIT_LAYOUT.panel.x + COMPARE_SPLIT_LAYOUT.panel.width).toBe(732)
expect(COMPARE_SPLIT_LAYOUT.panel.x + COMPARE_SPLIT_LAYOUT.panel.width).toBeLessThan(748.8)
expect(getCompareSplitTrackLayout(0).split).toBe(32)
expect(getCompareSplitTrackLayout(100).split).toBe(68)
expect(getCompareSplitTrackLayout(50).dividerY).toBeCloseTo(537, 0)
```

- [ ] **Step 2: Run the tests and confirm RED**

Run:

```powershell
npm test -- --run src/motion/canvas/compareSplitLayout.test.ts src/layoutContract.test.ts
```

Expected: FAIL because the layout module does not exist and current CSS ends at `58.85%`.

- [ ] **Step 3: Implement the shared geometry**

Create a pure module with stable 1920×1080 coordinates and clamped vertical split mapping.

```ts
export const COMPARE_SPLIT_LAYOUT = {
  safeLineX: 748.8,
  panel: { x: 122, y: 119, width: 610, height: 779 },
  content: { x: 152, width: 550 },
  headerDividerY: 246,
  tracks: { topY: 270, bottomY: 804 },
  conclusionDividerY: 829,
  conclusionTextY: 855,
} as const

export function getCompareSplitTrackLayout(value: number) {
  const split = Math.min(68, Math.max(32, Number.isFinite(value) ? value : 50))
  const { topY, bottomY } = COMPARE_SPLIT_LAYOUT.tracks
  const dividerY = topY + (bottomY - topY) * (split / 100)
  return { split, dividerY, upperY: topY, lowerY: dividerY, bottomY }
}
```

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run the Task 1 command again.

Expected: both files PASS.

- [ ] **Step 5: Commit the layout contract**

```powershell
git add src/motion/canvas/compareSplitLayout.ts src/motion/canvas/compareSplitLayout.test.ts src/layoutContract.test.ts
git commit -m "test: lock comparison card safe layout"
```

### Task 2: Replace horizontal timing with shared vertical-track state

**Files:**
- Modify: `src/motion/canvas/compareSplitState.ts`
- Modify: `src/motion/canvas/compareSplitState.test.ts`

- [ ] **Step 1: Write failing state tests**

Replace `primaryWidth` expectations with vertical split and animation-phase assertions. Cover stable values, scan progress, a single highlight pulse, conclusion entry, exit fade, finite-number fallbacks, and preserved emphasis.

```ts
const entering = getCompareSplitState(base, 0.25)
const scanning = getCompareSplitState(base, 0.9)
const stable = getCompareSplitState(base, 2.4)

expect(entering.headerOpacity).toBeGreaterThan(0)
expect(scanning.scanProgress).toBeGreaterThan(0)
expect(scanning.scanProgress).toBeLessThanOrEqual(1)
expect(stable.upperValue).toBe('42')
expect(stable.lowerValue).toBe('86')
expect(stable.lowerHighlight).toBe(0)
expect(stable.resultOpacity).toBe(1)
expect(stable.verticalSplit).toBe(50)
expect(stable.emphasis).toBe('right')
```

- [ ] **Step 2: Run the state test and confirm RED**

Run:

```powershell
npm test -- --run src/motion/canvas/compareSplitState.test.ts
```

Expected: FAIL because the state still exposes left/right panel reveals and horizontal width.

- [ ] **Step 3: Implement the deterministic sampler**

Use `sampleCycle`, `samplePencilEase`, `delayedProgress`, and `formatCountUp`. Return one object consumed by both renderers.

```ts
const duration = Math.min(3, Math.max(0.6, Number.isFinite(params.duration) ? params.duration : 1.5))
const cycle = duration + 1.8
const time = Math.round(sampleCycle(localTime, cycle, 0.55) * 1e6) / 1e6
const split = Math.min(68, Math.max(32, Number.isFinite(params.split) ? params.split : 50))
const exitStart = cycle - 0.48
const panelOpacity = time <= exitStart ? 1 : Math.max(0, (cycle - time) / 0.48)
const reveal = (start: number, span: number) => (
  samplePencilEase(delayedProgress(time, start, span)) * panelOpacity
)
const singlePulse = (start: number, span: number) => {
  const elapsed = time - start
  return elapsed > 0 && elapsed < span
    ? Math.sin((elapsed / span) * Math.PI)
    : 0
}

return {
  cycle,
  time,
  panelOpacity,
  verticalSplit: split,
  headerOpacity: reveal(0.08, 0.34),
  upperOpacity: reveal(0.28, 0.36),
  lowerOpacity: reveal(0.78, 0.42),
  scanProgress: reveal(0.58, 0.42),
  upperValue: formatCountUp(params.leftValue, duration, 0, time),
  lowerValue: formatCountUp(params.rightValue, duration, 0, Math.max(0, time - 0.5)),
  lowerHighlight: singlePulse(1.2, 0.72),
  resultOpacity: reveal(1.28, 0.38),
  emphasis: params.emphasis,
}
```

The pulse must return to zero after one half-sine cycle and must not repeat before exit.

- [ ] **Step 4: Run the state test and confirm GREEN**

Run the Task 2 command again.

Expected: PASS with no repeated highlight after the pulse window.

- [ ] **Step 5: Commit the state sampler**

```powershell
git add src/motion/canvas/compareSplitState.ts src/motion/canvas/compareSplitState.test.ts
git commit -m "feat: sample vertical comparison animation"
```

### Task 3: Build the React dual-track card

**Files:**
- Modify: `src/motion/CompareSplit.tsx`
- Modify: `src/motion/CompareSplit.test.tsx`
- Modify: `src/styles.css`
- Modify: `src/layoutContract.test.ts`

- [ ] **Step 1: Write failing React and CSS tests**

Require a single safe panel, ordered upper/lower tracks, vertical scan line, no pencil arrow, and the exact CSS contract.

```ts
expect(screen.getByTestId('compare-card')).toHaveAttribute('data-zone', 'left-primary')
expect(screen.getByTestId('compare-upper')).toHaveTextContent('BEFORE')
expect(screen.getByTestId('compare-lower')).toHaveTextContent('AFTER')
expect(screen.getByTestId('compare-upper').compareDocumentPosition(
  screen.getByTestId('compare-lower'),
)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
expect(screen.getByTestId('compare-scan')).toBeInTheDocument()
expect(screen.queryByTestId('compare-pencil-arrow')).not.toBeInTheDocument()
expect(css).toMatch(/\.compare-split__card\s*\{[^}]*left:\s*6\.35%[^}]*width:\s*31\.8%/s)
expect(css).toMatch(/\.compare-split__tracks\s*\{[^}]*grid-template-rows:/s)
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```powershell
npm test -- --run src/motion/CompareSplit.test.tsx src/layoutContract.test.ts
```

Expected: FAIL because current markup contains two side-by-side panels and a horizontal arrow.

- [ ] **Step 3: Replace the markup with semantic stacked tracks**

Render one section and two child articles. Use `getCompareSplitState(params, playbackTime)` as the sole source of animated values.

```tsx
const state = getCompareSplitState(params, playbackTime)
const suffix = params.suffix || '%'

<section
  className="compare-split__card"
  data-testid="compare-card"
  data-zone="left-primary"
  style={{ '--compare-split': `${state.verticalSplit}%` } as CSSProperties}
>
  <header className="compare-split__header" style={{ opacity: state.headerOpacity }}>
    <span>03 / 对比研究</span>
    <h2 className="motion-content-text">{params.title || '未命名对比'}</h2>
  </header>
  <div className="compare-split__tracks">
    <article
      className="compare-track compare-track--upper"
      data-testid="compare-upper"
      data-emphasized={state.emphasis === 'left'}
      style={{ opacity: state.upperOpacity }}
    >
      <span className="compare-track__index">基准 / 01</span>
      <span className="compare-track__label motion-content-text">{params.leftLabel || '优化前'}</span>
      <strong>{state.upperValue}<em>{suffix}</em></strong>
      <i className="compare-track__meter" aria-hidden="true" />
    </article>
    <i data-testid="compare-scan" className="compare-split__scan" aria-hidden="true" />
    <article
      className="compare-track compare-track--lower"
      data-testid="compare-lower"
      data-emphasized={state.emphasis === 'right'}
      style={{ opacity: state.lowerOpacity, '--highlight': state.lowerHighlight } as CSSProperties}
    >
      <span className="compare-track__index">结果 / 02</span>
      <span className="compare-track__label motion-content-text">{params.rightLabel || '优化后'}</span>
      <strong>{state.lowerValue}<em>{suffix}</em></strong>
      <i className="compare-track__meter" aria-hidden="true" />
    </article>
  </div>
  <footer className="compare-split__result" data-testid="compare-result" style={{ opacity: state.resultOpacity }}>
    <span>结论 / 已锁定</span>
    <strong className="motion-content-text">{params.conclusion || '暂无结论'}</strong>
  </footer>
</section>
```

For reduced motion, use the stable sample rather than running independent Motion transitions.

- [ ] **Step 4: Replace comparison CSS with the safe vertical layout**

Remove the later 52.5% override and horizontal-grid rules. Add a fixed safe panel and stacked tracks.

```css
.compare-split__card {
  position: absolute;
  left: 6.35%;
  top: 11%;
  bottom: calc(var(--subtitle-safe-bottom) + 3%);
  width: 31.8%;
  overflow: hidden;
  background: linear-gradient(104deg, rgba(5,6,6,.84), rgba(5,6,6,.32));
}

.compare-split__tracks {
  display: grid;
  grid-template-rows: minmax(0, var(--compare-split)) minmax(0, calc(100% - var(--compare-split)));
  min-height: 0;
}
```

Use neutral gray for the non-emphasized track, cold white plus `--motion-accent-blue` for the emphasized track, `overflow-wrap: anywhere`, and `min-width: 0` on all text containers.

- [ ] **Step 5: Run the focused tests and confirm GREEN**

Run the Task 3 command again.

Expected: PASS; no horizontal arrow or right-zone content remains.

- [ ] **Step 6: Commit the React redesign**

```powershell
git add src/motion/CompareSplit.tsx src/motion/CompareSplit.test.tsx src/styles.css src/layoutContract.test.ts
git commit -m "feat: redesign comparison card as vertical tracks"
```

### Task 4: Align Canvas export with the React card

**Files:**
- Modify: `src/motion/canvas/compareSplitRenderer.ts`
- Modify: `src/motion/canvas/compareSplitRenderer.test.ts`

- [ ] **Step 1: Write failing Canvas parity tests**

Capture text and geometry calls. Require ordered baseline/result labels, no endpoint at or beyond `748.8`, panel right edge `732`, divider position derived from `split`, and no old horizontal arrow coordinates.

```ts
expect(texts).toEqual(expect.arrayContaining(['BEFORE', 'AFTER', '2.05× IMPROVEMENT']))
expect(allDrawXs.every((x) => x < COMPARE_SPLIT_LAYOUT.safeLineX)).toBe(true)
expect(fillRects).toContainEqual(expect.arrayContaining([
  COMPARE_SPLIT_LAYOUT.panel.x,
  COMPARE_SPLIT_LAYOUT.panel.y,
  COMPARE_SPLIT_LAYOUT.panel.width,
]))
expect(labelY('BEFORE')).toBeLessThan(labelY('AFTER'))
expect(maxEndpoint).toBeLessThan(748.8)
```

Add maximum-length title, labels, suffix, and conclusion fixtures and assert `drawText` never receives a width extending beyond `x = 702`.

- [ ] **Step 2: Run the Canvas test and confirm RED**

Run:

```powershell
npm test -- --run src/motion/canvas/compareSplitRenderer.test.ts
```

Expected: FAIL because the current renderer uses two 470px horizontal boxes ending at `x = 1060`.

- [ ] **Step 3: Render the shared safe geometry**

Use `COMPARE_SPLIT_LAYOUT`, `getCompareSplitTrackLayout(params.split)`, and `getCompareSplitState(params, localTime)`. Draw one panel, two vertical tracks, a scan line, and the conclusion.

```ts
const layout = getCompareSplitTrackLayout(state.verticalSplit)
drawPanel(ctx, { ...COMPARE_SPLIT_LAYOUT.panel, fill: 'rgba(5,6,6,.78)', stroke: null, alpha: state.panelOpacity })
const drawTrack = ({
  y,
  bottom,
  label,
  value,
  emphasized,
  alpha,
}: {
  y: number
  bottom: number
  label: string
  value: string
  emphasized: boolean
  alpha: number
}) => {
  drawText(ctx, {
    text: label,
    x: COMPARE_SPLIT_LAYOUT.content.x,
    y: y + 38,
    font: `500 21px ${resources.contentFont}`,
    color: emphasized ? CANVAS_COLORS.accentBlue : '#8f969a',
    maxWidth: COMPARE_SPLIT_LAYOUT.content.width,
    alpha,
  })
  drawText(ctx, {
    text: value,
    x: COMPARE_SPLIT_LAYOUT.content.x,
    y: y + 78,
    font: `650 62px ${resources.displayFont}`,
    color: emphasized ? CANVAS_COLORS.paper : '#a3a8aa',
    maxWidth: 450,
    alpha,
  })
  drawPencilLine(ctx, {
    x1: COMPARE_SPLIT_LAYOUT.content.x,
    x2: COMPARE_SPLIT_LAYOUT.content.x + COMPARE_SPLIT_LAYOUT.content.width,
    y1: bottom - 18,
    y2: bottom - 18,
    color: emphasized ? CANVAS_COLORS.accentBlue : '#4a5054',
    width: emphasized ? 4 : 2,
    alpha,
  })
}
drawTrack({
  y: layout.upperY,
  bottom: layout.dividerY,
  label: params.leftLabel || '优化前',
  value: state.upperValue,
  emphasized: state.emphasis === 'left',
  alpha: state.upperOpacity,
})
drawTrack({
  y: layout.lowerY,
  bottom: layout.bottomY,
  label: params.rightLabel || '优化后',
  value: state.lowerValue,
  emphasized: state.emphasis === 'right',
  alpha: state.lowerOpacity,
})
drawPencilLine(ctx, { x1: 152, x2: 702, y1: layout.dividerY, y2: layout.dividerY, color: CANVAS_COLORS.accentBlue, alpha: state.scanProgress })
```

All text must use `maxWidth: 550` or less. Do not draw anything in the presenter region.

- [ ] **Step 4: Run Canvas tests and confirm GREEN**

Run the Task 4 command again.

Expected: PASS for defaults, both emphasis values, split bounds, and maximum-length strings.

- [ ] **Step 5: Commit Canvas parity**

```powershell
git add src/motion/canvas/compareSplitRenderer.ts src/motion/canvas/compareSplitRenderer.test.ts
git commit -m "feat: export safe vertical comparison card"
```

### Task 5: Update parameter wording and compatibility coverage

**Files:**
- Modify: `src/motion/registry.ts`
- Modify: `src/components/Workbench.test.tsx`

- [ ] **Step 1: Write failing parameter-panel tests**

Select the comparison card and require the new labels while preserving existing values and keys.

```ts
fireEvent.click(screen.getByRole('button', { name: '选择组件对比卡片' }))
expect(screen.getByRole('textbox', { name: '基准标签' })).toHaveValue('优化前')
expect(screen.getByRole('slider', { name: '基准数值' })).toHaveValue('42')
expect(screen.getByRole('textbox', { name: '结果标签' })).toHaveValue('优化后')
expect(screen.getByRole('slider', { name: '结果数值' })).toHaveValue('86')
expect(screen.getByRole('combobox', { name: '强调数据轨' })).toHaveValue('right')
expect(screen.getByRole('slider', { name: '纵向分割位置' })).toHaveValue('50')
```

Add a legacy workspace fixture with the original `left*`, `right*`, `emphasis`, and `split` fields, then assert the values are restored unchanged.

- [ ] **Step 2: Run the Workbench test and confirm RED**

Run:

```powershell
npm test -- --run src/components/Workbench.test.tsx
```

Expected: FAIL because controls still use left/right wording.

- [ ] **Step 3: Relabel controls without changing keys**

```ts
{ type: 'text', key: 'leftLabel', label: '基准标签', maxLength: 14 },
{ type: 'number', key: 'leftValue', label: '基准数值', min: 0, max: 100, step: 1 },
{ type: 'text', key: 'rightLabel', label: '结果标签', maxLength: 14 },
{ type: 'number', key: 'rightValue', label: '结果数值', min: 0, max: 100, step: 1 },
{ type: 'select', key: 'emphasis', label: '强调数据轨', options: [
  { label: '强调上排', value: 'left' },
  { label: '强调下排', value: 'right' },
] },
{ type: 'number', key: 'split', label: '纵向分割位置', min: 32, max: 68, step: 1, suffix: '%' },
```

- [ ] **Step 4: Run compatibility tests and confirm GREEN**

Run the Task 5 command plus persistence tests:

```powershell
npm test -- --run src/components/Workbench.test.tsx src/persistence/workspaceStorage.test.ts src/timeline/project.test.ts
```

Expected: PASS with the legacy comparison card and all original field values preserved.

- [ ] **Step 5: Commit parameter wording**

```powershell
git add src/motion/registry.ts src/components/Workbench.test.tsx
git commit -m "fix: relabel vertical comparison controls"
```

### Task 6: Full verification and browser acceptance

**Files:**
- Verify only; modify tests or implementation only if a failing requirement exposes a defect.

- [ ] **Step 1: Run all automated gates**

```powershell
npm test -- --run
npm run lint
npm run build
git diff --check
```

Expected: all tests PASS, lint and build exit `0`, and `git diff --check` prints nothing. The existing Vite chunk-size warning is non-blocking.

- [ ] **Step 2: Inspect the local browser preview**

Start Vite on an available non-excluded port and select “对比卡片”. Verify at the actual preview size:

- the card right edge is left of the `39%` presenter-safe line;
- the baseline track is above the result track;
- both emphasis choices work without moving content;
- split values `32`, `50`, and `68` keep both tracks inside the panel;
- maximum-length text does not overflow;
- replay shows one downward scan and one restrained highlight;
- reduced motion displays the stable final state;
- the right video region is empty;
- console warnings and errors are empty.

- [ ] **Step 3: Review the complete diff and repository state**

```powershell
git status --short
git log --oneline 4a85965..HEAD
git diff --stat 4a85965..HEAD
```

Expected: only comparison-card implementation, tests, registry wording, and this plan are present; branch is `master` and the working tree is clean after commits.

- [ ] **Step 4: Commit any final test-only acceptance adjustments**

If verification required a focused test correction, commit only those verified files:

```powershell
git add src
git commit -m "test: verify safe comparison card"
```

If no files changed, do not create an empty commit.
