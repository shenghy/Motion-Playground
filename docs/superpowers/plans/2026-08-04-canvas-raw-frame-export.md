# Canvas Raw-Frame Transparent Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-frame React DOM screenshots with deterministic Canvas2D rendering and a backpressured RGBA stream so a 11248-frame transparent MOV exports in at most seven minutes without changing its output contract.

**Architecture:** Keep the React editor and preview, but add a separate imperative Canvas export renderer registered beside each motion definition. Send one 1920×1080 RGBA frame at a time over a same-origin WebSocket, acknowledge only after FFmpeg accepts the frame, and retain the existing HTTP job/file lifecycle for creation, saving, retry, cancellation, and cleanup.

**Tech Stack:** React 19, TypeScript, Canvas2D, native browser WebSocket, Node.js, `ws`, FFmpeg `rawvideo`/ProRes 4444, Vitest.

---

## File map

- Create `src/export/canvas/types.ts`: Canvas renderer and resource contracts.
- Create `src/export/canvas/timing.ts`: cubic-bezier and repeated-cycle sampling shared by Canvas motion states.
- Create `src/export/canvas/primitives.ts`: isolated drawing helpers for text, grids, pencil strokes, panels, and clipping.
- Create `src/export/canvas/CanvasExportSurface.ts`: one persistent 1920×1080 Canvas session that selects, orders, and renders cards.
- Create `src/export/LegacyDomExportSurface.tsx`: temporary reference renderer retained only until visual comparison finishes.
- Create `src/export/canvas/*.test.ts`: deterministic timing, layer order, transparent clearing, and renderer coverage tests.
- Create `src/motion/canvas/*.ts`: one focused state/renderer module for each of the six motion IDs.
- Modify `src/motion/types.ts` and `src/motion/registry.ts`: register the Canvas renderer beside each React component.
- Create `scripts/raw-frame-protocol.mjs`: encode/decode the 4-byte frame header and validate exact RGBA payload size.
- Modify `scripts/export-manager.mjs`: select `rawvideo` input and append validated RGBA frames with FFmpeg backpressure.
- Create `scripts/export-websocket.mjs`: same-origin WebSocket upgrade, one-frame acknowledgement, completion, and disconnect cleanup.
- Modify `scripts/local-server.mjs`, `scripts/start-overlay-studio.mjs`, and `scripts/export-api.mjs`: attach the WebSocket endpoint and advertise raw RGBA capability.
- Create `src/export/rawMovClient.ts`: browser job/socket/frame loop and progress reporting.
- Modify `src/components/Workbench.tsx`: use Canvas frames for MOV and PNG exports while preserving save retry and cancellation.
- Create `scripts/fixtures/canvas-raw-export-benchmark.json`: deterministic 10-second mixed-card benchmark project.
- Create or modify adjacent tests for every changed module.

### Task 1: Lock the Canvas renderer contract and timing math

**Files:**
- Create: `src/export/canvas/types.ts`
- Create: `src/export/canvas/timing.ts`
- Create: `src/export/canvas/timing.test.ts`
- Modify: `src/motion/types.ts`
- Modify: `src/motion/registry.ts`
- Create: `src/export/canvas/registryCoverage.test.ts`

- [ ] **Step 1: Write failing timing and registry tests**

Add tests that assert clamped cubic-bezier endpoints, deterministic cycle sampling, and that every `MOTION_IDS` entry exposes `canvasRenderer`:

```ts
expect(samplePencilEase(0)).toBe(0)
expect(samplePencilEase(1)).toBe(1)
expect(samplePencilEase(0.5)).toBeCloseTo(0.961, 2)
expect(sampleCycle(7.2, 6, 0.7)).toBeCloseTo(0.5, 5)
expect(motionRegistry.map((item) => item.canvasRenderer != null)).toEqual(
  MOTION_IDS.map(() => true),
)
```

