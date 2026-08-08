# Borderless Motion, Bottom Controls, and Open Font Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove exported motion-card outer frames, dock video controls to the bottom edge, hide the visible subtitle-safe guide, and replace all motion handwriting with Noto Sans SC across React and Canvas/Worker export.

**Architecture:** Keep editing affordances separate from renderable motion content. Use one Noto Sans SC asset in browser, main-thread Canvas, and Worker resources; make borderless rendering explicit through nullable panel strokes so internal lines remain intact.

**Tech Stack:** React, TypeScript, CSS, Canvas 2D, Motion, Fontsource, Vitest, Testing Library, Vite

---

## File map

- Modify `package.json`, `package-lock.json`, `src/main.tsx`: install and import Noto Sans SC.
- Modify `src/export/canvas/types.ts`, `CanvasExportSurface.ts`: rename `handwritingFont` to `contentFont` and use open-source fallbacks.
- Modify `src/export/worker/fontAssets.ts`, `fonts.ts`, `fonts.test.ts`: load Noto in workers.
- Modify `src/motion/*.tsx` and tests: replace handwritten classes/markers.
- Modify `src/motion/canvas/*Renderer.ts` and tests: use `contentFont` and remove outer strokes.
- Modify `src/export/canvas/primitives.ts` and tests: allow fill-only panels with `stroke: null`.
- Modify `src/styles.css`: remove React motion outer frames, dock controls, hide subtitle guide.
- Modify `src/components/PreviewStage.test.tsx`, `Workbench.test.tsx`: verify safe-guide and editor-selection contracts.

### Task 1: Establish the open-source motion font resource

**Files:**
- Modify: `src/export/worker/fonts.test.ts`
- Modify: `src/export/worker/fonts.ts`
- Modify: `src/export/worker/fontAssets.ts`
- Modify: `src/export/canvas/types.ts`
- Modify: `src/export/canvas/CanvasExportSurface.ts`
- Modify: `src/main.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Change the worker font test to the desired contract**

Require a `Noto Sans SC Worker` face, exactly three loaded families, and resources shaped as:

```ts
{
  width: 1920,
  height: 1080,
  displayFont: 'Syne Worker, Noto Sans SC Worker, sans-serif',
  monoFont: 'IBM Plex Mono Worker, Noto Sans SC Worker, monospace',
  contentFont: 'Noto Sans SC Worker, sans-serif',
}
```

Assert the result contains none of `Ma Shan Zheng`, `KaiTi`, `STKaiti`, or `Microsoft YaHei`.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- --run src/export/worker/fonts.test.ts`

Expected: FAIL because the worker still loads Ma Shan Zheng and returns `handwritingFont`.

- [ ] **Step 3: Install and wire Noto Sans SC**

Run: `npm install @fontsource-variable/noto-sans-sc@5.3.0`

Import `@fontsource-variable/noto-sans-sc` in `src/main.tsx`. Import its variable WOFF2 URL in `fontAssets.ts`, register `Noto Sans SC Worker`, rename `CanvasRenderResources.handwritingFont` to `contentFont`, and update `DEFAULT_CANVAS_RESOURCES` to use Noto Sans SC without proprietary/system CJK fallbacks.

- [ ] **Step 4: Run font tests and TypeScript build**

