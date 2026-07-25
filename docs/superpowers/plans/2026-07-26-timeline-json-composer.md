# Timeline JSON Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight video-synchronized card timeline with draggable canvas positions and validated JSON import/export.

**Architecture:** Pure timeline/project functions own validation, timing, active-card selection, and serialization. `Workbench` owns project state and selection; `TimelineEditor`, `PreviewStage`, and `ParameterPanel` receive controlled values and callbacks so the existing stable video element remains intact.

**Tech Stack:** React, TypeScript, Vite, native pointer/drag events, browser File/Blob APIs, Vitest, React Testing Library.

---

### Task 1: Add the project model and pure timeline operations

**Files:**
- Create: `src/timeline/types.ts`
- Create: `src/timeline/project.ts`
- Create: `src/timeline/project.test.ts`

- [ ] **Step 1: Write failing tests for card creation, timing, active cards, and JSON validation**

Cover these exact behaviors:

```ts
expect(createOverlayCard('metric-focus', 4, 10, 1, defaults)).toMatchObject({
  motionId: 'metric-focus',
  start: 4,
  end: 7,
  position: { x: 0, y: 0 },
  zIndex: 1,
  params: defaults,
})

expect(getActiveCards(cards, 5).map((card) => card.id)).toEqual(['a', 'b'])
expect(moveCardTiming(card, -2, 10)).toMatchObject({ start: 0, end: 3 })
expect(resizeCardTiming(card, 'end', 20, 10).end).toBe(10)
expect(parseOverlayProject(JSON.stringify(validProject), defaultsByMotion))
  .toEqual(validProject)
expect(() => parseOverlayProject('{"version":2}', defaultsByMotion))
  .toThrow('JSON 项目格式无效')
```

- [ ] **Step 2: Run the model test and confirm RED**

Run:

```bash
npm test -- --run src/timeline/project.test.ts
```

Expected: FAIL because the timeline modules do not exist.

- [ ] **Step 3: Define the model**

```ts
export interface OverlayPosition {
  x: number
  y: number
}

export interface OverlayCard {
  id: string
  motionId: MotionId
  start: number
  end: number
  position: OverlayPosition
  zIndex: number
  params: ParameterValues
}

export interface OverlayProject {
  version: 1
  canvas: { width: 1920; height: 1080 }
  cards: OverlayCard[]
}
```

- [ ] **Step 4: Implement pure operations**

Implement:

```ts
export const MIN_CARD_DURATION = 0.2
export const DEFAULT_CARD_DURATION = 3

export function createOverlayCard(
  motionId: MotionId,
  start: number,
  videoDuration: number,
  zIndex: number,
  defaults: ParameterValues,
): OverlayCard

export function getActiveCards(
  cards: OverlayCard[],
  currentTime: number,
): OverlayCard[]

export function moveCardTiming(
  card: OverlayCard,
  nextStart: number,
  videoDuration: number,
): OverlayCard

export function resizeCardTiming(
  card: OverlayCard,
  edge: 'start' | 'end',
  time: number,
  videoDuration: number,
): OverlayCard

export function updateCardPosition(
  card: OverlayCard,
  position: OverlayPosition,
): OverlayCard
```

Clamp times to the known video duration, preserve clip duration while moving,
and sort active cards by `zIndex`.

- [ ] **Step 5: Implement validated JSON parsing**

`parseOverlayProject(text, defaultsByMotion)` must:

- Require `version === 1`.
- Require the 1920×1080 canvas object.
- Require an array of cards.
- Reject unknown `motionId` values.
- Require finite `start`, `end`, `x`, `y`, and `zIndex`.
- Require `end > start`.
- Clamp positions to `0–100`.
- Merge imported params onto registered component defaults.
- Throw `new Error('JSON 项目格式无效')` for any invalid structure.

- [ ] **Step 6: Run the model tests and confirm GREEN**

Run:

```bash
npm test -- --run src/timeline/project.test.ts
```