Use temporary throwing renderers in the test setup until the real registry entries are implemented; production registry entries must not use the throwing test helper.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm test -- --run src/export/canvas/timing.test.ts src/export/canvas/registryCoverage.test.ts`

Expected: FAIL because `timing.ts`, `CanvasMotionRenderer`, and `canvasRenderer` do not exist.

- [ ] **Step 3: Add the renderer contract and deterministic timing helpers**

Define this public contract in `types.ts`:

```ts
export interface CanvasRenderResources {
  width: 1920
  height: 1080
  displayFont: string
  monoFont: string
  handwritingFont: string
}

export interface CanvasMotionRenderInput<T> {
  ctx: CanvasRenderingContext2D
  params: T
  localTime: number
  resources: CanvasRenderResources
}

export type CanvasMotionRenderer<T> = (
  input: CanvasMotionRenderInput<T>,
) => void
```

Add `canvasRenderer: CanvasMotionRenderer<T>` to `MotionDefinition<T>`. Implement `[0.22, 1, 0.36, 1]` cubic-bezier sampling by solving the x curve with eight Newton iterations followed by bisection fallback; export `samplePencilEase(progress)` and `sampleCycle(time, duration, repeatDelay)`. `sampleCycle` returns elapsed seconds inside the active cycle and holds at `duration` during `repeatDelay`; after that it wraps to zero. Clamp non-finite and negative inputs to zero.

Register explicit renderer imports for all six IDs. During this task, each production renderer module exports a transparent no-op function with its final name; Tasks 3, 8, and 9 replace those bodies. This keeps the type contract compiling without a runtime throw.

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- --run src/export/canvas/timing.test.ts src/export/canvas/registryCoverage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the contract**

```powershell
git add src/export/canvas src/motion/types.ts src/motion/registry.ts src/motion/canvas
git commit -m "feat: define canvas motion renderer contract"
```

### Task 2: Build bounded Canvas drawing primitives

**Files:**
- Create: `src/export/canvas/primitives.ts`
- Create: `src/export/canvas/primitives.test.ts`

- [ ] **Step 1: Write failing primitive isolation tests**

Use a recording fake `CanvasRenderingContext2D` and assert that every public helper balances `save()`/`restore()`, sets its own font/fill/stroke state, and never changes `globalCompositeOperation` after returning. Cover `drawGrid`, `drawPanel`, `drawText`, `drawPencilLine`, `drawHatchFill`, and `withAlpha`.

```ts
drawPanel(ctx, { x: 80, y: 120, width: 596, height: 720, alpha: 0.72 })
expect(ctx.calls.filter((call) => call === 'save')).toHaveLength(1)
expect(ctx.calls.filter((call) => call === 'restore')).toHaveLength(1)
expect(ctx.globalAlpha).toBe(1)
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- --run src/export/canvas/primitives.test.ts`

Expected: FAIL because the primitive module does not exist.

- [ ] **Step 3: Implement the public primitives**

Use pixel coordinates derived from the export width (`1cqw = 19.2px`). Each helper must wrap all mutations in `ctx.save()` and `ctx.restore()`. Use these canonical colors from `src/styles.css`: paper `#f1eee5`, ink `#050606`, muted `#8c9196`, line `rgba(241,238,229,.42)`, signal `#b7ccc8`. `drawText` must set `textBaseline = 'top'`, accept an explicit max width, and use `measureText` to shrink only when the supplied text exceeds that width.

- [ ] **Step 4: Run primitive tests and lint**

Run: `npm test -- --run src/export/canvas/primitives.test.ts`

Run: `npm run lint`

Expected: both commands PASS.

- [ ] **Step 5: Commit drawing primitives**

```powershell
git add src/export/canvas/primitives.ts src/export/canvas/primitives.test.ts
git commit -m "feat: add isolated canvas drawing primitives"
```

### Task 3: Implement the Metric Focus Canvas prototype

**Files:**
- Create: `src/motion/canvas/metricFocusState.ts`
- Create: `src/motion/canvas/metricFocusState.test.ts`
- Modify: `src/motion/canvas/metricFocusRenderer.ts`
- Create: `src/motion/canvas/metricFocusRenderer.test.ts`
- Modify: `src/motion/MetricFocus.tsx`
- Modify: `src/motion/useCountUp.ts`

