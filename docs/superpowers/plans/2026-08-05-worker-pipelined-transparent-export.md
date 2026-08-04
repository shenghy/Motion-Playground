# Worker Pipelined Transparent Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export the verified 11,248-frame transparent MOV in at most four minutes by overlapping Canvas capture with FFmpeg backpressure in an OffscreenCanvas Worker, without changing any output-quality property.

**Architecture:** Add an ordered headerless RGBA WebSocket transport and a three-frame bounded pipeline owned by a dedicated module Worker. Keep the current main-thread Canvas/raw transport as a compatibility fallback, preserve the HTTP job/save lifecycle, and share one Canvas-only motion registry between main-thread and Worker renderers.

**Tech Stack:** React 19, TypeScript, Vite module Workers, OffscreenCanvas, FontFace/WorkerGlobalScope fonts, native WebSocket, Node.js `ws`, FFmpeg ProRes 4444, Vitest, headless Chrome CDP.

---

## File map

- Create `src/export/canvas/rendererRegistry.ts`: Worker-safe mapping from all six `MotionId` values to Canvas renderers.
- Modify `src/export/canvas/CanvasExportSurface.ts`: accept HTMLCanvasElement or OffscreenCanvas without importing React/DOM motion components.
- Modify `src/export/ExportSurface.tsx`: resolve renderers through the shared Canvas-only registry.
- Modify `scripts/raw-frame-protocol.mjs`: validate a headerless exact-size ordered RGBA payload while retaining v1 helpers for fallback clients.
- Modify `scripts/export-manager.mjs`: accept `raw-rgba-ordered` jobs in addition to existing transports.
- Modify `scripts/export-websocket.mjs`: assign ordered-v2 frame indexes on the server and acknowledge only after FFmpeg drain.
- Modify `scripts/export-api.mjs`: advertise ordered-v2/Worker pipeline capabilities.
- Create `src/export/worker/messages.ts`: serializable Worker command/event contracts.
- Create `src/export/worker/framePipeline.ts`: three-frame bounded acknowledgement window.
- Create `src/export/worker/fonts.ts`: exact Worker font assets and FontFace loading.
- Create `src/export/worker/rawMovExport.worker.ts`: OffscreenCanvas renderer, ordered-v2 WebSocket, progress, cancellation, and completion.
- Create `src/export/worker/workerMovClient.ts`: main-thread Worker coordinator and feature detection.
- Modify `src/components/Workbench.tsx`: prefer Worker MOV export and fall back before job creation.
- Create `src/export/worker/*.test.ts`: registry, protocol, windowing, message, fallback, and lifecycle tests.
- Create `src/export/benchmark/WorkerExportBenchmark.tsx`: hidden built-app benchmark route for deterministic short/long verification.
- Create `scripts/run-worker-export-benchmark.mjs`: launch isolated headless Chrome, poll benchmark results, and close cleanly.
- Modify `src/main.tsx`: expose the benchmark route only through `?worker-export-benchmark=1`.
- Modify `docs/verification/canvas-raw-export-results.md`: record short trials, full result, probe, Alpha, and quality parity.

### Task 1: Add a Worker-safe Canvas renderer registry

**Files:**
- Create: `src/export/canvas/rendererRegistry.ts`
- Create: `src/export/canvas/rendererRegistry.test.ts`
- Modify: `src/export/ExportSurface.tsx`
- Modify: `src/export/canvas/registryCoverage.test.ts`

- [ ] **Step 1: Write failing registry parity tests**

```ts
import { describe, expect, it } from 'vitest'
import { MOTION_IDS } from '../../motion/types'
import { canvasRendererRegistry, resolveCanvasRenderer } from './rendererRegistry'

describe('worker-safe canvas renderer registry', () => {
  it('contains every motion exactly once', () => {
    expect(Object.keys(canvasRendererRegistry).sort()).toEqual([...MOTION_IDS].sort())
    for (const motionId of MOTION_IDS) {
      expect(resolveCanvasRenderer(motionId)).toBeTypeOf('function')
    }
  })
})
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npm test -- --run src/export/canvas/rendererRegistry.test.ts src/export/canvas/registryCoverage.test.ts`

