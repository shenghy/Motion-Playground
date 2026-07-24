# Presenter Safe Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt all three motion previews to a real horizontal presenter shot using a visible, toggleable person-safe region and asymmetric left-primary/right-secondary overlays.

**Architecture:** `Workbench` owns one preview-only `showSafeArea` flag. `PreviewStage` renders the reference image behind keyed motion content and a non-exported safe-area guide above it. Each motion exposes stable `data-zone` markers and uses fixed percentage-based zones that cannot enter the presenter region.

**Tech Stack:** React, TypeScript, Motion for React, CSS container units, Vitest, React Testing Library.

---

### Task 1: Add the reference background and safe-area control

**Files:**
- Create: `public/reference-standing.png`
- Modify: `src/components/ParameterPanel.tsx`
- Modify: `src/components/PreviewStage.tsx`
- Modify: `src/components/Workbench.tsx`
- Modify: `src/components/Workbench.test.tsx`

- [ ] Write a failing test that expects the background image, a visible `presenter-safe-area`, and a checked “显示人物安全区” control.
- [ ] Run the focused test and confirm the new elements are missing.
- [ ] Add the image asset, state, toggle, background layer, and safe-area guide.
- [ ] Toggle the control in the test and verify the guide disappears while the background remains.
- [ ] Run the focused test and commit.

### Task 2: Move MetricFocus into left-primary/right-secondary zones

**Files:**
- Modify: `src/motion/MetricFocus.tsx`
- Modify: `src/motion/MetricFocus.test.tsx`
- Modify: `src/styles.css`

- [ ] Add failing assertions for `data-zone="left-primary"` and `data-zone="right-secondary"`.
- [ ] Restructure the metric markup into a left information card and right trend rail.
- [ ] Replace central full-frame CSS with `left: 4%–35%` and `right: 87%–97%` constraints.
- [ ] Run the focused test and commit.

### Task 3: Move CompareSplit into asymmetric presenter-safe zones

**Files:**
- Modify: `src/motion/CompareSplit.tsx`
- Modify: `src/motion/CompareSplit.test.tsx`
- Modify: `src/styles.css`

- [ ] Add failing zone assertions for the Before and After panels.
- [ ] Remove the center-crossing divider and full-width result bar.
- [ ] Render Before as a left main card, After as a right narrow card, and the conclusion within the left zone.
- [ ] Run the focused test and commit.

### Task 4: Move QuoteLockup into quote-left/author-right zones

**Files:**
- Modify: `src/motion/QuoteLockup.tsx`
- Modify: `src/motion/QuoteLockup.test.tsx`
- Modify: `src/styles.css`

- [ ] Add failing zone assertions for quote and author blocks.
- [ ] Keep the quote entirely in the left zone and move author metadata to the right rail.
- [ ] Keep guide lines and reveal masks outside the presenter region.
- [ ] Run the focused test and commit.

### Task 5: Verify on the real image

**Files:**
- Modify only files required by discovered defects.

- [ ] Run all tests, lint, and production build.
- [ ] Open the local Vite preview and inspect all three final animation states.
- [ ] Verify the safe-area toggle, background persistence, and absence of elements crossing the presenter region.
- [ ] Audit console errors and DOM overflow, then commit any final polish.