- [ ] **Step 1: Write failing state tests at exact frame times**

Assert formatted count-up values, delayed eyebrow/value/meta/secondary entrance progress, scan keyframes, and stable state after entrance:

```ts
expect(getMetricFocusState(params, 0).number).toBe('0.0')
expect(getMetricFocusState(params, 0.12).eyebrow.opacity).toBe(0)
expect(getMetricFocusState(params, 1.2).number).toBe('61.0')
expect(getMetricFocusState(params, 8).number).toBe('61.0')
expect(getMetricFocusState(params, 8).value.opacity).toBe(1)
```

The fixture uses `value: 61`, `decimals: 1`, `duration: 1.2`; expected count-up uses the same `easeOutQuart` function as React.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run src/motion/canvas/metricFocusState.test.ts src/motion/canvas/metricFocusRenderer.test.ts`

Expected: FAIL because the state calculator and real drawing calls are absent.

- [ ] **Step 3: Extract shared count-up math**

Export `formatCountUp(target, duration, decimals, playbackTime)` as a pure function and make `useCountUp` call it when `playbackTime` is provided. `metricFocusState` must call the same function. Preserve the existing live-preview RAF branch.

- [ ] **Step 4: Draw every Metric Focus visual layer**

Implement the renderer using the geometry in `src/styles.css` for `.metric-focus__*` and its pencil overrides: transparent grid, coordinates, scan line, 31%-wide left frame, four corners, eyebrow badge, prefix/number/suffix, handwritten description, underline, 17 ticks, and right secondary card. Apply card entrance state using `ctx.globalAlpha`, translation, scale, blur where Canvas supports `ctx.filter`, and clipping.

The renderer test must verify representative operations and exact text at local times `0`, `0.6`, `1.2`, and `6`, including a full `clearRect`-free renderer body so only the surface owns clearing.

- [ ] **Step 5: Run component and Canvas tests**

Run: `npm test -- --run src/motion/MetricFocus.test.tsx src/motion/canvas/metricFocusState.test.ts src/motion/canvas/metricFocusRenderer.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the first real renderer**

```powershell
git add src/motion/MetricFocus.tsx src/motion/useCountUp.ts src/motion/canvas
git commit -m "feat: render metric focus on canvas"
```

### Task 4: Create the persistent Canvas export session

**Files:**
- Create: `src/export/canvas/CanvasExportSurface.ts`
- Create: `src/export/canvas/CanvasExportSurface.test.ts`
- Create: `src/export/LegacyDomExportSurface.tsx`
- Modify: `src/export/ExportSurface.tsx`

- [ ] **Step 1: Write failing surface lifecycle tests**

Cover font readiness once per session, transparent clearing every frame, stable `zIndex` plus source-order sorting, percent translation (`x=10` becomes `192px`, `y=-5` becomes `-54px`), inactive-card exclusion, exact 8,294,400-byte RGBA output, PNG output, and disposal.

```ts
session.renderFrame(2)
expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1920, 1080)
expect(renderOrder).toEqual(['lower', 'same-z-first', 'same-z-second'])
expect(session.readRgba().byteLength).toBe(8_294_400)
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- --run src/export/canvas/CanvasExportSurface.test.ts`

Expected: FAIL because the Canvas session does not exist.

- [ ] **Step 3: Implement `createCanvasExportSession`**

The constructor accepts a canvas, immutable card snapshot, renderer resolver, and font readiness promise. Set width/height exactly once, request a `2d` context with `{ alpha: true, willReadFrequently: true }`, and expose:

```ts
interface CanvasExportSession {
  begin(): Promise<void>
  renderFrame(time: number): void
  readRgba(): Uint8ClampedArray
  capturePng(): Promise<Blob>
  end(): void
}
```

`renderFrame` uses `getCardPlaybackState`, stable sorting, `ctx.translate(card.position.x * 19.2, card.position.y * 10.8)`, and one renderer call per active card. `readRgba` returns the current `ImageData.data`; `capturePng` rejects if `canvas.toBlob` returns null.