Expected: FAIL because `rendererRegistry.ts` does not exist.

- [ ] **Step 3: Implement the Canvas-only registry**

```ts
import type { CanvasMotionRenderer } from './types'
import type { MotionId, ParameterValues } from '../../motion/types'
import { renderMetricFocusToCanvas } from '../../motion/canvas/metricFocusRenderer'
import { renderCompareSplitToCanvas } from '../../motion/canvas/compareSplitRenderer'
import { renderProfileRevealToCanvas } from '../../motion/canvas/profileRevealRenderer'
import { renderBarCompareToCanvas } from '../../motion/canvas/barCompareRenderer'
import { renderShareRingToCanvas } from '../../motion/canvas/shareRingRenderer'
import { renderStepFlowToCanvas } from '../../motion/canvas/stepFlowRenderer'

export const canvasRendererRegistry = {
  'metric-focus': renderMetricFocusToCanvas as CanvasMotionRenderer<ParameterValues>,
  'compare-split': renderCompareSplitToCanvas as CanvasMotionRenderer<ParameterValues>,
  'profile-reveal': renderProfileRevealToCanvas as CanvasMotionRenderer<ParameterValues>,
  'bar-compare': renderBarCompareToCanvas as CanvasMotionRenderer<ParameterValues>,
  'share-ring': renderShareRingToCanvas as CanvasMotionRenderer<ParameterValues>,
  'step-flow': renderStepFlowToCanvas as CanvasMotionRenderer<ParameterValues>,
} satisfies Record<MotionId, CanvasMotionRenderer<ParameterValues>>

export function resolveCanvasRenderer(motionId: MotionId) {
  return canvasRendererRegistry[motionId]
}
```

Change `ExportSurface.tsx` to pass `resolveCanvasRenderer` directly. Keep the UI registry unchanged so React preview metadata remains colocated with React components.

- [ ] **Step 4: Run registry and surface tests**

Run: `npm test -- --run src/export/canvas/rendererRegistry.test.ts src/export/canvas/registryCoverage.test.ts src/export/ExportSurface.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/export/canvas src/export/ExportSurface.tsx
git commit -m "refactor: isolate canvas renderer registry"
```

### Task 2: Add the ordered-v2 headerless RGBA protocol

**Files:**
- Modify: `scripts/raw-frame-protocol.mjs`
- Modify: `scripts/raw-frame-protocol.test.mjs`
- Modify: `scripts/export-manager.mjs`
- Modify: `scripts/export-manager.test.mjs`
- Modify: `scripts/export-websocket.mjs`
- Modify: `scripts/export-websocket.test.mjs`
- Modify: `scripts/export-api.mjs`
- Modify: `scripts/export-api.test.mjs`

- [ ] **Step 1: Write failing protocol and WebSocket tests**

Add assertions that an ordered payload contains no header and that the server supplies the sequence number:

```js
expect(decodeOrderedRawFrame(Buffer.alloc(8, 7), 1, 2)).toEqual(Buffer.alloc(8, 7))
expect(() => decodeOrderedRawFrame(Buffer.alloc(9), 1, 2)).toThrow('8')

socket.send(Buffer.alloc(8, 7))
await expect(nextJson(socket)).resolves.toEqual({
  type: 'frame-accepted',
  frameIndex: 0,
})
expect(manager.appendRawFrame).toHaveBeenCalledWith('job-1', 0, Buffer.alloc(8, 7))
```

