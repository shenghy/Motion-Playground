# Transparent Overlay Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export the existing timeline cards as deterministic 1920×1080, 30fps transparent PNG sequences and ProRes 4444 Alpha MOV files without including the source video.

**Architecture:** A browser-only export surface renders card state from an explicit frame time and captures transparent PNG blobs. PNG mode writes those blobs directly to a chosen directory; MOV mode streams them in order to a localhost export API, whose job manager pipes the frames into the bundled FFmpeg binary and streams the completed MOV back to the browser.

**Tech Stack:** React 19, TypeScript, Motion, `html-to-image`, File System Access API, Node HTTP, `ffmpeg-static`, Vitest, Testing Library.

---

## File Structure

- Create `src/export/frameMath.ts` and `src/export/frameMath.test.ts`: frame counts, timestamps, local card time, file names, easing and loop helpers.
- Create `src/export/fileSystemAccess.ts`: narrow Chrome/Edge File System Access API types and capability checks.
- Create `src/export/ExportSurface.tsx` and `src/export/ExportSurface.test.tsx`: transparent 1920×1080 card-only renderer with an imperative frame capture API.
- Create `src/export/exportController.ts` and `src/export/exportController.test.ts`: sequential frame loop, progress, cancellation, PNG directory output and MOV client orchestration.
- Create `src/export/movExportClient.ts` and `src/export/movExportClient.test.ts`: typed localhost export API client and streamed final-file writer.
- Create `src/components/ExportPanel.tsx` and `src/components/ExportPanel.test.tsx`: export status, eligibility, progress and action controls.
- Create `scripts/export-manager.mjs` and `scripts/export-manager.test.mjs`: FFmpeg process ownership, ordered frame ingestion, completion, download and cleanup.
- Create `scripts/export-api.mjs` and `scripts/export-api.test.mjs`: same-origin localhost routes and validation.
- Modify `src/motion/types.ts`, `src/motion/useCountUp.ts`, and all six motion components: deterministic `playbackTime` export state.
- Modify `scripts/local-server.mjs`, `scripts/start-overlay-studio.mjs`, and their tests: mount/close export API and expose capabilities.
- Modify `src/components/Workbench.tsx`, `src/components/ParameterPanel.tsx`, their tests, and `src/styles.css`: connect the export surface and panel without changing existing editor behavior.
- Modify `package.json` and lockfile: add `html-to-image` and `ffmpeg-static`.

### Task 1: Frame-Time Model and Deterministic Motion Helpers

**Files:**
- Create: `src/export/frameMath.test.ts`
- Create: `src/export/frameMath.ts`
- Modify: `src/motion/types.ts`
- Modify: `src/motion/useCountUp.ts`
- Modify: `src/motion/MetricFocus.test.tsx`
- Modify: `src/motion/MetricFocus.tsx`
- Modify: `src/motion/CompareSplit.tsx`
- Modify: `src/motion/ProfileReveal.tsx`
- Modify: `src/motion/BarCompare.tsx`
- Modify: `src/motion/ShareRing.tsx`
- Modify: `src/motion/StepFlow.tsx`

- [ ] **Step 1: Write failing frame-time tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  calculateFrameCount,
  calculateFrameTime,
  getCardPlaybackState,
  interpolateKeyframes,
  loopTime,
} from './frameMath'