- [ ] **Step 4: Replace the hidden DOM host with one hidden Canvas**

Keep the existing `ExportSurfaceHandle` methods used by PNG during the transition and add `renderRgba(time): Uint8ClampedArray`. Do not remove the old DOM implementation until the raw MOV prototype passes Task 7; place it in `LegacyDomExportSurface.tsx` so rollback remains a single import change.

- [ ] **Step 5: Run export-surface tests**

Run: `npm test -- --run src/export/ExportSurface.test.tsx src/export/canvas/CanvasExportSurface.test.ts`

Expected: PASS with the Canvas session mocked in jsdom.

- [ ] **Step 6: Commit the persistent surface**

```powershell
git add src/export src/motion/registry.ts
git commit -m "feat: add persistent canvas export surface"
```

### Task 5: Add FFmpeg rawvideo jobs with strict frame validation

**Files:**
- Create: `scripts/raw-frame-protocol.mjs`
- Create: `scripts/raw-frame-protocol.test.mjs`
- Modify: `scripts/export-manager.mjs`
- Modify: `scripts/export-manager.test.mjs`
- Modify: `scripts/export-manager.integration.test.mjs`

- [ ] **Step 1: Write failing raw protocol and manager tests**

Assert big-endian frame index encoding, exact frame length, sequential append, raw FFmpeg arguments, stdin `drain` handling, incomplete finish rejection, and unchanged PNG compatibility.

```js
expect(rawFrameBytes(1920, 1080)).toBe(8_294_400)
expect(decodeRawFrame(encodeRawFrame(7, pixels), 1920, 1080).frameIndex).toBe(7)
expect(rawFfmpegArguments(30, 'out.mov')).toContain('rawvideo')
expect(rawFfmpegArguments(30, 'out.mov')).toContain('rgba')
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run scripts/raw-frame-protocol.test.mjs scripts/export-manager.test.mjs`

Expected: FAIL because raw transport does not exist.

- [ ] **Step 3: Implement raw job selection and append**

Accept `transport: 'png' | 'raw-rgba'` in validated job options. For raw jobs use `-f rawvideo -pixel_format rgba -video_size 1920x1080 -framerate 30 -i pipe:0`; keep all existing ProRes output arguments. Add `appendRawFrame(id, frameIndex, buffer)` that rejects a wrong transport, wrong sequence, or any buffer not exactly 8,294,400 bytes, then waits for `drain` exactly like PNG append.

- [ ] **Step 4: Verify real Alpha encoding**

Create one raw test frame with transparent corners and an opaque center directly in the integration test, encode it, and run the bundled FFmpeg probe. Assert stderr contains `Video: prores (4444)` and `yuva444p`.

Run: `npm test -- --run scripts/export-manager.integration.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit raw FFmpeg support**

```powershell
git add scripts/raw-frame-protocol.mjs scripts/raw-frame-protocol.test.mjs scripts/export-manager.mjs scripts/export-manager.test.mjs scripts/export-manager.integration.test.mjs
git commit -m "feat: accept raw rgba frames for prores export"
```

### Task 6: Add the acknowledged WebSocket frame bridge

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/export-websocket.mjs`
- Create: `scripts/export-websocket.test.mjs`
- Modify: `scripts/export-api.mjs`
- Modify: `scripts/export-api.test.mjs`
- Modify: `scripts/local-server.mjs`
- Modify: `scripts/local-server.test.mjs`
- Modify: `scripts/start-overlay-studio.mjs`

- [ ] **Step 1: Install the explicit server dependency**

Run: `npm install ws@^8.18.0`

Expected: `ws` appears under `dependencies` and the lockfile changes.

- [ ] **Step 2: Write failing socket lifecycle tests**

Start a real loopback HTTP server on an ephemeral port and use the `ws` client to assert: wrong Origin gets 403, unknown/non-raw job closes with policy error, frame 0 receives `{type:'frame-accepted', frameIndex:0}`, frame 2 after frame 0 is rejected, `finish` returns `{type:'completed', size, encodingMs}`, and disconnect calls `cancelJob` once.

