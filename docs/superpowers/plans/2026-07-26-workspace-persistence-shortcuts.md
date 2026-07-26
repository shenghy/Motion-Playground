# Workspace Persistence And Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the local video and complete overlay workspace across refreshes, add double-click/Delete shortcuts, and provide a confirmed full-workspace reset.

**Architecture:** A focused IndexedDB adapter owns the `workspace` and `assets` stores, while a latest-value write queue serializes debounced workspace saves. `Workbench` receives the storage adapter through an optional prop, hydrates once before enabling autosave, and keeps the existing overlay state model as the source of truth. A small accessible confirmation dialog lives with the project-file controls.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, IndexedDB, `fake-indexeddb` for tests.

---

## File Map

- Create `src/persistence/workspaceStorage.ts`: persisted types, runtime validation, IndexedDB adapter, video/workspace transactions.
- Create `src/persistence/workspaceStorage.test.ts`: real adapter tests against `fake-indexeddb`.
- Create `src/persistence/latestWriteQueue.ts`: serial latest-value write queue.
- Create `src/persistence/latestWriteQueue.test.ts`: ordering, coalescing, and error recovery tests.
- Create `src/components/ClearWorkspaceDialog.tsx`: accessible confirmation dialog.
- Create `src/components/ClearWorkspaceDialog.test.tsx`: cancel, Escape, confirm, and focus-return tests.
- Modify `src/components/ComponentRail.tsx`: double-click shortcut.
- Modify `src/components/ComponentRail.test.tsx`: single-add double-click coverage.
- Modify `src/components/Workbench.tsx`: hydration, autosave, restored-video policy, Delete shortcut, clear workflow.
- Modify `src/components/Workbench.test.tsx`: integration tests for persistence, shortcuts, and clear.
- Modify `src/components/PreviewStage.tsx`: restored video starts paused and muted.
- Modify `src/components/PreviewStage.test.tsx`: restored/new video playback policy.
- Modify `src/components/ProjectFileControls.tsx`: clear button and controlled dialog.
- Modify `src/components/ProjectFileControls.test.tsx`: clear integration.
- Modify `src/components/ParameterPanel.tsx`: persistence error and clear callbacks.
- Modify `src/components/ParameterPanel.test.tsx`: control wiring.
- Modify `src/styles.css`: destructive button, modal, restoring/error states.
- Modify `package.json` and lockfile: add `fake-indexeddb` as a development dependency.

### Task 1: IndexedDB Workspace Adapter

**Files:**
- Create: `src/persistence/workspaceStorage.ts`
- Create: `src/persistence/workspaceStorage.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install the IndexedDB test implementation**

Run:

```powershell
npm install --save-dev fake-indexeddb
```

Expected: `fake-indexeddb` appears only in `devDependencies`.

- [ ] **Step 2: Write failing storage tests**

Create tests that import `fake-indexeddb/auto`, use a unique database name per
test, and exercise this contract:

```ts
export interface PersistedWorkspaceV1 {
  version: 1
  project: OverlayProject
  parametersByMotion: Record<MotionId, ParameterValues>
  activeId: MotionId
  showSafeArea: boolean
  video: {
    present: boolean
    name?: string
    type?: string
    lastModified?: number
  }
}

export interface PersistedVideoV1 {
  version: 1
  blob: Blob
  name: string
  type: string
  lastModified: number
}