Add a two-frame test that sends both payloads before releasing the first append. Assert manager calls remain ordered and acknowledgements are `[0, 1]`.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run scripts/raw-frame-protocol.test.mjs scripts/export-manager.test.mjs scripts/export-websocket.test.mjs scripts/export-api.test.mjs`

Expected: FAIL because `decodeOrderedRawFrame` and `raw-rgba-ordered` do not exist.

- [ ] **Step 3: Implement ordered payload validation**

Retain `encodeRawFrame`/`decodeRawFrame` for current fallback jobs and add:

```js
export function decodeOrderedRawFrame(message, width, height) {
  const buffer = Buffer.isBuffer(message)
    ? message
    : Buffer.from(message.buffer, message.byteOffset, message.byteLength)
  const expected = rawFrameBytes(width, height)
  if (buffer.length !== expected) {
    throw new Error(`RGBA 帧字节数必须为 ${expected}`)
  }
  return buffer
}
```

Allow `raw-rgba-ordered` in `validateTransport`. It uses the same FFmpeg rawvideo arguments as `raw-rgba`.

- [ ] **Step 4: Branch WebSocket decoding by job transport**

```js
const frameIndex = expectedFrame
const pixels = jobInfo.transport === 'raw-rgba-ordered'
  ? decodeOrderedRawFrame(data, jobInfo.width, jobInfo.height)
  : decodeRawFrame(data, jobInfo.width, jobInfo.height).pixels

if (jobInfo.transport === 'raw-rgba') {
  const decoded = decodeRawFrame(data, jobInfo.width, jobInfo.height)
  if (decoded.frameIndex !== expectedFrame) throw new Error('透明导出帧序号不连续')
}
await manager.appendRawFrame(jobId, frameIndex, pixels)
expectedFrame += 1
socket.send(JSON.stringify({ type: 'frame-accepted', frameIndex }))
```

Set WebSocket `maxPayload` to `8_294_404` so both v1 and v2 remain accepted. Advertise:

```json
{
  "rawRgba": true,
  "transport": "websocket",
  "orderedRawProtocol": "v2",
  "workerPipeline": true,
  "pipelineWindow": 3
}
```

- [ ] **Step 5: Run protocol, server, and integration tests**

Run: `npm test -- --run scripts/raw-frame-protocol.test.mjs scripts/export-manager.test.mjs scripts/export-manager.integration.test.mjs scripts/export-websocket.test.mjs scripts/export-api.test.mjs`

Expected: PASS for both existing v1 jobs and new ordered-v2 jobs.

- [ ] **Step 6: Commit**

```powershell
git add scripts/raw-frame-protocol.mjs scripts/raw-frame-protocol.test.mjs scripts/export-manager.mjs scripts/export-manager.test.mjs scripts/export-websocket.mjs scripts/export-websocket.test.mjs scripts/export-api.mjs scripts/export-api.test.mjs
git commit -m "feat: add ordered raw rgba transport"
```

### Task 3: Implement the three-frame bounded pipeline

**Files:**
- Create: `src/export/worker/framePipeline.ts`
- Create: `src/export/worker/framePipeline.test.ts`

- [ ] **Step 1: Write failing windowing tests**

Use deferred acknowledgements and assert exactly three frames render/send before any acknowledgement:

```ts
const sent: number[] = []
const acknowledgements = deferredQueue<number>()
const operation = runFramePipeline({
  totalFrames: 5,
  windowSize: 3,
  maxBufferedBytes: 32 * 1024 * 1024,
  bufferedAmount: () => 0,
  renderFrame: async (index) => new Uint8ClampedArray([index]),
  sendFrame: (index) => sent.push(index),
  nextAcknowledgement: () => acknowledgements.next(),
  onAcknowledged: vi.fn(),
  signal: new AbortController().signal,
})
await vi.waitFor(() => expect(sent).toEqual([0, 1, 2]))
acknowledgements.resolveNext(0)
await vi.waitFor(() => expect(sent).toEqual([0, 1, 2, 3]))
```

Also test: maximum in-flight never exceeds three, `bufferedAmount` pauses rendering, stale/skipped acknowledgements reject, abort stops new renders, and all frames are reported only after acknowledgement.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run src/export/worker/framePipeline.test.ts`

Expected: FAIL because the pipeline module does not exist.

- [ ] **Step 3: Implement the pipeline state machine**

Export this contract:

```ts
export interface FramePipelineOptions {
  totalFrames: number
  windowSize: number
  maxBufferedBytes: number
  bufferedAmount(): number
  waitForWritable(): Promise<void>
  renderFrame(frameIndex: number): Uint8ClampedArray | Promise<Uint8ClampedArray>
  sendFrame(frameIndex: number, pixels: Uint8ClampedArray): void
  nextAcknowledgement(): Promise<number>
  onAcknowledged(completedFrames: number): void
  signal: AbortSignal
}

export async function runFramePipeline(options: FramePipelineOptions) {
  let nextToRender = 0
  let nextToAcknowledge = 0
  const inFlight = new Map<number, Uint8ClampedArray>()

  while (nextToAcknowledge < options.totalFrames) {
    while (
      nextToRender < options.totalFrames
      && inFlight.size < options.windowSize
      && options.bufferedAmount() <= options.maxBufferedBytes
    ) {
      if (options.signal.aborted) throw new DOMException('导出已取消', 'AbortError')
      const pixels = await options.renderFrame(nextToRender)
      inFlight.set(nextToRender, pixels)
      options.sendFrame(nextToRender, pixels)
      nextToRender += 1
    }

    if (inFlight.size === 0) {
      await options.waitForWritable()
      continue
    }
    const acknowledged = await options.nextAcknowledgement()
    if (acknowledged !== nextToAcknowledge || !inFlight.has(acknowledged)) {
      throw new Error('透明导出确认帧序号不连续')
    }
    inFlight.delete(acknowledged)
    nextToAcknowledge += 1
    options.onAcknowledged(nextToAcknowledge)
  }
}
```

Use an acknowledgement or short `bufferedamountlow`/timer wait to avoid spinning when the window is not full but `bufferedAmount` is above the limit.

- [ ] **Step 4: Run tests and lint**

Run: `npm test -- --run src/export/worker/framePipeline.test.ts`

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/export/worker/framePipeline.ts src/export/worker/framePipeline.test.ts
git commit -m "feat: add bounded export frame pipeline"
```

### Task 4: Make the Canvas session and fonts Worker-compatible

**Files:**
- Modify: `src/export/canvas/CanvasExportSurface.ts`
- Modify: `src/export/canvas/CanvasExportSurface.test.ts`
- Create: `src/export/worker/fonts.ts`
- Create: `src/export/worker/fonts.test.ts`
- Create: `src/export/worker/fontAssets.ts`

- [ ] **Step 1: Write failing OffscreenCanvas and font tests**

Add a fake OffscreenCanvas-shaped object and assert the session renders/reads RGBA without `toBlob`. Mock `FontFace` and a Worker font set, then assert all three families load before rendering:

```ts
expect(fontSet.add).toHaveBeenCalledTimes(3)
expect(FontFace).toHaveBeenCalledWith('Syne Worker', expect.stringContaining('url('), expect.any(Object))
expect(FontFace).toHaveBeenCalledWith('IBM Plex Mono Worker', expect.stringContaining('url('), expect.any(Object))
expect(FontFace).toHaveBeenCalledWith('Ma Shan Zheng Worker', expect.stringContaining('url('), expect.any(Object))
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run src/export/canvas/CanvasExportSurface.test.ts src/export/worker/fonts.test.ts`

Expected: FAIL because the Canvas option only accepts `HTMLCanvasElement` and Worker fonts do not exist.

- [ ] **Step 3: Generalize the frame session**

Define the minimum canvas contract instead of importing Worker globals into UI code:

```ts
export interface ExportCanvasSource {
  width: number
  height: number
  getContext(
    contextId: '2d',
    options: { alpha: true; willReadFrequently: true },
  ): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  toBlob?(callback: BlobCallback, type?: string): void
  convertToBlob?(options?: ImageEncodeOptions): Promise<Blob>
}
```

Cast the returned context once to the renderer's Canvas2D subset. `capturePng` uses `toBlob` on HTML canvas or `convertToBlob` on OffscreenCanvas. Keep exact width, height, clearing, sorting, translation, and `getImageData` behavior.

- [ ] **Step 4: Add exact font assets and loader**

```ts
import syneUrl from '@fontsource-variable/syne/files/syne-latin-wght-normal.woff2?url'
import mono400Url from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url'