- [ ] **Step 3: Run and verify failure**

Run: `npm test -- --run scripts/export-websocket.test.mjs scripts/local-server.test.mjs`

Expected: FAIL because no upgrade handler is attached.

- [ ] **Step 4: Implement one-frame acknowledgement**

Attach `WebSocketServer({ noServer: true, maxPayload: 8_294_404 })` to the local HTTP server. Only accept `/__overlay_export__/jobs/:id/raw`, validate `Origin === local.url origin`, decode the 4-byte frame header, call `manager.appendRawFrame`, then send:

```json
{"type":"frame-accepted","frameIndex":0}
```

Accept one JSON control message, `{"type":"finish"}`, only after `totalFrames` frames. On socket close before completion, cancel the job and clean temporary output. Set capabilities response fields `rawRgba: true` and `transport: "websocket"`.

- [ ] **Step 5: Run socket, API, launcher, and cleanup tests**

Run: `npm test -- --run scripts/export-websocket.test.mjs scripts/export-api.test.mjs scripts/local-server.test.mjs scripts/start-overlay-studio.test.mjs`

Expected: PASS with no open-handle warning.

- [ ] **Step 6: Commit the bridge**

```powershell
git add package.json package-lock.json scripts
git commit -m "feat: stream raw export frames over websocket"
```

### Task 7: Connect the browser raw client and enforce the performance gate

**Files:**
- Create: `src/export/rawMovClient.ts`
- Create: `src/export/rawMovClient.test.ts`
- Modify: `src/export/exportPerformance.ts`
- Modify: `src/export/exportPerformance.test.ts`
- Modify: `src/components/Workbench.tsx`
- Modify: `src/components/Workbench.export.test.tsx`
- Create: `scripts/fixtures/canvas-raw-export-benchmark.json`

- [ ] **Step 1: Write failing raw client tests**

Use a fake WebSocket to prove the client sends no second frame before the first acknowledgement, reports only acknowledged frames, sends `finish` after the final acknowledgement, cancels the HTTP job on abort, and leaves a completed job available when final file saving fails.

```ts
expect(socket.sent).toHaveLength(1)
socket.receive({ type: 'frame-accepted', frameIndex: 0 })
expect(socket.sent).toHaveLength(2)
expect(progress.completedFrames).toBe(1)
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run src/export/rawMovClient.test.ts src/components/Workbench.export.test.tsx`

Expected: FAIL because Workbench still captures and uploads PNG frames.

- [ ] **Step 3: Implement the raw browser loop**

Create the HTTP job with `transport: 'raw-rgba'`, connect using `ws:` or `wss:` based on `location.protocol`, encode each frame as a new `ArrayBuffer(4 + rgba.byteLength)`, write the big-endian index with `DataView`, copy RGBA after byte 4, and wait for the exact matching acknowledgement before rendering the next frame. Reject stale, duplicate, or skipped acknowledgements.

Measure Canvas drawing plus `getImageData` as `frameCapture`; measure acknowledgement wait as `frameTransfer`. Preserve existing `saveTransparentMov` and pending-job fingerprint behavior.

- [ ] **Step 4: Switch only Metric Focus MOV exports to the prototype**

Add a preflight that rejects any snapshot containing a non-`metric-focus` card with `Canvas 快速导出原型尚未覆盖动效：<name>`. This restriction exists only through the Task 7 performance gate and is removed in Task 10.

- [ ] **Step 5: Run automated regression tests**

Run: `npm test -- --run src/export/rawMovClient.test.ts src/components/Workbench.export.test.tsx src/export/canvas`

Run: `npm run lint`

Run: `npm run build`

Expected: all commands PASS.

- [ ] **Step 6: Run the three-trial 300-frame gate on the real local app**

Start the built app with `npm run start:local -- --no-open`, import `scripts/fixtures/canvas-raw-export-benchmark.json`, and export its 10-second Metric Focus timeline three times. Record the UI-reported completed fps and total render/encode time in the plan execution notes.

