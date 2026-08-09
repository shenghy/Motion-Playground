# Unified Motion Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make preview and export share one motion renderer, group Workbench state into explicit domains, and enforce renderer parity automatically.

**Architecture:** Canvas renderers become the production source of truth and are consumed by a new React canvas host. Workbench keeps cross-domain orchestration but delegates state ownership to four focused hooks. Registry and browser parity tests prove preview, export, and worker paths resolve the same renderer.

**Tech Stack:** React 19, TypeScript, Canvas 2D, Motion timing utilities, Vitest, Testing Library, Vite, Web Worker, FFmpeg.

---

### Task 1: Freeze architecture contracts

**Files:**
- Create: `src/motion/rendererContract.test.ts`
- Modify: `src/export/canvas/rendererRegistry.ts`

- [ ] Write a failing test requiring every motion ID to resolve to the renderer stored in the motion registry.
- [ ] Run the focused test and confirm it fails because the registries are independent.
- [ ] Derive Canvas renderer resolution from the motion registry.
- [ ] Run registry, Canvas, and worker tests.
- [ ] Commit the contract.

### Task 2: Group Workbench state by domain

**Files:**
- Create: `src/workbench/useProjectController.ts`
- Create: `src/workbench/useVideoController.ts`
- Create: `src/workbench/usePersistenceController.ts`
- Create: `src/workbench/useExportController.ts`
- Create: `src/workbench/controllers.test.tsx`
- Modify: `src/components/Workbench.tsx`

- [ ] Write failing hook tests for initialization, functional updates, and domain reset behavior.
- [ ] Implement the four hooks with typed state and stable setters.
- [ ] Replace Workbench's independent state declarations with the hooks without changing handlers.
- [ ] Run Workbench, persistence, timeline, and export tests.
- [ ] Commit the behavior-preserving extraction.

### Task 3: Add the shared Canvas preview host

**Files:**
- Create: `src/motion/MotionCanvasPreview.tsx`
- Create: `src/motion/MotionCanvasPreview.test.tsx`
- Modify: `src/components/PreviewStage.tsx`
- Modify: `src/components/PreviewStage.test.tsx`
- Modify: `src/styles.css`

- [ ] Write failing tests requiring sampled previews to call the registered renderer with exact local time and 1920x1080 resources.
- [ ] Implement deterministic sampled drawing, replay animation, font readiness, cleanup, and accessible error status.
- [ ] Replace idle and timeline React motion visuals with the Canvas host while preserving selection and movement shells.
- [ ] Run PreviewStage and Workbench tests.
- [ ] Commit the shared preview path.

### Task 4: Make the motion registry worker-safe

**Files:**
- Modify: `src/motion/types.ts`
- Modify: `src/motion/registry.ts`
- Modify: `src/export/canvas/rendererRegistry.ts`
- Modify: `src/motion/registry.test.ts`

- [ ] Write a failing contract test proving motion definitions contain metadata, controls, defaults, and one Canvas renderer without React component fields.
- [ ] Remove React component imports and fields from the registry and types.
- [ ] Ensure browser and worker bundles resolve the same function without importing legacy visual components.
- [ ] Run registry coverage, worker, and build checks.
- [ ] Commit registry consolidation.

### Task 5: Retire legacy visual components

**Files:**
- Delete: `src/motion/{Narrative,MetricFocus,CompareSplit,ProfileReveal,BarCompare,ShareRing,StepFlow,AudiencePoll}.tsx`
- Delete: corresponding component-only tests
- Modify: `src/motion/dataMath.ts`
- Modify: `src/motion/canvas/metricFocusState.ts`

- [ ] Move non-React number formatting into `dataMath.ts` under a failing unit test.
- [ ] Update the metric state model to use the pure formatter.
- [ ] Delete unused React visual components after dependency searches prove no production imports remain.
- [ ] Run the full suite and build to catch stale imports.
- [ ] Commit legacy removal.

### Task 6: Close the visual regression chain

**Files:**
- Modify: `src/export/canvas/visualFixtures.test.ts`
- Modify: `src/export/benchmark/WorkerExportBenchmark.tsx`
- Modify: `package.json`
- Modify: `docs/verification/canvas-raw-export-results.md`

- [ ] Add a failing test requiring four ordered fixture phases for every registry entry and identical preview/export renderer identity.
- [ ] Add a `test:visual` command covering registry, preview host, fixtures, Canvas, and worker parity tests.
- [ ] Run the short browser benchmark and record parity thresholds.
- [ ] Run a real MOV export probe for `ap4h`, `yuva444p12le`, 1920x1080, 30 fps, and transparent/opaque alpha samples.
- [ ] Update verification evidence and commit it.

### Task 7: Final verification and publication

**Files:**
- Modify only files required by issues found during verification.

- [ ] Run `npm test -- --run` and require zero failures.
- [ ] Run `npm run lint` and require exit code 0.
- [ ] Run `npm run build` and require exit code 0.
- [ ] Run `git diff --check` and inspect the complete branch diff.
- [ ] Commit any verification fixes, push `codex/unified-motion-architecture`, and report the exact commit and remaining integration choice.