export interface WorkspaceStorage {
  load(): Promise<{
    workspace: PersistedWorkspaceV1 | null
    video: PersistedVideoV1 | null
  }>
  saveWorkspace(workspace: PersistedWorkspaceV1): Promise<void>
  commitVideo(
    video: PersistedVideoV1,
    workspace: PersistedWorkspaceV1,
  ): Promise<void>
  removeVideo(workspace: PersistedWorkspaceV1): Promise<void>
  clear(): Promise<void>
}
```

Required assertions:

```ts
expect(await storage.load()).toEqual({ workspace: null, video: null })
await storage.saveWorkspace(workspace)
expect((await storage.load()).workspace).toEqual(workspace)
await storage.commitVideo(video, workspaceWithVideo)
expect((await storage.load()).video?.blob.size).toBe(video.blob.size)
await storage.removeVideo(workspaceWithoutVideo)
expect(await storage.load()).toEqual({
  workspace: workspaceWithoutVideo,
  video: null,
})
await storage.clear()
expect(await storage.load()).toEqual({ workspace: null, video: null })
```

Also test that `commitVideo`, `removeVideo`, and `clear` are atomic across both
stores by aborting a test transaction and verifying neither store changed.

- [ ] **Step 3: Run the storage tests and confirm RED**

Run:

```powershell
npm test -- --run src/persistence/workspaceStorage.test.ts
```

Expected: FAIL because `workspaceStorage.ts` does not exist.

- [ ] **Step 4: Implement the adapter**

Implement:

```ts
export function createWorkspaceStorage(
  databaseName = 'overlay-studio',
): WorkspaceStorage
```

Use database version `1`, create `workspace` and `assets` stores in
`onupgradeneeded`, and use keys `current` and `video`. Wrap requests and
transactions in small Promise helpers. Reject when `indexedDB` is unavailable.
Close the database after each public operation so tests and future upgrades do
not retain stale connections.

Implement transaction methods with one `readwrite` transaction:

```ts
const workspaceStore = transaction.objectStore('workspace')
const assetsStore = transaction.objectStore('assets')
workspaceStore.put(workspace, 'current')
assetsStore.put(video, 'video')
```

`removeVideo` deletes `assets/video` and writes the provided workspace in the
same transaction. `clear` clears both stores in the same transaction.

- [ ] **Step 5: Add persisted snapshot validation**

Export:

```ts
export function parsePersistedWorkspace(
  value: unknown,
  defaults: Record<MotionId, ParameterValues>,
): PersistedWorkspaceV1
```

Validate:

- `version === 1`
- `project` through `parseOverlayProject`
- `activeId` through `isMotionId`
- `showSafeArea` is boolean
- every `parametersByMotion` key is a registered motion
- each parameter key exists in that motion's defaults and has the same primitive type
- missing parameter values are merged from defaults
- `video.present` and optional metadata have correct types

Throw exactly `本地工作区数据无效` for invalid structures. Add RED/GREEN tests
for unknown motions, wrong parameter types, bad versions, and merged defaults.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm test -- --run src/persistence/workspaceStorage.test.ts
npm run lint
npm run build
git diff --check
```

Expected: all commands pass.

Commit:

```powershell
git add package.json package-lock.json src/persistence/workspaceStorage.ts src/persistence/workspaceStorage.test.ts
git commit -m "feat: add local workspace storage"
```

### Task 2: Latest-Value Write Queue

**Files:**
- Create: `src/persistence/latestWriteQueue.ts`
- Create: `src/persistence/latestWriteQueue.test.ts`

- [ ] **Step 1: Write failing queue tests**

Define the desired API in tests:

```ts
const queue = createLatestWriteQueue(async (value: number) => {
  writes.push(value)
  await gates[value].promise
})

queue.enqueue(1)
queue.enqueue(2)
queue.enqueue(3)
```

Assert that write `1` starts immediately, values `2` and `3` coalesce into one
pending write, and only `3` starts after `1` resolves. Add tests showing:

- a failed write rejects the corresponding `flush()` call
- the queue can accept and save a newer value after failure
- `dispose()` drops pending values without starting another write

- [ ] **Step 2: Run and confirm RED**

Run:

```powershell
npm test -- --run src/persistence/latestWriteQueue.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal queue**

Export:

```ts
export interface LatestWriteQueue<T> {
  enqueue(value: T): void
  flush(): Promise<void>
  dispose(): void
}