Pass conditions:

- Median completed speed is at least 30fps.
- No run is below 27fps.
- The produced MOV probes as 1920×1080, 30fps, ProRes 4444, `yuva444p`.

If either speed condition fails, stop before Task 8. Report `frameCapture`, `frameTransfer`, and `encoding` timings and keep the legacy export path active; do not commit the Workbench switch.

- [ ] **Step 7: Commit the proven prototype**

```powershell
git add src/export src/components/Workbench.tsx src/components/Workbench.export.test.tsx scripts/fixtures
git commit -m "feat: export metric focus through raw canvas frames"
```

### Task 8: Port the three data-driven motion renderers

**Files:**
- Create: `src/motion/canvas/barCompareState.ts`
- Create: `src/motion/canvas/barCompareState.test.ts`
- Modify: `src/motion/canvas/barCompareRenderer.ts`
- Create: `src/motion/canvas/shareRingState.ts`
- Create: `src/motion/canvas/shareRingState.test.ts`
- Modify: `src/motion/canvas/shareRingRenderer.ts`
- Create: `src/motion/canvas/stepFlowState.ts`
- Create: `src/motion/canvas/stepFlowState.test.ts`
- Modify: `src/motion/canvas/stepFlowRenderer.ts`
- Modify: `src/motion/BarCompare.tsx`
- Modify: `src/motion/ShareRing.tsx`
- Modify: `src/motion/StepFlow.tsx`

- [ ] **Step 1: Write failing state tests for data normalization and cycle boundaries**

Use the existing `clampDataValue`, `normalizeShares`, and `resolveFocusIndex` helpers. Assert Bar Compare fallback items and heights; Share Ring percentages sum to 100 and preserve focus; Step Flow cycles in `focusStep` order and returns the same state after `cycle + repeatDelay`.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run src/motion/canvas/barCompareState.test.ts src/motion/canvas/shareRingState.test.ts src/motion/canvas/stepFlowState.test.ts`

Expected: FAIL because the pure Canvas states are absent.

- [ ] **Step 3: Implement Bar Compare renderer**

Draw the 31%-wide hatched chart card, double heading line, baseline, 2–4 normalized columns, focused double-stroke column, labels, values/suffixes, and right result panel. Sample header, baseline, each delayed bar/label, and result opacity from the existing Motion keyframe times.

- [ ] **Step 4: Implement Share Ring renderer**

Draw the card, heading, dashed track, four normalized arc segments with the existing `radius=42` proportions, focused echo arc, center percentage/label, four-row legend, and right result panel. Use Canvas `arc` with `lineCap='round'`; no SVG serialization is allowed.

- [ ] **Step 5: Implement Step Flow renderer**

Draw the card, heading, hand-drawn Bézier connector, 3–5 numbered steps, focused double border, sequence opacity/scale/color states, and right status panel. Reuse the pure ordering state for React playback data and Canvas output.

- [ ] **Step 6: Run all three component/state tests**

Run: `npm test -- --run src/motion/BarCompare.test.tsx src/motion/ShareRing.test.tsx src/motion/StepFlow.test.tsx src/motion/canvas`

Expected: PASS.

- [ ] **Step 7: Commit data renderers**

```powershell
git add src/motion src/export/canvas
git commit -m "feat: render data motions on canvas"
```

### Task 9: Port Compare Split and Profile Reveal

**Files:**
- Create: `src/motion/canvas/compareSplitState.ts`
- Create: `src/motion/canvas/compareSplitState.test.ts`
- Modify: `src/motion/canvas/compareSplitRenderer.ts`
- Create: `src/motion/canvas/profileRevealState.ts`
- Create: `src/motion/canvas/profileRevealState.test.ts`
- Modify: `src/motion/canvas/profileRevealRenderer.ts`
- Modify: `src/motion/CompareSplit.tsx`
- Modify: `src/motion/ProfileReveal.tsx`

- [ ] **Step 1: Write failing state tests**

Assert Compare Split clamps `split` to 32–68 and maps it to 27–34% primary width, counts both values deterministically, and applies emphasis. Assert Profile Reveal computes its cycle/repeat delay, staggered fact visibility, exit fade, and right rail entrance at exact local times.

- [ ] **Step 2: Verify failure**

Run: `npm test -- --run src/motion/canvas/compareSplitState.test.ts src/motion/canvas/profileRevealState.test.ts`

Expected: FAIL because the state calculators are absent.

- [ ] **Step 3: Implement Compare Split renderer**

Draw grid/texture, header, primary left panel, narrow right panel, emphasis label, values, suffixes, baselines, meter lines, pencil strike/arrow, and conclusion footer. Match `.compare-split__*` and pencil override geometry in `src/styles.css`.

- [ ] **Step 4: Implement Profile Reveal renderer**

Draw shade/texture, field-note card, green identity accent, title, three staggered fact rows with checkmarks, footer line, and right status rail with seven track marks. Match the existing cycle and `repeatDelay: 0.72` exactly.

- [ ] **Step 5: Run component and Canvas tests**

Run: `npm test -- --run src/motion/CompareSplit.test.tsx src/motion/ProfileReveal.test.tsx src/motion/canvas`

Expected: PASS.

- [ ] **Step 6: Commit the remaining renderers**

```powershell
git add src/motion
git commit -m "feat: render comparison and profile motions on canvas"
```

### Task 10: Complete the Canvas cutover for MOV and PNG

**Files:**
- Modify: `src/components/Workbench.tsx`
- Modify: `src/components/Workbench.export.test.tsx`
- Modify: `src/export/exportController.ts`
- Modify: `src/export/exportController.test.ts`
- Modify: `src/export/ExportSurface.tsx`
- Modify: `src/export/LegacyDomExportSurface.tsx`
- Modify: `src/export/movExportClient.ts`
- Modify: `src/export/movExportClient.test.ts`

- [ ] **Step 1: Write failing full-coverage and PNG-sharing tests**

Assert a snapshot containing all six `MotionId` values passes preflight, MOV calls `renderRgba`, PNG calls `capturePng` on the same Canvas session, cancellation ends the session once, and save retry does not reconnect or rerender.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run src/components/Workbench.export.test.tsx src/export/exportController.test.ts src/export/movExportClient.test.ts`