describe('transparent export frame math', () => {
  it('covers the complete duration at 30fps', () => {
    expect(calculateFrameCount(10.01, 30)).toBe(301)
    expect(calculateFrameTime(300, 30)).toBe(10)
  })

  it('uses half-open card timing and local card time', () => {
    expect(getCardPlaybackState({ start: 2, end: 5 }, 1.99)).toEqual({
      active: false,
      localTime: 0,
    })
    expect(getCardPlaybackState({ start: 2, end: 5 }, 2.5)).toEqual({
      active: true,
      localTime: 0.5,
    })
    expect(getCardPlaybackState({ start: 2, end: 5 }, 5)).toEqual({
      active: false,
      localTime: 3,
    })
  })

  it('calculates deterministic loop and keyframe values', () => {
    expect(loopTime(6.5, 6)).toBeCloseTo(0.5)
    expect(interpolateKeyframes(0.5, [0, 1, 0], [0, 0.5, 1])).toBe(1)
  })
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
npx vitest --run src/export/frameMath.test.ts
```

Expected: FAIL because `src/export/frameMath.ts` does not exist.

- [ ] **Step 3: Implement the pure frame helpers**

Implement these exact public functions:

```ts
export const EXPORT_WIDTH = 1920
export const EXPORT_HEIGHT = 1080
export const EXPORT_FPS = 30

export function calculateFrameCount(duration: number, fps = EXPORT_FPS) {
  if (!Number.isFinite(duration) || duration <= 0) return 0
  return Math.ceil(duration * fps)
}

export function calculateFrameTime(frameIndex: number, fps = EXPORT_FPS) {
  return Math.max(0, frameIndex) / fps
}

export function getCardPlaybackState(
  card: Pick<OverlayCard, 'start' | 'end'>,
  frameTime: number,
) {
  return {
    active: card.start <= frameTime && frameTime < card.end,
    localTime: Math.max(0, frameTime - card.start),
  }
}

export function loopTime(time: number, duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return 0
  return ((Math.max(0, time) % duration) + duration) % duration
}
```

Add clamped easing, delayed progress and numeric/keyframe interpolation helpers. All helpers must return finite values for invalid input.

- [ ] **Step 4: Add export time to motion props and count-up**

Change the shared prop:

```ts
export interface MotionComponentProps<T extends ParameterValues> {
  params: T
  playbackTime?: number
}
```

Change `useCountUp` to accept an optional fourth argument. When it is present, calculate the eased count synchronously from that time; when absent, preserve the existing requestAnimationFrame preview behavior:

```ts
export function useCountUp(
  target: number,
  duration: number,
  decimals = 0,
  playbackTime?: number,
) {
  // Existing preview state stays unchanged.
  // Export mode returns target * easeOutQuart(clamp(playbackTime / duration)).
}
```

- [ ] **Step 5: Make the six components deterministic in export mode**

For each component, destructure `playbackTime`. Preserve the current Motion elements when `playbackTime === undefined`. When it is defined:

- derive the existing entrance/loop progress from pure helpers;
- pass `initial={false}`;
- pass an immediate computed `animate` object;
- pass `transition={{ duration: 0 }}`;
- calculate count-up text from `playbackTime`;
- use the same loop duration and repeat delay already present in the component.

Add a focused MetricFocus test:

```tsx
const { rerender } = render(
  <MetricFocus params={defaults} playbackTime={0} />,
)
expect(screen.getByLabelText(/核心指标/)).toHaveTextContent('0')
rerender(<MetricFocus params={defaults} playbackTime={2} />)
expect(screen.getByLabelText(/核心指标/)).toHaveTextContent('248')
```

- [ ] **Step 6: Verify deterministic motion tests**

Run:

```powershell
npx vitest --run src/export/frameMath.test.ts src/motion
```

Expected: frame math and all motion component tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/export/frameMath.ts src/export/frameMath.test.ts src/motion
git commit -m "feat: add deterministic motion frame clock"
```

### Task 2: Transparent Export Surface and PNG Capture

**Files:**
- Create: `src/export/ExportSurface.test.tsx`
- Create: `src/export/ExportSurface.tsx`
- Create: `src/export/fileSystemAccess.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/styles.css`

- [ ] **Step 1: Install browser capture dependency**

Run:

```powershell
npm install html-to-image@1.11.13
```

Expected: package and lockfile record the MIT-licensed dependency.

- [ ] **Step 2: Write failing export-surface tests**

Test that an export frame:

- renders only cards active at the requested frame time;
- sorts cards by `zIndex`;
- applies the existing percentage translation;
- passes local `playbackTime`;
- contains no `video`, `.presenter-background`, safe area, selected state or playback controls;
- exposes a 1920×1080 transparent capture root.

```tsx
render(<ExportSurface ref={ref} cards={cards} />)
await act(() => ref.current!.prepareFrame(2.5))
expect(screen.getByTestId('export-card-active')).toBeInTheDocument()
expect(container.querySelector('video')).toBeNull()
expect(screen.getByTestId('export-surface')).toHaveAttribute(
  'data-background',
  'transparent',
)
```

- [ ] **Step 3: Run the test and verify RED**

Run:

```powershell
npx vitest --run src/export/ExportSurface.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 4: Implement File System Access API types**

Define narrow interfaces for:

```ts
export interface OverlayFileSystemFileHandle {
  name: string
  createWritable(): Promise<OverlayFileSystemWritable>
}

export interface OverlayFileSystemDirectoryHandle {
  name: string
  getDirectoryHandle(name: string, options: { create: true }): Promise<OverlayFileSystemDirectoryHandle>
  getFileHandle(name: string, options: { create: true }): Promise<OverlayFileSystemFileHandle>
}

export function supportsOverlayFileExport(windowObject = window) {
  return (
    typeof windowObject.showSaveFilePicker === 'function' &&
    typeof windowObject.showDirectoryPicker === 'function'
  )
}
```

- [ ] **Step 5: Implement the export surface**

Expose:

```ts
export interface ExportSurfaceHandle {
  prepareFrame(time: number): Promise<void>
  capturePng(): Promise<Blob>
}
```

`prepareFrame` updates frame time and waits for React commit, two animation frames and `document.fonts.ready`. `capturePng` uses `toBlob(root, { width: 1920, height: 1080, backgroundColor: 'transparent', pixelRatio: 1 })` and throws a Chinese error if no blob is produced.

Render only card wrappers and motion components. Add off-screen fixed CSS that keeps the node renderable without affecting page layout:

```css
.export-surface-host {
  position: fixed;
  left: -10000px;
  top: 0;
  width: 1920px;
  height: 1080px;
  pointer-events: none;
}

.export-surface {
  position: relative;
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  background: transparent;
}
```

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npx vitest --run src/export/ExportSurface.test.tsx
```

Expected: PASS.

```powershell
git add package.json package-lock.json src/export src/styles.css
git commit -m "feat: add transparent frame renderer"
```

### Task 3: Sequential PNG Export Controller

**Files:**
- Create: `src/export/exportController.test.ts`
- Create: `src/export/exportController.ts`

- [ ] **Step 1: Write failing controller tests**

Use in-memory fake directory/file handles. Assert:

- file names start at `frame_000001.png` and are continuous;
- frame times are `0`, `1/30`, `2/30`;
- only one Blob exists in the controller at a time;
- progress reports completed and total frames;
- abort stops before the next frame and keeps completed files;
- picker cancellation returns `{ status: 'cancelled' }`.

The wished-for API:

```ts
await exportPngSequence({
  duration: 0.1,
  captureFrame,
  chooseDirectory,
  signal,
  onProgress,
  now: () => new Date('2026-07-26T08:00:00Z'),
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx vitest --run src/export/exportController.test.ts
```

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement sequential export**

Add:

```ts
export interface ExportProgress {
  phase: 'rendering' | 'encoding' | 'saving'
  completedFrames: number
  totalFrames: number
}

export async function exportPngSequence(options: {
  duration: number
  captureFrame(time: number): Promise<Blob>
  chooseDirectory(): Promise<OverlayFileSystemDirectoryHandle>
  signal: AbortSignal
  onProgress(progress: ExportProgress): void
  now?: () => Date
}): Promise<ExportResult>
```

For each frame, await capture, open one file, write the Blob, close it, release references, then report progress.

- [ ] **Step 4: Verify and commit**

```powershell
npx vitest --run src/export/exportController.test.ts
git add src/export/exportController.ts src/export/exportController.test.ts
git commit -m "feat: export transparent PNG sequences"
```

### Task 4: Local FFmpeg Job Manager

**Files:**
- Create: `scripts/export-manager.test.mjs`
- Create: `scripts/export-manager.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install the bundled encoder**

Run:

```powershell
npm install ffmpeg-static@5.3.0
```

Expected: package and platform binary are installed under `node_modules`.

- [ ] **Step 2: Write failing manager tests**

Inject a fake spawn function and temporary directory. Test:

- exact ProRes 4444 Alpha arguments;
- PNG frames are accepted only in continuous zero-based order;
- frame bytes are written to stdin with backpressure;
- finish closes stdin and waits for exit code 0;
- non-zero exit reports a bounded stderr summary;
- only one job can be active;
- cancel kills FFmpeg and removes temporary output;
- successful download cleanup removes the job directory;
- no command argument or stdin input contains a source-video path.

Wished-for API:

```js
const manager = createExportManager({
  ffmpegPath: 'ffmpeg',
  spawnProcess,
  temporaryRoot,
})
const job = await manager.createJob({
  width: 1920,
  height: 1080,
  fps: 30,
  totalFrames: 3,
})
await manager.appendFrame(job.id, 0, pngBuffer)
await manager.finishJob(job.id)
await manager.cancelJob(job.id)
```

- [ ] **Step 3: Run the tests and verify RED**

```powershell
npx vitest --run scripts/export-manager.test.mjs
```

Expected: FAIL because the manager does not exist.

- [ ] **Step 4: Implement manager and FFmpeg arguments**

Use:

```js
[
  '-hide_banner', '-loglevel', 'error',
  '-f', 'image2pipe',
  '-framerate', '30',
  '-vcodec', 'png',
  '-i', 'pipe:0',
  '-an',
  '-c:v', 'prores_ks',
  '-profile:v', '4',
  '-pix_fmt', 'yuva444p10le',
  '-alpha_bits', '16',
  '-y', outputPath,
]
```

Use `mkdtemp` under `tmpdir()`, random UUID job IDs, a bounded stderr buffer and `pipeline`-safe file streaming. Validate dimensions, fps, total frame count, PNG signature and a conservative per-frame size limit.

- [ ] **Step 5: Verify and commit**

```powershell
npx vitest --run scripts/export-manager.test.mjs
git add package.json package-lock.json scripts/export-manager.mjs scripts/export-manager.test.mjs
git commit -m "feat: encode transparent ProRes MOV"
```

### Task 5: Same-Origin Export API and Launcher Integration

**Files:**
- Create: `scripts/export-api.test.mjs`
- Create: `scripts/export-api.mjs`
- Modify: `scripts/local-server.mjs`
- Modify: `scripts/local-server.test.mjs`
- Modify: `scripts/start-overlay-studio.mjs`
- Modify: `scripts/start-overlay-studio.test.mjs`

- [ ] **Step 1: Write failing HTTP API tests**

Start the real local server with a fake manager. Verify:

- `GET /__overlay_export__/capabilities`;
- `POST /__overlay_export__/jobs`;
- `PUT /__overlay_export__/jobs/:id/frames/:index` with `image/png`;
- `POST /__overlay_export__/jobs/:id/finish`;
- `GET /__overlay_export__/jobs/:id/file`;
- `DELETE /__overlay_export__/jobs/:id`;
- rejects wrong origin, invalid JSON, invalid content type, oversized body, skipped frame and unknown job;
- server shutdown cancels active export jobs.

- [ ] **Step 2: Run and verify RED**

```powershell
npx vitest --run scripts/export-api.test.mjs scripts/local-server.test.mjs
```

Expected: FAIL because the API is absent.

- [ ] **Step 3: Implement the API adapter**

Export:

```js
export function createExportApi({ manager, host, port }) {
  return {
    async handle(request, response) {},
    async close() {
      await manager.close()
    },
  }
}
```

Return JSON with `Cache-Control: no-store`; never enable cross-origin access. For mutating requests, accept only the exact local `Origin` or no Origin from tests/CLI. Stream final MOV with `Content-Type: video/quicktime` and a safe attachment filename.

- [ ] **Step 4: Integrate the server and bundled binary**

Import `ffmpeg-static` in the launcher, create the manager before starting the static server, and pass the API adapter into `createLocalStaticServer`. Reused services continue to report their current capability endpoint. Server close must close the API before resolving.

Do not pass the source video path, Blob or metadata to the export manager.

- [ ] **Step 5: Verify and commit**

```powershell
npm run test:launcher
git add scripts
git commit -m "feat: expose localhost overlay export API"
```

### Task 6: Browser MOV Client and Export UI

**Files:**
- Create: `src/export/movExportClient.test.ts`
- Create: `src/export/movExportClient.ts`
- Create: `src/components/ExportPanel.test.tsx`
- Create: `src/components/ExportPanel.tsx`
- Modify: `src/export/exportController.ts`
- Modify: `src/export/exportController.test.ts`
- Modify: `src/components/ParameterPanel.tsx`
- Modify: `src/components/ParameterPanel.test.tsx`
- Modify: `src/components/Workbench.tsx`
- Modify: `src/components/Workbench.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing MOV client tests**

Mock `fetch` and a writable file handle. Verify request order:

```text
capabilities
create job
frame 0
frame 1
finish
download stream
delete/cleanup
```

Verify fetch response chunks are written directly to the chosen writable without concatenating the complete MOV Blob. Abort must issue DELETE exactly once.
Also test that a final-file write failure keeps the completed server job available for one `retrySaveMovJob` call; explicit discard deletes it.

- [ ] **Step 2: Implement the typed MOV client**

Expose:

```ts
export async function getMovExportCapability(fetcher = fetch): Promise<boolean>
export async function renderTransparentMov(options: {
  duration: number
  captureFrame(time: number): Promise<Blob>
  signal: AbortSignal
  onProgress(progress: ExportProgress): void
  fetcher?: typeof fetch
}): Promise<CompletedMovJob>
export async function saveCompletedMov(
  job: CompletedMovJob,
  fileHandle: OverlayFileSystemFileHandle,
  fetcher?: typeof fetch,
): Promise<void>
export async function discardCompletedMov(
  job: CompletedMovJob,
  fetcher?: typeof fetch,
): Promise<void>
```

Validate every HTTP response and surface concise Chinese errors. Rendering/encoding failures and aborts cancel the job. A save-stream failure retains the completed job so the UI can offer “重新保存” and “放弃文件”; successful save or explicit discard cleans it up.

- [ ] **Step 3: Write failing ExportPanel tests**

Test:

- disabled reason when no video, no cards, unsupported browser or unavailable FFmpeg;
- 1920×1080, 30fps, duration and total frames;
- MOV and PNG actions;
- progress and cancel;
- success and error messages.

- [ ] **Step 4: Implement ExportPanel and Workbench orchestration**

`Workbench` owns:

- one `ExportSurfaceHandle` ref;
- export status and `AbortController`;
- capability check after hydration;
- a shared `captureFrame(time)` delegate;
- MOV and PNG start handlers;
- completed MOV job state for “重新保存” and “放弃文件”;
- cancellation;
- an `isExporting` guard in editing handlers and disabled props for editing controls.

Mount `<ExportSurface cards={cards} ref={exportSurfaceRef} />` outside the visible workspace. Pass an `exportPanel` slot or explicit export props through `ParameterPanel`.

Do not mark the complete workspace inert during export because that would also disable the cancel button. Disable the component rail, preview manipulation, timeline and ordinary parameter controls while leaving ExportPanel progress/cancel actions operable.

Do not add export state to autosaved workspace or JSON project data.

- [ ] **Step 5: Add restrained panel styling**

Match the existing monochrome pencil interface. Use borders and typography rather than shadows or new accent colors. Keep the export progress readable at the current 248–284px side-panel widths.

- [ ] **Step 6: Verify and commit**

```powershell
npx vitest --run src/export src/components/ExportPanel.test.tsx src/components/ParameterPanel.test.tsx src/components/Workbench.test.tsx
git add src
git commit -m "feat: add transparent export controls"
```

### Task 7: End-to-End Verification and Documentation

**Files:**
- Modify: `本地启动说明.md`
- Modify: `docs/superpowers/specs/2026-07-26-transparent-overlay-export-design.md` only if implementation reveals a factual correction.

- [ ] **Step 1: Add launcher/export usage documentation**

Document:

- Chrome/Edge requirement;
- MOV is card-only ProRes 4444 Alpha;
- PNG folder naming;
- both outputs start at video time 0;
- imported MOV belongs above the original video track;
- expected large file sizes and cancellation behavior;
- no global FFmpeg installation is required.

- [ ] **Step 2: Run focused real FFmpeg capability check**

Run the bundled binary:

```powershell
node --input-type=module -e "import ffmpegPath from 'ffmpeg-static'; import {spawnSync} from 'node:child_process'; const r=spawnSync(ffmpegPath,['-hide_banner','-encoders'],{encoding:'utf8'}); if(r.status!==0 || !r.stdout.includes('prores_ks')) process.exit(1)"
```

Expected: exit 0 and `prores_ks` is available.

- [ ] **Step 3: Run the full automated verification**

```powershell
npm run lint
npm run build
npm test -- --run
npm run test:launcher
git diff --check
git status --short
```

Expected: no lint/build/test failures and only intentional changes.

- [ ] **Step 4: Browser smoke test**

Start through the existing local launcher and verify:

1. Existing saved video and cards restore.
2. Export panel shows the correct duration and total frames.
3. A short PNG export creates transparent numbered files.
4. A short MOV export completes.
5. Inspect the MOV with FFmpeg and confirm `prores`, `yuva444p10le`, 1920×1080 and 30fps.
6. Confirm no video pixels appear in transparent gaps.
7. Cancel a second export and verify the UI returns to idle.
8. Refresh and confirm project/video/card persistence is unchanged.

- [ ] **Step 5: Request independent code review**

Review against the approved design, emphasizing:

- deterministic frame state;
- no source-video path/data in the export pipeline;
- Alpha preservation;
- localhost API validation;
- cancellation and temporary-file cleanup;
- existing feature regressions.

- [ ] **Step 6: Commit final documentation or fixes**

```powershell
git add .
git commit -m "docs: document transparent overlay export"
```

Do not create an empty commit if no final changes remain.