export const workerFontAssets = {
  display: syneUrl,
  mono: mono400Url,
  handwriting: '/fonts/ma-shan-zheng/MaShanZheng-Regular.ttf',
}
```

`loadWorkerFonts(fontSet, FontFaceConstructor)` loads all three faces, adds them to the Worker font set, awaits `fontSet.ready`, and returns Canvas resource family strings with Microsoft YaHei/system fallbacks.

- [ ] **Step 5: Run Canvas/font tests and build**

Run: `npm test -- --run src/export/canvas/CanvasExportSurface.test.ts src/export/worker/fonts.test.ts`

Run: `npm run build`

Expected: PASS and Vite resolves all three font URLs.

- [ ] **Step 6: Commit**

```powershell
git add src/export/canvas/CanvasExportSurface.ts src/export/canvas/CanvasExportSurface.test.ts src/export/worker/fonts.ts src/export/worker/fonts.test.ts src/export/worker/fontAssets.ts
git commit -m "feat: support offscreen canvas export rendering"
```

### Task 5: Build the Worker export engine

**Files:**
- Create: `src/export/worker/messages.ts`
- Create: `src/export/worker/messages.test.ts`
- Create: `src/export/worker/rawMovExport.worker.ts`
- Create: `src/export/worker/rawMovExportWorker.test.ts`

- [ ] **Step 1: Define and test serializable message contracts**

```ts
export type WorkerExportCommand =
  | { type: 'prepare'; cards: OverlayCard[]; duration: number; windowSize: 3 }
  | { type: 'start'; jobId: string; socketUrl: string }
  | { type: 'cancel' }

export type WorkerExportEvent =
  | { type: 'ready' }
  | { type: 'progress'; completedFrames: number; totalFrames: number; phases: WorkerPhaseDurations }
  | { type: 'completed'; size: number; encodingMs: number; phases: WorkerPhaseDurations }
  | { type: 'cancelled'; completedFrames: number }
  | { type: 'error'; message: string }
```

Validate `prepare` requires window size exactly three, finite positive duration, exact total frame math, and cloneable cards. Validate `start` requires a non-empty job ID and same-origin `ws:`/`wss:` URL.

- [ ] **Step 2: Run and verify contract tests fail**

Run: `npm test -- --run src/export/worker/messages.test.ts`

Expected: FAIL because the message module does not exist.

- [ ] **Step 3: Implement Worker startup and rendering**

On `prepare`, the Worker must:

```ts
const canvas = new OffscreenCanvas(EXPORT_WIDTH, EXPORT_HEIGHT)
const resources = await loadWorkerFonts(self.fonts, FontFace)
const session = createCanvasExportSession({
  canvas,
  cards: command.cards,
  resolveRenderer: resolveCanvasRenderer,
  fontReady: async () => undefined,
  resources,
})
await session.begin()
```

After the session is ready, post `ready`. On the later `start` message, connect the ordered-v2 socket, queue JSON acknowledgements, and run `runFramePipeline`. `sendFrame` calls `socket.send(pixels.buffer)` directly; it must not allocate a second frame-sized ArrayBuffer. After all acknowledgements send `finish`, wait for `completed`, post the result, close the socket, and end the session.

Measure draw/getImageData, WebSocket enqueue, acknowledgement wait, and encoding flush separately. Post progress only from `onAcknowledged`.

- [ ] **Step 4: Implement cancellation and failure cleanup**

On `cancel`, abort the pipeline and close the socket. Reject malformed acknowledgements, socket failures, wrong payload lengths, and unexpected completion messages. Post only one terminal event. The server remains responsible for cancelling an opened job after premature socket close.

- [ ] **Step 5: Run Worker unit tests**

Run: `npm test -- --run src/export/worker/messages.test.ts src/export/worker/rawMovExportWorker.test.ts src/export/worker/framePipeline.test.ts`

Expected: PASS, including three frames in flight, exact frame times, direct RGBA buffer sends, and one terminal event.

- [ ] **Step 6: Commit**

```powershell
git add src/export/worker/messages.ts src/export/worker/messages.test.ts src/export/worker/rawMovExport.worker.ts src/export/worker/rawMovExportWorker.test.ts
git commit -m "feat: render mov frames in export worker"
```

### Task 6: Add the main-thread Worker coordinator and fallback

**Files:**
- Create: `src/export/worker/workerMovClient.ts`
- Create: `src/export/worker/workerMovClient.test.ts`
- Modify: `src/components/Workbench.tsx`
- Modify: `src/components/Workbench.export.test.tsx`

- [ ] **Step 1: Write failing feature-detection and lifecycle tests**

Cover:

```ts
expect(canUseWorkerMovExport({ Worker, OffscreenCanvas, FontFace })).toBe(true)
expect(canUseWorkerMovExport({ Worker: undefined, OffscreenCanvas, FontFace })).toBe(false)
```

Use a fake Worker to assert: ordered-v2 job is created once, `job-created` updates `serverExportJobRef`, progress maps to existing UI state, abort posts `cancel`, completion leaves the job for saving, Worker setup failure before job creation invokes main-thread fallback once, and save retry creates neither Worker nor WebSocket.

Extend the existing capabilities test so Worker export is selected only when the server reports both `orderedRawProtocol: 'v2'` and `workerPipeline: true`; an older server must use the existing v1 main-thread client.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run src/export/worker/workerMovClient.test.ts src/components/Workbench.export.test.tsx`

