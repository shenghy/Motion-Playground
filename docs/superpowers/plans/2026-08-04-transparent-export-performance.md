# Transparent Export Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce transparent MOV/PNG export time by removing repeated font work and one redundant paint wait per frame, while exposing measured speed/ETA and preserving the existing output contract.

**Architecture:** Add an explicit capture-session lifecycle to `ExportSurface`, with one cached `fontEmbedCSS` value per immutable export snapshot and synchronous frame commits followed by one paint boundary. Keep the ordered PNG-over-HTTP-to-FFmpeg transport, but add a reusable timing accumulator so capture, transfer, encoding, and saving costs can be measured and shown without coupling UI code to exporter internals.

**Tech Stack:** React 19, TypeScript, html-to-image, Vitest/Testing Library, Node.js local HTTP service, FFmpeg `prores_ks`.

---

### Task 1: Export performance accumulator

**Files:**
- Create: `src/export/exportPerformance.ts`
- Test: `src/export/exportPerformance.test.ts`

- [ ] **Step 1: Write the failing tests**

Cover zero-frame and three-frame snapshots using an injected monotonic clock. Assert elapsed milliseconds, average frames per second, ETA, and named phase totals with this API:

```ts
const performance = createExportPerformance(() => now)
performance.addDuration('frameCapture', 120)
performance.completeFrame(1, 3)
expect(performance.snapshot()).toMatchObject({
  completedFrames: 1,
  framesPerSecond: 5,
  estimatedRemainingMs: 400,
})
```

- [ ] **Step 2: Verify RED**

Run `npm test -- --run src/export/exportPerformance.test.ts`; expect failure because `exportPerformance.ts` does not exist.

- [ ] **Step 3: Implement the accumulator**

Create `ExportPerformancePhase`, `ExportPerformanceSnapshot`, and `createExportPerformance(now?)`. Clamp invalid/negative durations to zero, return `null` for FPS/ETA before the first completed frame, and calculate ETA from elapsed wall-clock time.

- [ ] **Step 4: Verify GREEN**

Run `npm test -- --run src/export/exportPerformance.test.ts`; expect all tests in the file to pass.

### Task 2: Optimized capture-session lifecycle

**Files:**
- Modify: `src/export/ExportSurface.tsx`
- Modify: `src/export/ExportSurface.test.tsx`

- [ ] **Step 1: Write failing lifecycle tests**

Mock `html-to-image` and controllable `requestAnimationFrame`. Assert `getFontEmbedCSS` runs once per session, each `toBlob` receives the cached CSS, each `prepareFrame` uses one paint boundary, and `endCaptureSession()` forces fresh font CSS in the next session.

- [ ] **Step 2: Verify RED**

Run `npm test -- --run src/export/ExportSurface.test.tsx`; expect missing session methods and font options.

- [ ] **Step 3: Implement the lifecycle**

Extend `ExportSurfaceHandle` with `beginCaptureSession()` and `endCaptureSession()`. In begin, wait for `document.fonts.ready` once and call `getFontEmbedCSS(root)`. In `prepareFrame`, use `flushSync` to commit `frameTime`, set CSS animation times, and await one paint boundary. Pass cached `fontEmbedCSS` to `toBlob`, and clear the cache on session end and card-snapshot changes.

- [ ] **Step 4: Verify GREEN**

Run `npm test -- --run src/export/ExportSurface.test.tsx`; expect lifecycle and active-card ordering tests to pass.

### Task 3: Integrate sessions and measured progress

**Files:**
- Modify: `src/export/exportController.ts`
- Modify: `src/export/movExportClient.ts`
- Modify: `src/components/Workbench.tsx`
- Modify: `src/components/ExportPanel.tsx`
- Modify: `src/export/exportController.test.ts`
- Modify: `src/export/movExportClient.test.ts`
- Modify: `src/components/Workbench.export.test.tsx`
- Modify: `src/components/ExportPanel.test.tsx`

- [ ] **Step 1: Write failing integration tests**

Extend `ExportProgress` with an optional performance snapshot. Verify MOV transfer time is recorded around frame PUT requests; PNG/MOV operations start one capture session only when rendering frames; every completion, cancellation, and exception ends the session; and the panel conditionally renders `帧/秒` plus `预计剩余`.

- [ ] **Step 2: Verify RED**

Run the four targeted test files; expect failures for missing lifecycle calls, performance data, and UI text.

- [ ] **Step 3: Implement integration**

Create one performance accumulator per export operation in `Workbench`. Time `prepareFrame` and `capturePng` separately, let MOV client add `frameTransfer` and `encoding`, and let save add `saving`. Call session begin/end in `try/finally`. Preserve the pending encoded MOV retry path: saving an existing job must not initialize a session or rerender frames.

- [ ] **Step 4: Verify GREEN**

Run `npm test -- --run src/export/exportController.test.ts src/export/movExportClient.test.ts src/components/Workbench.export.test.tsx src/components/ExportPanel.test.tsx`; expect all targeted tests to pass.

### Task 4: Server encoding timing

**Files:**
- Modify: `scripts/export-manager.mjs`
- Modify: `scripts/export-api.mjs`
- Modify: `scripts/export-manager.test.mjs`
- Modify: `scripts/export-api.test.mjs`

- [ ] **Step 1: Write failing response tests**

Inject a monotonic `now` function into `createExportManager`, advance it around `finishJob`, and assert the result and `/finish` response include `encodingMs` while retaining `id` and `size`.

- [ ] **Step 2: Verify RED**

Run `npm test -- --run scripts/export-manager.test.mjs scripts/export-api.test.mjs`; expect `encodingMs` assertions to fail.

- [ ] **Step 3: Implement timing**

Record time immediately before ending FFmpeg stdin and after the child closes successfully. Return a non-negative duration from `finishJob` and pass it through `export-api.mjs` and `movExportClient.ts`.

- [ ] **Step 4: Verify GREEN**

Run the two server test files and `src/export/movExportClient.test.ts`; expect all to pass.

### Task 5: Full verification and real codec benchmark

**Files:**
- Create: `scripts/export-encoder-benchmark.mjs`
- Verify: `scripts/export-manager.integration.test.mjs`

- [ ] **Step 1: Add a repeatable encoder benchmark**

Create a script that generates one transparent 1920×1080 PNG in an OS temporary directory, feeds 300 frames through the real export manager, prints frames/second and output size, and removes temporary files in `finally`.

- [ ] **Step 2: Run complete verification**

Run `npm test -- --run`, `npm run lint`, `npm run build`, `git diff --check`, and `node scripts/export-encoder-benchmark.mjs`. Expect zero failures, no whitespace errors, and a real MOV summary.

- [ ] **Step 3: Verify the output contract**

Run `npm test -- --run scripts/export-manager.integration.test.mjs`; expect ProRes 4444, `yuva444p`, 1920×1080, and 30fps.

- [ ] **Step 4: Review the final diff**

Confirm no resolution/FPS/codec downgrade, no parallel mutation of `ExportSurface`, no source-video inclusion, and no unrelated worktree changes.
