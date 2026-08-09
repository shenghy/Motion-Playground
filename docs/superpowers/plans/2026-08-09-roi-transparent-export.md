# ROI Transparent Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace full-frame Worker RLE work with a validated ROI raw-frame path while preserving exact full RGBA frames and the existing ProRes 4444 encoder contract.

**Architecture:** Canvas renderers declare conservative local bounds. The Worker captures and sends an ordered ROI packet when it is cheaper than full-frame RLE; the Node service reconstructs a full frame in a lifetime-safe buffer before writing unchanged rawvideo bytes to FFmpeg. Existing RLE remains the compatibility and large-frame fallback.

**Tech Stack:** React 19, TypeScript, Canvas2D/OffscreenCanvas, Web Workers, native WebSocket, Node.js `ws`, FFmpeg `prores_ks`, Vitest.

---

### Task 1: Versioned ROI binary protocol

**Files:**
- Modify: `scripts/raw-frame-protocol.mjs`
- Modify: `scripts/raw-frame-protocol.test.mjs`

- [ ] Write failing tests for an empty packet, a rectangular packet, exact row placement, and invalid coordinates/payload lengths.
- [ ] Run `npm test -- --run scripts/raw-frame-protocol.test.mjs` and verify the new imports fail.
- [ ] Add `encodeOrderedRoiFrame`, `decodeOrderedRoiFrame`, and `applyRoiFrame` with a fixed versioned header and overflow-safe validation.
- [ ] Run the focused test and verify it passes.
- [ ] Commit with `feat: add ordered ROI frame protocol`.

### Task 2: Renderer bounds and ROI Canvas capture

**Files:**
- Modify: `src/motion/types.ts`
- Modify: `src/motion/registry.ts`
- Modify: `src/export/canvas/CanvasExportSurface.ts`
- Modify: `src/export/canvas/CanvasExportSurface.test.ts`
- Create: `src/export/canvas/frameBounds.ts`
- Create: `src/export/canvas/frameBounds.test.ts`

- [ ] Write failing tests that require every motion to expose bounds, clamp/union active-card bounds, return an empty rectangle for transparent frames, and reconstruct an ROI capture byte-for-byte.
- [ ] Run the focused tests and confirm failures are caused by missing bounds APIs.
- [ ] Add the rectangle types, registry bounds, active-card union logic, and `readRgbaRegion` session method.
- [ ] Run focused tests and `npm run test:visual`.
- [ ] Commit with `feat: capture conservative Canvas regions`.

### Task 3: Worker ROI selection and transport

**Files:**
- Modify: `src/export/worker/messages.ts`
- Modify: `src/export/worker/messages.test.ts`
- Modify: `src/export/worker/rawMovExport.worker.ts`
- Modify: `src/export/worker/rawMovExportWorker.test.ts`
- Modify: `src/export/worker/workerMovClient.ts`
- Modify: `src/export/worker/workerMovClient.test.ts`

- [ ] Write failing tests for v4 capability negotiation, ROI packet sending, empty frames, large-area RLE fallback, progress payload metrics, and cancellation.
- [ ] Run the focused tests and verify the missing v4/ROI behavior fails.
- [ ] Implement adaptive ROI selection with a conservative threshold and retain v3 RLE fallback.
- [ ] Run focused Worker tests and verify existing fallback tests remain green.
- [ ] Commit with `feat: stream adaptive ROI frames from export worker`.

### Task 4: Server reconstruction and buffer lifetime

**Files:**
- Modify: `scripts/export-manager.mjs`
- Modify: `scripts/export-manager.test.mjs`
- Modify: `scripts/export-websocket.mjs`
- Modify: `scripts/export-websocket.test.mjs`
- Modify: `scripts/export-api.mjs`
- Modify: `scripts/export-api.test.mjs`

- [ ] Write failing tests for ROI capability, ordered ROI decoding, exact full-frame reconstruction, slot lifetime until write completion, malformed packet cancellation, and RLE fallback.
- [ ] Run focused script tests and verify the expected failures.
- [ ] Add `raw-rgba-roi-ordered`, reconstruct complete frames, and expose v4 capability while leaving FFmpeg arguments unchanged.
- [ ] Run focused script and integration tests.
- [ ] Commit with `feat: reconstruct ROI frames for ProRes encoding`.

### Task 5: Benchmark telemetry and quality gate

**Files:**
- Modify: `src/export/exportPerformance.ts`
- Modify: `src/export/benchmark/WorkerExportBenchmark.tsx`
- Modify: `src/export/benchmark/WorkerExportBenchmark.test.tsx`
- Modify: `docs/verification/canvas-raw-export-results.md`

- [ ] Write failing tests for ROI area/payload telemetry and benchmark result fields.
- [ ] Run focused tests and confirm the fields are absent.
- [ ] Add telemetry without changing UI behavior.
- [ ] Run the full suite, lint, build, visual tests, three short benchmarks, one 600-frame long benchmark, FFprobe, and Alpha samples.
- [ ] Record measured results and commit with `test: verify lossless ROI export acceleration`.

### Task 6: Final review

**Files:**
- Review all branch changes.

- [ ] Run `git diff --check master...HEAD`.
- [ ] Run `npm test -- --run`, `npm run test:visual`, `npm run lint`, and `npm run build` fresh.
- [ ] Self-review protocol validation, buffer ownership, cancellation, fallback, and exact-quality gates because subagent review is unavailable in the current execution policy.
- [ ] Push `codex/roi-transparent-export` after all gates pass.
