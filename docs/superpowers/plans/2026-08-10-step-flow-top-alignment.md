# Step Flow Top Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep fewer than seven step-flow items top-aligned with the same vertical spacing used by the seven-step layout.

**Architecture:** Treat the existing seven-step coordinates as the canonical layout. The Canvas renderer uses the fixed interval between those seven slots regardless of the active item count, while the legacy CSS contract uses seven fixed grid slots and only renders the required leading rows.

**Tech Stack:** TypeScript, Canvas 2D, CSS Grid, Vitest

---

### Task 1: Add regression coverage

**Files:**
- Modify: `src/motion/canvas/stepFlowRenderer.test.ts`
- Modify: `src/layoutContract.test.ts`

- [ ] Add a five-step Canvas renderer test that records the label baselines and expects them at the first five positions of the seven-step sequence.
- [ ] Replace the CSS assertion for count-dependent fractional rows with an assertion for seven fixed equal rows aligned to the start.
- [ ] Run `npm test -- --run src/motion/canvas/stepFlowRenderer.test.ts src/layoutContract.test.ts` and confirm the new assertions fail for the current average-distribution implementation.

### Task 2: Implement the fixed seven-slot layout

**Files:**
- Modify: `src/motion/canvas/stepFlowRenderer.ts`
- Modify: `src/styles.css`

- [ ] Set the Canvas step gap to `(820 - 330) / 6` and end the baseline at `330 + (itemCount - 1) * gap`.
- [ ] Set `.step-flow__steps` to seven fixed grid rows with bottom space left unused.
- [ ] Run `npm test -- --run src/motion/canvas/stepFlowRenderer.test.ts src/layoutContract.test.ts` and confirm both regression tests pass.

### Task 3: Verify the repository

**Files:**
- Verify only

- [ ] Run `npm test -- --run` and confirm zero failures.
- [ ] Run `npm run lint` and confirm zero errors.
- [ ] Run `npm run build` and confirm a successful production build.
- [ ] Inspect `git diff --check` and `git diff` to ensure the change is limited to the approved layout behavior and its documentation/tests.
