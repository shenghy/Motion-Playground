# Ma Shan Zheng Font Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-host the commercial-use Ma Shan Zheng font and apply its strong handwritten character to semantic copy across all six motion components.

**Architecture:** Store the official font and OFL license under `public/fonts/ma-shan-zheng/`, expose one global handwriting font token through `@font-face`, and mark only semantic titles, conclusions, facts, and steps with a shared class. Numeric values, percentages, coordinates, and workbench controls remain in the existing display and mono fonts.

**Tech Stack:** React, TypeScript, CSS, Vitest, React Testing Library, Google Fonts static assets.

---

### Task 1: Add licensed local font assets

**Files:**
- Create: `public/fonts/ma-shan-zheng/MaShanZheng-Regular.ttf`
- Create: `public/fonts/ma-shan-zheng/OFL.txt`
- Modify: `src/styles.css`

- [x] Download both files from the official `google/fonts` repository.
- [x] Verify the font file is non-empty and the license contains `SIL OPEN FONT LICENSE Version 1.1`.
- [x] Add `@font-face` with `font-display: swap` and define `--handwriting: 'Ma Shan Zheng Local', 'KaiTi', 'STKaiti', var(--display)`.

### Task 2: Lock semantic font usage with tests

**Files:**
- Modify: `src/motion/MetricFocus.test.tsx`
- Modify: `src/motion/CompareSplit.test.tsx`
- Modify: `src/motion/ProfileReveal.test.tsx`
- Modify: `src/motion/BarCompare.test.tsx`
- Modify: `src/motion/ShareRing.test.tsx`
- Modify: `src/motion/StepFlow.test.tsx`

- [ ] Add one failing assertion per component for `[data-handwritten="true"]`.
- [ ] Run all six focused test files and confirm RED.

Use:

```tsx
expect(
  screen.getByTestId('metric-primary').querySelector('[data-handwritten="true"]'),
).toBeInTheDocument()
```

Use the corresponding primary test ID for each remaining component.

### Task 3: Apply the handwriting role to all six components

**Files:**
- Modify: `src/motion/MetricFocus.tsx`
- Modify: `src/motion/CompareSplit.tsx`
- Modify: `src/motion/ProfileReveal.tsx`
- Modify: `src/motion/BarCompare.tsx`
- Modify: `src/motion/ShareRing.tsx`
- Modify: `src/motion/StepFlow.tsx`
- Modify: `src/styles.css`

- [ ] Add `className="motion-handwriting"` and `data-handwritten="true"` to semantic text:
  - MetricFocus: metric title and description.
  - CompareSplit: comparison title, labels, and conclusion.
  - ProfileReveal: title and all three facts.
  - BarCompare: chart title and item labels.
  - ShareRing: chart title, center label, and legend labels.
  - StepFlow: flow title and step names.
- [ ] Style `.motion-handwriting` with `font-family: var(--handwriting)`, regular font weight, stronger size contrast, and compact Chinese letter spacing.
- [ ] Keep core numbers, percentages, indexes, coordinates, and workbench UI outside the handwriting class.
- [ ] Run the six focused tests and confirm GREEN.

### Task 4: Verify and deliver

**Files:**
- Modify: `docs/superpowers/plans/2026-07-25-ma-shan-zheng-font.md`

- [ ] Run `npm test -- --run`, `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Inspect all six motions in the browser and verify the local font is loaded, handwritten text is visibly stronger, and no content is clipped.
- [ ] Mark all plan items complete and commit the implementation.
