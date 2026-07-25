# Chinese Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert every user-visible workbench and default motion string to clear Simplified Chinese while preserving internal English identifiers.

**Architecture:** Localize literals at their current ownership boundary: workbench chrome in components, component labels/defaults in the motion registry, and fallback/technical copy inside each motion renderer. No i18n framework is introduced because this phase has only one supported language.

**Tech Stack:** React, TypeScript, Vitest, React Testing Library, CSS.

---

### Task 1: Lock the Chinese workbench behavior

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/components/Workbench.test.tsx`

- [x] Expect the Chinese product title, status, component rail, parameter panel, six Chinese component names, and Chinese safety guides.
- [x] Assert the former primary English interface labels are absent.
- [x] Run focused tests and confirm RED.

### Task 2: Localize workbench chrome and registry defaults

**Files:**
- Modify: `src/components/Workbench.tsx`
- Modify: `src/components/ComponentRail.tsx`
- Modify: `src/components/PreviewStage.tsx`
- Modify: `src/components/ParameterPanel.tsx`
- Modify: `src/motion/registry.ts`

- [x] Translate all user-visible workbench strings.
- [x] Give all six registry entries Chinese display names and categories.
- [x] Translate every default motion value shown on first open.

### Task 3: Localize renderer fallbacks and verify

**Files:**
- Modify: `src/motion/MetricFocus.tsx`
- Modify: `src/motion/CompareSplit.tsx`
- Modify: `src/motion/ProfileReveal.tsx`
- Modify: `src/motion/BarCompare.tsx`
- Modify: `src/motion/ShareRing.tsx`
- Modify: `src/motion/StepFlow.tsx`

- [x] Translate fallback, status, coordinate, result, sequence, and empty-state strings.
- [x] Run all tests, lint, and production build.
- [x] Inspect all six components in the browser and confirm no operational English remains.