export function createLatestWriteQueue<T>(
  write: (value: T) => Promise<void>,
): LatestWriteQueue<T>
```

Maintain one in-flight write and one replaceable pending value. `flush()` waits
until both are empty. Capture errors, reject current waiters, clear the failed
error after reporting it, and allow later enqueue calls to continue.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
npm test -- --run src/persistence/latestWriteQueue.test.ts
npm run lint
npm run build
git diff --check
```

Commit:

```powershell
git add src/persistence/latestWriteQueue.ts src/persistence/latestWriteQueue.test.ts
git commit -m "feat: serialize workspace saves"
```

### Task 3: Double-Click And Delete Shortcuts

**Files:**
- Modify: `src/components/ComponentRail.tsx`
- Modify: `src/components/ComponentRail.test.tsx`
- Modify: `src/components/Workbench.tsx`
- Modify: `src/components/Workbench.test.tsx`

- [ ] **Step 1: Write the double-click RED test**

In `ComponentRail.test.tsx`, use `userEvent.dblClick` on the component's main
selection button and assert:

```ts
expect(onSelect).toHaveBeenCalled()
expect(onAddMotion).toHaveBeenCalledTimes(1)
expect(onAddMotion).toHaveBeenCalledWith('metric-focus')
```

Also double-click the separate `+` button and confirm the main-button shortcut
is not involved.

- [ ] **Step 2: Run and confirm RED**

Run:

```powershell
npm test -- --run src/components/ComponentRail.test.tsx
```

Expected: FAIL because double-click does not add.

- [ ] **Step 3: Implement double-click**

Add to the existing main component button:

```tsx
onDoubleClick={() => onAddMotion?.(item.id)}
```

Do not change its `onClick`, `draggable`, or keyboard behavior.

- [ ] **Step 4: Write Delete shortcut RED tests**

In `Workbench.test.tsx`:

1. Create a card through the existing video-duration and add flow.
2. Select its timeline button.
3. Dispatch `userEvent.keyboard('{Delete}')`.
4. Assert the clip disappears.

Repeat with focus in:

```ts
screen.getByRole('textbox', { name: '指标名称' })
screen.getByRole('slider', { name: '核心数值' })
```

and assert the card remains. Add a contenteditable element to the rendered
document for the final guard case.

- [ ] **Step 5: Implement guarded Delete**

Add a small exported helper for direct tests:

```ts
export function isEditableDeleteTarget(target: EventTarget | null) {
  return target instanceof HTMLElement &&
    Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}
```

Register one document `keydown` listener in `Workbench`:

```ts
if (
  event.key === 'Delete' &&
  !isEditableDeleteTarget(event.target) &&
  overlayWorkspaceRef.current.selectedCardId
) {
  event.preventDefault()
  deleteCard(overlayWorkspaceRef.current.selectedCardId)
}
```