Expected: FAIL because prototype preflight permits only Metric Focus and legacy capture remains.

- [ ] **Step 3: Remove the prototype restriction and old capture implementation**

Validate renderer coverage for the immutable card snapshot before creating a job. Use the Canvas session for both export buttons. Remove `html-to-image` imports from the user-facing export path, but keep `LegacyDomExportSurface.tsx` unmounted and test-only until Task 11 captures all DOM reference frames. Retain the PNG HTTP server endpoint only for backward-compatible tests and older built clients; new production code must not call it for MOV.

- [ ] **Step 4: Verify lifecycle and retry behavior**

Run: `npm test -- --run src/components/Workbench.export.test.tsx src/export`

Expected: PASS, including cancellation during drawing, acknowledgement wait, encoding, and saving.

- [ ] **Step 5: Commit the complete cutover**

```powershell
git add src/components src/export
git commit -m "feat: use canvas rendering for all transparent exports"
```

### Task 11: Add visual baselines and mixed-card benchmark coverage

**Files:**
- Create: `src/export/canvas/visualFixtures.ts`
- Create: `src/export/canvas/visualFixtures.test.ts`
- Modify: `scripts/fixtures/canvas-raw-export-benchmark.json`
- Create: `scripts/fixtures/canvas-raw-export-11248.json`
- Create: `scripts/create-export-benchmark-assets.mjs`
- Create: `scripts/create-export-benchmark-assets.test.mjs`
- Create: `docs/verification/canvas-raw-export-results.md`

- [ ] **Step 1: Define deterministic visual fixtures**

Create four local-time samples per motion: entrance, expansion, stable, and cycle/exit. Each fixture specifies exact params, card position, `zIndex`, and expected non-transparent bounding box. Add black and checkerboard compositing helpers for human comparison.