Run: `npm test -- --run src/export/worker/fonts.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: TypeScript may list remaining `handwritingFont` consumers; use that exhaustive list for Task 2, without adding compatibility aliases.

### Task 2: Remove handwritten semantics from React and Canvas motions

**Files:**
- Modify: `src/motion/MetricFocus.tsx`, `CompareSplit.tsx`, `ProfileReveal.tsx`, `BarCompare.tsx`, `ShareRing.tsx`, `StepFlow.tsx`
- Modify: corresponding `src/motion/*.test.tsx`
- Modify: all `src/motion/canvas/*Renderer.ts`
- Modify: Canvas renderer tests and fixtures that construct `CanvasRenderResources`
- Modify: `src/styles.css`

- [ ] **Step 1: Rewrite one shared assertion in each motion test**

For every motion, assert the primary node contains `.motion-content-text` and contains no `[data-handwritten="true"]` or `.motion-handwriting`.

- [ ] **Step 2: Run the six motion tests and verify RED**

Run: `npm test -- --run src/motion/MetricFocus.test.tsx src/motion/CompareSplit.test.tsx src/motion/ProfileReveal.test.tsx src/motion/BarCompare.test.tsx src/motion/ShareRing.test.tsx src/motion/StepFlow.test.tsx`

Expected: FAIL on old handwritten classes/markers.

- [ ] **Step 3: Replace React and Canvas font consumers**

Rename `motion-handwriting` to `motion-content-text`, remove `data-handwritten`, and set the class to `var(--motion-content)` with normal sans-serif weight/spacing. Replace every renderer use of `resources.handwritingFont` with `resources.contentFont`; update test resources accordingly.

- [ ] **Step 4: Verify the focused motion and Canvas tests**

Run the six motion tests plus all `src/motion/canvas/*Renderer.test.ts` files.

Expected: PASS with no `handwritingFont` references found by `rg` in `src`.

### Task 3: Support fill-only panels and remove Canvas outer strokes

**Files:**
- Modify: `src/export/canvas/primitives.test.ts`
- Modify: `src/export/canvas/primitives.ts`
- Modify: `src/motion/canvas/metricFocusRenderer.test.ts`
- Modify: all outer-panel Canvas renderers

- [ ] **Step 1: Write the failing fill-only primitive test**

```ts
it('skips strokeRect when a panel explicitly has no stroke', () => {
  const ctx = createContext()
  drawPanel(ctx, { x: 1, y: 2, width: 3, height: 4, stroke: null })
  expect(ctx.fillRect).toHaveBeenCalledWith(1, 2, 3, 4)
  expect(ctx.strokeRect).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the primitive test and verify RED**

Run: `npm test -- --run src/export/canvas/primitives.test.ts -t "skips strokeRect"`

Expected: FAIL because `drawPanel` always strokes.

- [ ] **Step 3: Add nullable strokes and mark outer panels fill-only**

Allow `PanelOptions.stroke` to be `string | null`; when null, do not call `strokeRect`. Pass `stroke: null` for each main card/frame and right result/status outer panel. Keep bar, comparison, ring, process, tick, meter, and divider strokes.

- [ ] **Step 4: Verify Canvas rendering**

Run: `npm test -- --run src/export/canvas/primitives.test.ts src/motion/canvas src/export/canvas/registryCoverage.test.ts src/export/canvas/visualFixtures.test.ts`

Expected: PASS; transparent export registry remains complete.

### Task 4: Remove React motion outer frames

**Files:**
- Modify: `src/styles.css`
- Modify: `src/motion/*.test.tsx`

- [ ] **Step 1: Add explicit borderless layout assertions**

Keep the existing `data-pencil-layout` contracts and add `data-outer-frame="none"` to each primary motion container. Tests assert this attribute for Narrative and the six existing motions.

- [ ] **Step 2: Run motion tests and verify RED**

Expected: FAIL because the attribute is missing.

- [ ] **Step 3: Apply borderless React styling**

Add `data-outer-frame="none"` and remove outer `border`, box-frame pseudo-elements, corner marks, and panel backgrounds that visually read as a card. Preserve internal lines, fills required for chart readability, and editing `.overlay-card--selected` styles.

- [ ] **Step 4: Run motion and workbench tests**

Run: `npm test -- --run src/motion src/components/Workbench.test.tsx`

Expected: PASS, including selected overlay interaction tests.

### Task 5: Dock playback controls and hide the visible subtitle guide

**Files:**
- Modify: `src/components/PreviewStage.test.tsx`
- Modify: `src/components/PreviewStage.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing preview UI contract assertions**

Assert playback controls carry `data-placement="video-bottom"`. Replace subtitle label expectations with an empty, `aria-hidden` guide carrying `data-visibility="hidden"`; keep the node so the safe-area contract remains inspectable.

- [ ] **Step 2: Run preview/workbench tests and verify RED**

Run: `npm test -- --run src/components/PreviewStage.test.tsx src/components/Workbench.test.tsx -t "safe|playback|bottom"`

Expected: FAIL on missing placement/visibility contracts and old label text.

- [ ] **Step 3: Implement the A layout**

Add the attributes, remove subtitle label markup, set controls to `bottom: 0`, remove the full border/background, and use a bottom-up translucent gradient. Make `.subtitle-safe-area` fully transparent with no border or generated label while keeping `--subtitle-safe-bottom` unchanged.

- [ ] **Step 4: Verify focused interaction tests**

Run the full `PreviewStage.test.tsx` and `Workbench.test.tsx` files.

Expected: playback, seek, mute, safe-area toggle, and overlay selection tests PASS.

### Task 6: Full verification, browser inspection, and commit

**Files:**
- Modify: `docs/superpowers/plans/2026-08-08-borderless-video-bottom-font.md`

- [ ] **Step 1: Run complete automation**

Run: `npm test -- --run`, `npm run lint`, `npm run build`, and `git diff --check`.

Expected: all exit 0.

- [ ] **Step 2: Inspect the live page**

Verify the controls touch the video bottom edge, subtitle safe-area label/band is invisible, an active motion has no outer frame, and selection affordances appear only while editing. Check the browser console for errors.

- [ ] **Step 3: Review scope and commit**

Confirm no timeline/sidebar/parameter-panel borders changed and no `handwritingFont` or `data-handwritten` references remain in `src`.

```bash
git add package.json package-lock.json src docs/superpowers/plans/2026-08-08-borderless-video-bottom-font.md
git commit -m "feat: refresh motion cards and video controls"
```
