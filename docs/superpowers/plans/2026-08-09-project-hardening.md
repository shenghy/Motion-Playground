# Motion Playground Project Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Workbench coupling, prove ROI safety for legal extreme inputs, and make Windows builds reproducible.

**Architecture:** Keep the current React state and export contracts, but extract pure model, export orchestration, and view boundaries. Generate ROI stress fixtures from the typed motion registry. Add documentation, exact direct dependency versions, and a Windows CI workflow.

**Tech Stack:** React 19, TypeScript, Vitest, Vite, Node.js, FFmpeg, GitHub Actions.

---

### Task 1: Establish Workbench architecture gates

**Files:**
- Create: `src/workbench/architecture.test.ts`
- Create: `src/workbench/workbenchModel.test.ts`
- Create: `src/workbench/workbenchModel.ts`
- Modify: `src/components/Workbench.tsx`

- [ ] Write tests that require exported snapshot/fingerprint helpers and enforce a 950-line Workbench ceiling.
- [ ] Run `npx vitest run src/workbench/architecture.test.ts src/workbench/workbenchModel.test.ts` and verify failure because the new model module and size boundary do not exist.
- [ ] Move constants and pure workspace helpers to `workbenchModel.ts`, update imports, and make the helper tests pass.

### Task 2: Extract export orchestration and view composition

**Files:**
- Create: `src/workbench/useWorkbenchExport.ts`
- Create: `src/components/WorkbenchView.tsx`
- Modify: `src/components/Workbench.tsx`
- Test: `src/components/Workbench.export.test.tsx`
- Test: `src/components/Workbench.test.tsx`

- [ ] Move PNG/MOV capability, progress, cancellation, retry, snapshot, cleanup, and hidden export surface ownership into `useWorkbenchExport`.
- [ ] Move final component layout and prop wiring into `WorkbenchView`.
- [ ] Run focused Workbench tests and the architecture gate; preserve every existing behavior and meet the line ceiling.
- [ ] Commit the structural refactor.

### Task 3: Add legal extreme ROI fixtures

**Files:**
- Create: `src/export/benchmark/roiStressFixtures.test.ts`
- Create: `src/export/benchmark/roiStressFixtures.ts`
- Modify: `src/export/benchmark/WorkerExportBenchmark.tsx`
- Modify: `src/export/benchmark/WorkerExportBenchmark.test.tsx`

- [ ] Write failing tests for default/minimum/maximum control values and directional position coverage.
- [ ] Implement deterministic fixtures from `MotionDefinition.controls` without values outside the editor contract.
- [ ] Extend browser parity so predicted positioned bounds contain the real Alpha box for every stress sample.
- [ ] Run focused benchmark and Canvas-bound tests, then commit.

### Task 4: Make installation and CI reproducible

**Files:**
- Create: `README.md`
- Create: `.github/workflows/ci.yml`
- Create: `scripts/repository-contract.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] Write a failing repository-contract test requiring README sections, Windows CI commands, and zero `latest` dependencies.
- [ ] Pin every direct dependency to the exact version currently resolved in `package-lock.json`.
- [ ] Add Chinese setup/export/troubleshooting documentation and a Windows `npm ci` workflow.
- [ ] Run repository contract tests and `npm ci`, then commit.

### Task 5: Final verification and review

**Files:**
- Modify: `docs/verification/canvas-raw-export-results.md` only if verification evidence changes.

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run test:visual`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run the real ROI FFmpeg integration test and a short browser benchmark.
- [ ] Run `git diff --check master...HEAD`, self-review the full diff, fix findings, and repeat affected checks.
- [ ] Push `codex/project-hardening` to GitHub.