- [ ] **Step 2: Add automated invariant tests**

Assert each sample renders non-empty Alpha, transparent corners remain zero, repeated rendering produces byte-identical RGBA, and bounding-box edges stay within 2px of fixture expectations. Assert formatted text/state separately so anti-aliasing differences do not hide missing content.

- [ ] **Step 3: Expand the 10-second benchmark fixture**

Include all six motions, a transparent gap, two overlapping cards with different `zIndex`, positive and negative positions, and at least one looping card. Keep duration exactly 10 seconds and total frames exactly 300.

Create a second project fixture with the same coverage distributed across 11248 frames. Implement the asset script with bundled FFmpeg so it produces two disposable 16×16 reference videos: 300 frames and 11248 frames at 30fps. Use `lavfi color`, `-frames:v`, and H.264 ultrafast encoding; tests assert the command contains the exact frame counts and never writes inside the repository unless the caller supplies an output directory.

- [ ] **Step 4: Capture and inspect visual comparisons**

For all 24 samples, save one DOM reference frame and one Canvas frame, then composite both over black and checkerboard. Record pass/fail in `docs/verification/canvas-raw-export-results.md`; a renderer passes only when key geometry is within 2px, text content is exact, and there is no visible missing layer or Alpha halo.

- [ ] **Step 5: Commit visual evidence and fixtures**

```powershell
git add src/export/canvas scripts/fixtures docs/verification
git commit -m "test: add canvas export visual baselines"
```

### Task 12: Run complete verification and measure the 11248-frame outcome

**Files:**
- Modify: `docs/verification/canvas-raw-export-results.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete: `src/export/LegacyDomExportSurface.tsx`

- [ ] **Step 1: Remove the temporary DOM reference renderer**

After all 24 comparisons are recorded, delete `LegacyDomExportSurface.tsx`, remove its tests/imports, and run `npm uninstall html-to-image`. Confirm `rg -n "html-to-image|LegacyDomExportSurface" src package.json` returns no matches.

- [ ] **Step 2: Run the complete automated suite**

Run: `npm test -- --run`

Run: `npm run lint`

Run: `npm run build`

Expected: every test file passes, lint exits 0, TypeScript and Vite production build exit 0.

- [ ] **Step 3: Re-run real FFmpeg integration verification**

Run: `npm test -- --run scripts/export-manager.integration.test.mjs scripts/export-websocket.test.mjs scripts/export-manager.test.mjs`

Expected: PASS with ProRes 4444 and Alpha assertions.

- [ ] **Step 4: Run the mixed 300-frame benchmark three times**

Import `scripts/fixtures/canvas-raw-export-benchmark.json` into the built local app and export MOV three times. Record each total time, acknowledged fps, `frameCapture`, `frameTransfer`, `encoding`, and `saving` duration. Median must be at least 30fps and no run may be below 27fps.

- [ ] **Step 5: Run one full 11248-frame export**

Generate the disposable 11248-frame reference video, import it together with `scripts/fixtures/canvas-raw-export-11248.json`, start at frame 0, and time until the MOV file handle closes successfully. Record exact elapsed time, average fps, output size, and phase breakdown. Hard pass is at most seven minutes; mark the four-minute stretch goal passed only when total elapsed time is at most four minutes.

- [ ] **Step 6: Probe and sample the full MOV**

Use bundled FFmpeg/ffprobe to verify 1920×1080, 30fps, ProRes 4444, `yuva444p`, no audio, and 11248 frames. Extract first, middle, and final frames; assert transparent corners have Alpha 0 and visible-card regions contain non-zero Alpha.

- [ ] **Step 7: Update evidence and commit final verification**

Write the machine, date, three short-run results, long-run result, probe output summary, and sampled Alpha results to `docs/verification/canvas-raw-export-results.md`.

```powershell
git add package.json package-lock.json src/export docs/verification/canvas-raw-export-results.md
git commit -m "docs: record raw canvas export verification"
```

- [ ] **Step 8: Confirm repository state**

Run: `git status --short`

Expected: no output.