Expected: PASS.

### Task 2: Make the component rail a timeline drag source

**Files:**
- Modify: `src/components/ComponentRail.tsx`
- Modify: `src/components/Workbench.test.tsx`

- [ ] **Step 1: Add a failing drag-source test**

Render the workbench, start dragging the “核心指标” rail item, and assert:

```tsx
expect(dataTransfer.setData).toHaveBeenCalledWith(
  'application/x-overlay-motion',
  'metric-focus',
)
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
npm test -- --run src/components/Workbench.test.tsx
```

Expected: FAIL because rail buttons are not draggable.

- [ ] **Step 3: Add drag metadata without changing click behavior**

Each rail item becomes:

```tsx
<button
  draggable
  onDragStart={(event) => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(
      'application/x-overlay-motion',
      definition.id,
    )
  }}
/>
```

Keep existing selection and accessibility behavior.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```bash
npm test -- --run src/components/Workbench.test.tsx
```

Expected: PASS.

### Task 3: Build the controlled timeline editor

**Files:**
- Create: `src/components/TimelineEditor.tsx`
- Create: `src/components/TimelineEditor.test.tsx`

- [ ] **Step 1: Write failing tests for drop, selection, movement, resizing, and seeking**

Use a timeline with `duration={10}` and a 1000-pixel mocked bounding rectangle.
Verify:

```tsx
fireEvent.drop(timeline, {
  clientX: 400,
  dataTransfer: { getData: () => 'metric-focus' },
})
expect(onDropMotion).toHaveBeenCalledWith('metric-focus', 4)

fireEvent.click(screen.getByRole('button', { name: /核心指标/ }))
expect(onSelectCard).toHaveBeenCalledWith('card-1')

fireEvent.pointerDown(clip, { clientX: 200 })
fireEvent.pointerMove(clip, { clientX: 300 })
fireEvent.pointerUp(clip)
expect(onMoveCard).toHaveBeenCalledWith('card-1', 3)

fireEvent.pointerDown(screen.getByLabelText('调整结束时间'), { clientX: 400 })
fireEvent.pointerMove(screen.getByLabelText('调整结束时间'), { clientX: 500 })
fireEvent.pointerUp(screen.getByLabelText('调整结束时间'))
expect(onResizeCard).toHaveBeenCalledWith('card-1', 'end', 5)
```

- [ ] **Step 2: Run the timeline tests and confirm RED**

Run:

```bash
npm test -- --run src/components/TimelineEditor.test.tsx
```

Expected: FAIL because `TimelineEditor` does not exist.

- [ ] **Step 3: Define the component contract**

```ts
interface TimelineEditorProps {
  cards: OverlayCard[]
  duration: number
  currentTime: number
  selectedCardId?: string
  motionNames: Record<MotionId, string>
  onDropMotion: (motionId: MotionId, time: number) => void
  onSelectCard: (cardId: string) => void
  onMoveCard: (cardId: string, start: number) => void
  onResizeCard: (
    cardId: string,
    edge: 'start' | 'end',
    time: number,
  ) => void
  onSeek: (time: number) => void
  onDeleteCard: (cardId: string) => void
}
```

- [ ] **Step 4: Implement drop and time conversion**

Use:

```ts
const pointToTime = (clientX: number) => {
  const rect = trackRef.current?.getBoundingClientRect()
  if (!rect || duration <= 0) return 0
  const ratio = (clientX - rect.left) / rect.width
  return Math.min(duration, Math.max(0, ratio * duration))
}
```

Reject drops when no video duration exists and show “请先导入视频”.

- [ ] **Step 5: Implement clip pointer interactions**

Store `{ mode, cardId, startClientX }` in a ref on pointer down. On pointer move,
convert the current pointer to an absolute time and call the matching controlled
callback. Keep clip buttons accessible and add named left/right resize handles.

- [ ] **Step 6: Implement playhead and deletion**