Expected: FAIL because the coordinator does not exist and Workbench calls the main-thread client directly.

- [ ] **Step 3: Implement feature detection and Worker factory**

```ts
export function canUseWorkerMovExport(scope: WorkerFeatureScope = window) {
  return typeof scope.Worker === 'function'
    && typeof scope.OffscreenCanvas === 'function'
    && typeof scope.FontFace === 'function'
}

const browserWorkerFactory = () => new Worker(
  new URL('./rawMovExport.worker.ts', import.meta.url),
  { type: 'module', name: 'transparent-mov-export' },
)
```

`renderTransparentMovWorker` starts the Worker and sends `prepare`. If preparation succeeds, it creates the HTTP job with `transport: 'raw-rgba-ordered'`, sends `start`, translates events into `ExportProgress`, terminates after one terminal event, and discards the job on non-save failures. This ordering guarantees unsupported Worker Canvas/font environments fall back before a server job exists.

- [ ] **Step 4: Integrate Workbench with pre-job fallback**

Store a separate `workerMovAvailable` flag from the capability response. Workbench chooses:

```ts
const result = workerMovAvailable && canUseWorkerMovExport()
  ? await renderTransparentMovWorker(workerOptions)
  : await renderTransparentMovRaw(mainThreadOptions)
```

If Worker construction/font initialization reports `unsupported` before a job is created, use the main-thread path. Once an ordered-v2 job exists, failures cancel that job and surface an error; do not create a second job automatically.

Keep PNG capture, file picker, fingerprint invalidation, pending completed job, saving, and cancellation UI unchanged.

- [ ] **Step 5: Run coordinator, Workbench, and export tests**

Run: `npm test -- --run src/export/worker src/components/Workbench.export.test.tsx src/export`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/export/worker/workerMovClient.ts src/export/worker/workerMovClient.test.ts src/components/Workbench.tsx src/components/Workbench.export.test.tsx
git commit -m "feat: prefer worker mov export pipeline"
```

### Task 7: Add real-browser parity and benchmark tooling

**Files:**
- Create: `src/export/benchmark/WorkerExportBenchmark.tsx`
- Create: `src/export/benchmark/WorkerExportBenchmark.test.tsx`
- Create: `scripts/run-worker-export-benchmark.mjs`
- Create: `scripts/run-worker-export-benchmark.test.mjs`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write failing benchmark contract tests**

Assert the runner accepts only `short` or `long`, uses a unique Chrome profile/port, opens the built local URL with `worker-export-benchmark=1`, polls a terminal status, emits machine-readable JSON, closes Chrome, and deletes its temporary profile after process exit.

The React benchmark must choose the 300-frame fixture for `short`, the 11,248-frame fixture for `long`, bypass native pickers, preserve the completed server job for probing, and report phase timings plus job ID.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run src/export/benchmark/WorkerExportBenchmark.test.tsx scripts/run-worker-export-benchmark.test.mjs`