Use a stable callback and remove the listener in cleanup.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm test -- --run src/components/ComponentRail.test.tsx src/components/Workbench.test.tsx
npm run lint
npm run build
git diff --check
```

Commit:

```powershell
git add src/components/ComponentRail.tsx src/components/ComponentRail.test.tsx src/components/Workbench.tsx src/components/Workbench.test.tsx
git commit -m "feat: add overlay editing shortcuts"
```

### Task 4: Workbench Hydration And Autosave

**Files:**
- Modify: `src/components/Workbench.tsx`
- Modify: `src/components/Workbench.test.tsx`
- Modify: `src/components/PreviewStage.tsx`
- Modify: `src/components/PreviewStage.test.tsx`

- [ ] **Step 1: Add a storage test double**

In `Workbench.test.tsx`, define a real-state fake matching `WorkspaceStorage`:

```ts
function createStorageDouble(initial?: {
  workspace: PersistedWorkspaceV1 | null
  video: PersistedVideoV1 | null
}) {
  let state = initial ?? { workspace: null, video: null }
  return {
    load: vi.fn(async () => structuredClone(state)),
    saveWorkspace: vi.fn(async (workspace) => {
      state = { ...state, workspace }
    }),
    commitVideo: vi.fn(async (video, workspace) => {
      state = { workspace, video }
    }),
    removeVideo: vi.fn(async (workspace) => {
      state = { workspace, video: null }
    }),
    clear: vi.fn(async () => {
      state = { workspace: null, video: null }
    }),
  } satisfies WorkspaceStorage
}
```

Use Blob-preserving copies instead of `structuredClone` if the test runtime
does not preserve Blob identity.

- [ ] **Step 2: Write hydration RED tests**

Render:

```tsx
<Workbench storage={storage} />
```

Assert:

- stored cards, card params, positions, active motion params, and safe-area setting restore
- stored video creates an object URL and displays its file name
- no `saveWorkspace` call happens before `load` resolves
- a malformed stored workspace shows `本地工作区数据无效` and starts empty
- a rejected load shows `本地工作区恢复失败`

- [ ] **Step 3: Extend Workbench state and hydrate**

Extend props:

```ts
interface WorkbenchProps {
  idFactory?: () => string
  storage?: WorkspaceStorage
}
```

Default to a singleton created with `createWorkspaceStorage()`. Add:

```ts
const [hydrationStatus, setHydrationStatus] =
  useState<'loading' | 'ready'>('loading')
const [storageError, setStorageError] = useState('')
```

On mount, load once. After parsing:

- set `overlayWorkspaceRef.current` before state
- restore cards with zeroed playback keys and no selection
- restore parameters, activeId, and showSafeArea
- create a Blob URL for the stored video
- mark the video preview as `restored: true`
- enter `ready` in `finally`

Use an effect-local `cancelled` flag to prevent state writes after unmount.

- [ ] **Step 4: Write autosave RED tests**

Use fake timers and assert:

- no save at 299ms
- one save at 300ms
- repeated parameter/position changes within the window produce the latest snapshot
- JSON import and Delete update the saved cards
- write rejection displays `本地保存失败，刷新后可能无法恢复`
- a later successful write clears the stale save error

- [ ] **Step 5: Implement autosave**

Create one queue:

```ts
const saveQueueRef = useRef(
  createLatestWriteQueue((snapshot: PersistedWorkspaceV1) =>
    storage.saveWorkspace(snapshot),
  ),
)
```

Recreate/dispose it if the injected `storage` changes. Build the snapshot from
current React state and video metadata with a pure `createPersistedWorkspace`
helper. Schedule only when `hydrationStatus === 'ready'`; clear the timeout on
dependency changes and unmount.

- [ ] **Step 6: Add restored-video playback RED tests**

In `PreviewStage.test.tsx`, verify:

```tsx
<PreviewStage videoUrl="blob:restored" restoredVideo ... />
```

renders a muted video without `autoplay`, and loaded metadata keeps
`currentTime === 0` and calls `pause()`. The existing new-import path must retain
`autoplay`.

- [ ] **Step 7: Implement restored playback policy**

Extend `VideoPreview` with `restored: boolean` and `PreviewStageProps` with
`restoredVideo?: boolean`. Render:

```tsx
autoPlay={!restoredVideo}
```

On loaded metadata for restored video:

```ts
event.currentTarget.currentTime = 0
event.currentTarget.muted = true
event.currentTarget.pause()
```

Then report duration and time through existing callbacks.

- [ ] **Step 8: Persist video lifecycle**

Keep the source `File` on a pending video record until validation succeeds.
After `confirmVideo`, call `storage.commitVideo(videoRecord, snapshotWithVideo)`.
Do not replace the saved video if the probe rejects.

For restored active-video failure, delete the saved asset through
`storage.removeVideo(snapshotWithoutVideo)`. Existing “移除视频” uses the same
transaction and leaves cards/parameters intact.

- [ ] **Step 9: Verify and commit**

Run:

```powershell
npm test -- --run src/components/Workbench.test.tsx src/components/PreviewStage.test.tsx src/persistence
npm run lint
npm run build
git diff --check
```

Commit:

```powershell
git add src/components/Workbench.tsx src/components/Workbench.test.tsx src/components/PreviewStage.tsx src/components/PreviewStage.test.tsx
git commit -m "feat: restore the local overlay workspace"
```

### Task 5: Confirmed Full Workspace Clear

**Files:**
- Create: `src/components/ClearWorkspaceDialog.tsx`
- Create: `src/components/ClearWorkspaceDialog.test.tsx`
- Modify: `src/components/ProjectFileControls.tsx`
- Modify: `src/components/ProjectFileControls.test.tsx`
- Modify: `src/components/ParameterPanel.tsx`
- Modify: `src/components/ParameterPanel.test.tsx`
- Modify: `src/components/Workbench.tsx`
- Modify: `src/components/Workbench.test.tsx`

- [ ] **Step 1: Write dialog RED tests**

Test the controlled contract:

```ts
interface ClearWorkspaceDialogProps {
  open: boolean
  busy?: boolean
  returnFocusRef: React.RefObject<HTMLButtonElement | null>
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}
```

Assert:

- `role="alertdialog"` and `aria-modal="true"`
- title `清空工作区？`
- consequences mention video and all effects
- cancel receives initial focus
- `Escape` calls `onCancel`
- confirm calls `onConfirm` once and disables both actions while busy
- closing returns focus to the trigger passed through `returnFocusRef`

- [ ] **Step 2: Run and confirm RED**

Run:

```powershell
npm test -- --run src/components/ClearWorkspaceDialog.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the dialog**