Clicking the empty track calls `onSeek(pointToTime(clientX))`. Render the
playhead at `(currentTime / duration) * 100%`. A selected clip exposes a
“删除卡片” button.

- [ ] **Step 7: Run the timeline tests and confirm GREEN**

Run:

```bash
npm test -- --run src/components/TimelineEditor.test.tsx
```

Expected: PASS.

### Task 4: Synchronize cards with the stable video preview

**Files:**
- Modify: `src/components/PreviewStage.tsx`
- Modify: `src/components/Workbench.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add failing playback visibility and position tests**

Import a video, create two cards, and dispatch `timeUpdate` at different times.
Verify only matching card content is visible. Select one card, fire pointer
events on its overlay, and expect a percentage position callback.

- [ ] **Step 2: Extend the preview contract**

Add:

```ts
overlayCards?: OverlayCard[]
selectedCardId?: string
onVideoTimeChange?: (time: number) => void
onVideoDurationChange?: (duration: number) => void
onSeekReady?: (seek: (time: number) => void) => void
onCardPositionChange?: (
  cardId: string,
  position: OverlayPosition,
) => void
```

- [ ] **Step 3: Report media time without moving video ownership**

In the existing media handlers, preserve playback state and additionally call
the time/duration callbacks with finite values. Expose a seek callback that
clamps to the current video duration and writes `video.currentTime`.

- [ ] **Step 4: Render active cards**

When `overlayCards.length > 0`, replace the single preview motion with:

```tsx
getActiveCards(overlayCards, currentPlaybackState.currentTime).map((card) => (
  <div
    className="timeline-overlay-card"
    data-card-id={card.id}
    style={{
      zIndex: 2 + card.zIndex,
      transform: `translate(${card.position.x}%, ${card.position.y}%)`,
    }}
  >
    {renderMotion(card.motionId, card.params)}
  </div>
))
```

When no project cards exist, preserve the current component preview.

- [ ] **Step 5: Implement selected-card canvas dragging**

Track pointer start coordinates and initial percentages. Convert pixel deltas
using the canvas rectangle:

```ts
const nextX = start.x + (deltaX / rect.width) * 100
const nextY = start.y + (deltaY / rect.height) * 100
```

Clamp through `updateCardPosition` and call `onCardPositionChange`.

- [ ] **Step 6: Run Workbench tests and confirm GREEN**

Run:

```bash
npm test -- --run src/components/Workbench.test.tsx
```

Expected: PASS, including all existing video playback tests.

### Task 5: Integrate timeline state and per-card editing

**Files:**
- Modify: `src/components/Workbench.tsx`
- Modify: `src/components/ParameterPanel.tsx`
- Modify: `src/components/Workbench.test.tsx`

- [ ] **Step 1: Add failing integration tests**

Verify:

- Dropping a motion creates a card at the requested time with a three-second
  duration.
- Selecting a clip switches the parameter panel to that card.
- Editing a parameter changes only the selected card.
- Moving/resizing/deleting uses the pure project functions.
- Video time changes determine preview visibility.

- [ ] **Step 2: Add project state**

Add:

```ts
const [cards, setCards] = useState<OverlayCard[]>([])
const [selectedCardId, setSelectedCardId] = useState<string>()
const [videoTime, setVideoTime] = useState(0)
const [videoDuration, setVideoDuration] = useState(0)
const seekVideoRef = useRef<(time: number) => void>(() => undefined)
```

- [ ] **Step 3: Create and select cards**

Use `getMotionDefinition(motionId).defaults`, the next `zIndex`, and
`createOverlayCard`. Generate IDs with `crypto.randomUUID()` when available and
a timestamp/counter fallback in tests.

- [ ] **Step 4: Route parameter editing**

When a card is selected:

- `activeDefinition` comes from `selectedCard.motionId`.
- `activeParameters` comes from `selectedCard.params`.
- `updateParameter` updates only that card.
- `resetParameters` replaces only that card's params with registered defaults.

When no card is selected, preserve the current playground parameter behavior.

- [ ] **Step 5: Connect timeline and preview**

Pass controlled project state to `TimelineEditor` and `PreviewStage`. Store the
preview seek callback in `seekVideoRef` and call it from timeline clicks.

- [ ] **Step 6: Run Workbench tests and confirm GREEN**

Run:

```bash
npm test -- --run src/components/Workbench.test.tsx
```

Expected: PASS.

### Task 6: Add JSON import and export controls

**Files:**
- Create: `src/components/ProjectFileControls.tsx`
- Create: `src/components/ProjectFileControls.test.tsx`
- Modify: `src/components/ParameterPanel.tsx`
- Modify: `src/components/Workbench.tsx`

- [ ] **Step 1: Write failing import/export tests**

Mock `URL.createObjectURL`, `URL.revokeObjectURL`, and `HTMLAnchorElement.click`.
Verify export creates a JSON Blob and downloads
`overlay-studio-project.json`. Verify valid import replaces cards and invalid
import reports `JSON 项目格式无效` without replacing cards.

- [ ] **Step 2: Implement the file control contract**

```ts
interface ProjectFileControlsProps {
  project: OverlayProject
  error?: string
  onImport: (text: string) => void
}
```

Export with:

```ts
const blob = new Blob([JSON.stringify(project, null, 2)], {
  type: 'application/json;charset=utf-8',
})
const url = URL.createObjectURL(blob)
const anchor = document.createElement('a')
anchor.href = url
anchor.download = 'overlay-studio-project.json'
anchor.click()
URL.revokeObjectURL(url)
```

Import uses `file.text()` and resets the file input value after selection.

- [ ] **Step 3: Place controls in the parameter panel**

Add a compact “项目文件” block above video import with “导入 JSON” and
“导出 JSON” buttons plus an alert area for Chinese errors.

- [ ] **Step 4: Parse before replacing state**

`Workbench` builds defaults by motion ID, calls `parseOverlayProject`, and only
then replaces `cards`. Keep the current local video and clear selection/error on
success.

- [ ] **Step 5: Run file and Workbench tests**

Run:

```bash
npm test -- --run src/components/ProjectFileControls.test.tsx src/components/Workbench.test.tsx
```

Expected: PASS.

### Task 7: Style and verify the complete editor

**Files:**
- Modify: `src/styles.css`
- Modify: `docs/superpowers/plans/2026-07-26-timeline-json-composer.md`

- [ ] **Step 1: Add timeline layout**

Change the center preview column to reserve a compact timeline below the canvas.
Style the ruler, clip lane, playhead, selected clip, resize handles, delete
button, and empty state using the existing black/white/grey visual language.

- [ ] **Step 2: Add draggable overlay affordances**

Selected overlay cards receive a thin editor outline and `cursor: move`.
Non-selected cards remain visually identical to the existing motion preview.

- [ ] **Step 3: Run complete automated verification**

```bash
npm test -- --run
npm run lint
npm run build
git diff --check
```

Expected: all tests pass, lint has no errors, Vite build succeeds, and diff
check has no output.

- [ ] **Step 4: Validate in a real browser**

- Import a local video.
- Drag a component to the timeline.
- Confirm the card appears only during its three-second interval.
- Move and resize the timeline clip.
- Drag the card inside the canvas.
- Export JSON.
- Clear or alter project state, then import JSON and verify restoration.
- Confirm sound, pause, progress, safety areas, and existing motion editing still
  work.

- [ ] **Step 5: Request independent code review**

Review timing clamps, pointer-event cleanup, stable video identity, JSON
validation, Blob URL cleanup, accessibility, and regression coverage.

- [ ] **Step 6: Commit**

```bash
git add src/timeline src/components src/styles.css \
  docs/superpowers/plans/2026-07-26-timeline-json-composer.md
git commit -m "feat: add timeline JSON composer"
```
