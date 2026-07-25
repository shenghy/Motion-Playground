# ProfileReveal Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace QuoteLockup with a presenter-safe ProfileReveal component featuring hierarchical identity content and looping sentence-by-sentence reveals.

**Architecture:** Replace the third registry ID and parameter contract rather than adding a fourth entry. `ProfileReveal` remains a pure typed motion component with one left information zone and one right status zone; Workbench continues to own playback and parameters.

**Tech Stack:** React, TypeScript, Motion for React, CSS container units, Vitest, React Testing Library.

---

### Task 1: Define the replacement behavior with failing tests

**Files:**
- Create: `src/motion/ProfileReveal.test.tsx`
- Modify: `src/components/Workbench.test.tsx`

- [ ] Assert that the rail exposes ProfileReveal and no longer exposes QuoteLockup.
- [ ] Assert category, two title levels, three facts, three notes, and both safe-zone markers.
- [ ] Run focused tests and confirm missing component/entry failures.

### Task 2: Replace types, registry, and routing

**Files:**
- Modify: `src/motion/types.ts`
- Modify: `src/motion/registry.tsx`
- Modify: `src/components/PreviewStage.tsx`
- Modify: `src/components/Workbench.tsx`
- Modify: `src/components/ComponentRail.tsx`
- Delete: `src/motion/QuoteLockup.tsx`
- Delete: `src/motion/QuoteLockup.test.tsx`

- [ ] Replace `quote-lockup` with `profile-reveal` in the ID union and playback state.
- [ ] Add typed default content and text controls for ProfileReveal.
- [ ] Route preview rendering to the new component.
- [ ] Remove QuoteLockup source and test files.

### Task 3: Implement ProfileReveal

**Files:**
- Create: `src/motion/ProfileReveal.tsx`
- Modify: `src/styles.css`

- [ ] Render a translucent left profile card with green identity accent, two title levels, and three red-marked facts.
- [ ] Render a right status rail containing sequence index, status text, and progress ticks.
- [ ] Use normalized Motion keyframes so the identity, title, and facts appear in sequence, hold, then loop.
- [ ] Respect reduced motion by showing the final state without looping.
- [ ] Run focused and full tests.

### Task 4: Verify the replacement

**Files:**
- Modify only files required by discovered defects.

- [ ] Run all tests, lint, and production build.
- [ ] Verify only three rail entries exist and the third is ProfileReveal.
- [ ] Inspect the full animation on the presenter image.
- [ ] Confirm both ProfileReveal zones remain outside the person-safe area, text overflow is zero, and the browser console is clean.