Expected: FAIL because benchmark tooling does not exist.

- [ ] **Step 3: Implement the hidden benchmark route**

In `main.tsx`:

```tsx
const benchmark = new URLSearchParams(window.location.search)
  .has('worker-export-benchmark')

createRoot(document.getElementById('root')!).render(
  benchmark
    ? <WorkerExportBenchmark />
    : <StrictMode><App /></StrictMode>,
)
```

The benchmark first renders all 24 visual fixtures on HTML canvas and Worker OffscreenCanvas. Compare every RGBA byte, require non-empty Alpha, and require four transparent corners. Then run the selected export fixture through the production Worker coordinator.

- [ ] **Step 4: Implement the reusable headless Chrome runner**

Use Chrome CDP over the existing `ws` dependency. Print one progress line every 20 seconds and one final line beginning `BENCHMARK_RESULT=`. Wait for Chrome process exit before recursively deleting the temporary profile so Windows Crashpad files do not cause `EBUSY`.

- [ ] **Step 5: Run automated tests, lint, and build**

Run: `npm test -- --run src/export/benchmark scripts/run-worker-export-benchmark.test.mjs`

Run: `npm run lint`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/export/benchmark scripts/run-worker-export-benchmark.mjs scripts/run-worker-export-benchmark.test.mjs src/main.tsx
git commit -m "test: add worker export browser benchmark"
```

### Task 8: Enforce the short performance and quality gate

**Files:**
- Modify: `docs/verification/canvas-raw-export-results.md`

- [ ] **Step 1: Start the built app on an isolated origin**

Run a production build, then start Overlay Studio with an explicit unused port and no browser opening. Verify `/__overlay_export__/capabilities` returns ordered-v2, Worker pipeline, and window size three.

- [ ] **Step 2: Run the mixed 300-frame benchmark three times**

Run: `node scripts/run-worker-export-benchmark.mjs short`

Expected:

- all 24 HTML/Worker fixture comparisons are byte-identical;
- three runs complete;
- median is at least 47fps;
- no run is below 44fps;
- every run reports at most three frames in flight.

If this gate fails, stop before the full export. Record Worker draw, enqueue, acknowledgement, encoding, and saving data. Do not change codec quality.

- [ ] **Step 3: Probe the retained short MOV**

Use bundled FFmpeg to require ProRes 4444, `yuva444p12le`, 1920x1080, 30fps, no audio, and exactly 300 frames. Decode first/middle/final Alpha planes and require `YMIN=0` and `YMAX=4095`.

- [ ] **Step 4: Record and commit the short gate**

```powershell
git add docs/verification/canvas-raw-export-results.md
git commit -m "docs: record worker export short gate"
```

### Task 9: Run the full four-minute acceptance gate

**Files:**
- Modify: `docs/verification/canvas-raw-export-results.md`

- [ ] **Step 1: Run the full 11,248-frame Worker export**

Run: `node scripts/run-worker-export-benchmark.mjs long`

Expected: rendering, encoding, and local result streaming complete in at most 240 seconds. Record exact elapsed time, fps, peak in-flight count, output bytes, and all phase durations.

- [ ] **Step 2: Probe the full result**

Use bundled FFmpeg to verify:

```text
Duration: 00:06:14.93
Video: prores (4444) (ap4h), yuva444p12le, 1920x1080, 30 fps
Audio streams: none
Frames: 11248
```

Decode frame indexes 0, 5,624, and 11,247 with `alphaextract,signalstats`; each must contain both Alpha 0 and Alpha 4095.

- [ ] **Step 3: Run the complete merged verification suite**

Run: `npm test -- --run`

Run: `npm run lint`

Run: `npm run build`

Run: `git diff --check`

Expected: all commands exit 0.

- [ ] **Step 4: Update evidence and commit**

Record machine, date, short trials, full result, codec probe, Alpha samples, and whether the 240-second hard gate passed.

```powershell
git add docs/verification/canvas-raw-export-results.md
git commit -m "docs: verify four minute worker export"
```

- [ ] **Step 5: Confirm clean repository state**

Run: `git status --short`

Expected: no output.