Render the dialog through normal React markup at the end of
`ProjectFileControls`; the existing app has no portal requirement. Use a fixed
backdrop, focus the cancel button in an effect, listen for Escape only while
open, and return focus on close.

- [ ] **Step 4: Wire the clear trigger**

Extend:

```ts
interface ProjectFileControlsProps {
  project: OverlayProject
  error?: string
  onImport: (text: string) => void | Promise<void>
  onClearWorkspace?: () => void | Promise<void>
  clearing?: boolean
}
```

Add a `清空工作区` button in the project-file section. The trigger opens the
dialog; confirm awaits `onClearWorkspace`. Keep the dialog open and show the
parent error when clearing rejects.

Thread the props through `ParameterPanel`.

- [ ] **Step 5: Write Workbench clear RED tests**

Start with stored video, changed legacy parameters, cards, active motion, and a
hidden safe area. Test:

- cancel and Escape preserve everything and never call `storage.clear`
- confirm calls `storage.clear`
- after success the video and clips disappear
- default metric parameters and safe-area setting return
- selection/project/storage errors clear
- all active and pending Blob URLs are revoked
- if `storage.clear` rejects, current UI remains and `清空本地数据失败` appears

- [ ] **Step 6: Implement atomic UI reset**

Add `clearWorkspace` in `Workbench`:

```ts
setClearing(true)
try {
  await storage.clear()
  revokeAllVideoUrls()
  overlayWorkspaceRef.current = createOverlayWorkspaceState()
  setOverlayWorkspace(createOverlayWorkspaceState())
  setParameters(createInitialParameters())
  setActiveId('metric-focus')
  setShowSafeArea(true)
  setVideoPreview(null)
  setPendingVideo(null)
  setVideoTime(0)
  setVideoDuration(0)
  setVideoError('')
  setProjectError('')
  setStorageError('')
} catch {
  setStorageError('清空本地数据失败')
} finally {
  setClearing(false)
}
```

Suppress autosave while clearing so the empty snapshot is not written before
the clear transaction finishes.

- [ ] **Step 7: Verify and commit**

Run:

```powershell
npm test -- --run src/components/ClearWorkspaceDialog.test.tsx src/components/ProjectFileControls.test.tsx src/components/ParameterPanel.test.tsx src/components/Workbench.test.tsx
npm run lint
npm run build
git diff --check
```

Commit:

```powershell
git add src/components/ClearWorkspaceDialog.tsx src/components/ClearWorkspaceDialog.test.tsx src/components/ProjectFileControls.tsx src/components/ProjectFileControls.test.tsx src/components/ParameterPanel.tsx src/components/ParameterPanel.test.tsx src/components/Workbench.tsx src/components/Workbench.test.tsx
git commit -m "feat: add confirmed workspace reset"
```

### Task 6: Pencil-Studio Styling And Status Feedback

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/Workbench.test.tsx`

- [ ] **Step 1: Add semantic UI assertions**

Verify the restoring indicator is a polite status, persistence errors are
alerts, the clear trigger has a unique accessible name, and dialog controls are
reachable in DOM order. Avoid pixel or color snapshot tests.

- [ ] **Step 2: Run and confirm RED where markup is missing**

Run:

```powershell
npm test -- --run src/components/Workbench.test.tsx src/components/ClearWorkspaceDialog.test.tsx
```

Expected: restoring/status assertions fail before the final markup is added.

- [ ] **Step 3: Add focused styles**

Use existing variables and the dark graphite/pencil visual language:

- compact destructive `清空工作区` button with muted red-brown only on hover/focus
- fixed charcoal modal backdrop without a large shadow
- off-white hand-drawn dialog border
- clear focus-visible outlines
- `prefers-reduced-motion` disables dialog entrance motion
- persistence status/error stays within the project-file block without changing panel width
- at narrow breakpoints, dialog width is `min(420px, calc(100vw - 32px))`

- [ ] **Step 4: Verify and commit**

Run:

```powershell
npm test -- --run
npm run lint
npm run build
git diff --check
```

Commit:

```powershell
git add src/styles.css src/components/Workbench.test.tsx
git commit -m "style: add local workspace recovery states"
```

### Task 7: Final Refresh And Browser Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-07-26-workspace-persistence-shortcuts.md`

- [ ] **Step 1: Run complete automated verification**

Run:

```powershell
npm test -- --run
npm run lint
npm run build
git diff --check 0742fd6..HEAD
git status --short
```

Expected: every command passes and the worktree is clean.

- [ ] **Step 2: Verify the localhost service**

Start or reuse Vite:

```powershell
npm run dev -- --host 127.0.0.1 --port 4173
```

Verify:

```powershell
(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4173/).StatusCode
```

Expected: `200`.

- [ ] **Step 3: Verify shortcuts in a real browser**

1. Import a local video and pause at a non-zero position.
2. Double-click one component body.
3. Confirm exactly one clip starts at the current playhead.
4. Select the clip and press `Delete`.
5. Confirm it disappears.
6. Focus a parameter input, press `Delete`, and confirm the selected clip remains.

- [ ] **Step 4: Verify persistence across refresh**

1. Import a video.
2. Add two cards, change parameters, move one card, and hide the safe area.
3. Reload the page.
4. Confirm video, cards, params, positions, active component, and safe-area setting restore.
5. Confirm the video is at 0 seconds, paused, and muted.
6. Confirm the browser console has no errors.

- [ ] **Step 5: Verify confirmed clear**

1. Click `清空工作区`, then cancel; confirm state remains.
2. Open again and press `Escape`; confirm state remains.
3. Open again and confirm.
4. Confirm video, cards, custom parameters, and local database state are removed.
5. Reload and confirm the initial workspace remains empty.

- [ ] **Step 6: Request final independent review**

Review the full diff from `0742fd6..HEAD` against:

```text
docs/superpowers/specs/2026-07-26-workspace-persistence-shortcuts-design.md
```

Fix every Critical and Important finding and rerun Step 1.

- [ ] **Step 7: Mark this plan complete and commit**

Change completed checkboxes in this file to `[x]`, then run:

```powershell
git add docs/superpowers/plans/2026-07-26-workspace-persistence-shortcuts.md
git commit -m "docs: complete local workspace recovery plan"
```
