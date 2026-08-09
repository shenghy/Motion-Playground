# Timeline Motion Tag Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give all eight registered motion cards a fixed, distinct label color that appears only on timeline clips.

**Architecture:** Add `timelineColor` to the motion registry as the single source of truth. `Workbench` derives a `MotionId -> color` map and passes it to `TimelineEditor`, which applies the value through a local CSS custom property while leaving `OverlayCard`, project JSON, preview rendering, and video export unchanged.

**Tech Stack:** React 19, TypeScript, CSS custom properties, Vitest, React Testing Library, Vite

---

## File Structure

- Modify `src/motion/types.ts`: require every `MotionDefinition` to declare its timeline-only color.
- Modify `src/motion/registry.ts`: assign the approved fixed color to each of the eight motions.
- Create `src/motion/registry.test.ts`: lock the exact palette, format, uniqueness, and eight-motion coverage.
- Modify `src/components/TimelineEditor.tsx`: accept the color map and expose each card color through `--timeline-card-color`.
- Modify `src/components/TimelineEditor.test.tsx`: cover registered colors, missing-color fallback, sizing, and selection behavior.
- Modify `src/components/Workbench.tsx`: derive `MOTION_COLORS` from `motionRegistry` and pass it into the timeline.
- Modify `src/components/Workbench.test.tsx`: verify an imported motion receives its registry color through the real workbench path.
- Modify `src/styles.css`: render the colored left strip, border, and restrained tinted background while preserving selected and focus states.

Because `src/motion/types.ts`, `src/motion/registry.ts`, and `src/styles.css` already contain unrelated uncommitted work, implementation must not stage or commit whole files automatically. Review the final diff and keep the feature changes uncommitted unless the user separately authorizes a combined commit.

### Task 1: Make the registry the palette source of truth

**Files:**
- Create: `src/motion/registry.test.ts`
- Modify: `src/motion/types.ts:172-182`
- Modify: `src/motion/registry.ts:40-357`

- [ ] **Step 1: Write the failing registry contract test**

Create `src/motion/registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { motionRegistry } from './registry'

const expectedColors = {
  narrative: '#8B7BD8',
  'metric-focus': '#4D8FD8',
  'compare-split': '#D39A43',
  'profile-reveal': '#C86D91',
  'bar-compare': '#4FA878',
  'share-ring': '#3AA6AD',
  'step-flow': '#CA7045',
  'audience-poll': '#91A84F',
}

describe('motion registry timeline colors', () => {
  it('assigns the approved unique color to every registered motion', () => {
    const actualColors = Object.fromEntries(
      motionRegistry.map(({ id, timelineColor }) => [id, timelineColor]),
    )
    const colors = Object.values(actualColors)

    expect(actualColors).toEqual(expectedColors)
    expect(colors).toHaveLength(8)
    expect(new Set(colors).size).toBe(8)
    expect(colors.every((color) => /^#[0-9A-F]{6}$/.test(color))).toBe(true)
  })
})
```

- [ ] **Step 2: Run the registry test and verify RED**

Run:

```powershell
npm test -- --run src/motion/registry.test.ts
```

Expected: FAIL because `timelineColor` does not exist on `MotionDefinition` or registered motions.

- [ ] **Step 3: Add the required registry field**

Update `MotionDefinition` in `src/motion/types.ts`:

```ts
export interface MotionDefinition<T extends ParameterValues = ParameterValues> {
  id: MotionId
  index: string
  name: string
  category: string
  description: string
  timelineColor: `#${string}`
  defaults: T
  controls: Control[]
  component: ComponentType<MotionComponentProps<T>>
  canvasRenderer: CanvasMotionRenderer<T>
}
```

Add one field beside the metadata of each definition in `src/motion/registry.ts`:

```ts
// narrative
timelineColor: '#8B7BD8',

// metric-focus
timelineColor: '#4D8FD8',

// compare-split
timelineColor: '#D39A43',

// profile-reveal
timelineColor: '#C86D91',

// bar-compare
timelineColor: '#4FA878',

// share-ring
timelineColor: '#3AA6AD',

// step-flow
timelineColor: '#CA7045',

// audience-poll
timelineColor: '#91A84F',
```

- [ ] **Step 4: Run the registry test and verify GREEN**

Run:

```powershell
npm test -- --run src/motion/registry.test.ts
```

Expected: 1 test file passes and all eight exact colors are covered.

- [ ] **Step 5: Check registry/type scope without committing dirty files**

Run:

```powershell
git diff --check -- src/motion/types.ts src/motion/registry.ts src/motion/registry.test.ts
git diff -- src/motion/types.ts src/motion/registry.ts src/motion/registry.test.ts
```

Expected: no whitespace errors; the reviewed diff contains the new type field, eight values, and the contract test. Do not stage these files because they contain or overlap earlier uncommitted work.

### Task 2: Render color safely inside TimelineEditor

**Files:**
- Modify: `src/components/TimelineEditor.tsx:1-260`
- Modify: `src/components/TimelineEditor.test.tsx:1-330`
- Modify: `src/styles.css:398-505`

- [ ] **Step 1: Add failing registered-color and fallback tests**

Extend the default props in `src/components/TimelineEditor.test.tsx`:

```ts
const motionColors = {
  'metric-focus': '#4D8FD8',
  'compare-split': '#D39A43',
}

function createProps(
  overrides: Partial<React.ComponentProps<typeof TimelineEditor>> = {},
) {
  return {
    cards,
    duration: 10,
    currentTime: 4,
    selectedCardId: null,
    motionNames,
    motionColors,
    onDropMotion: vi.fn(),
    onSelectCard: vi.fn(),
    onMoveCard: vi.fn(),
    onResizeCard: vi.fn(),
    onSeek: vi.fn(),
    onDeleteCard: vi.fn(),
    ...overrides,
  }
}
```

Add the tests:

```ts
it('sets each timeline card color without changing its timing geometry', () => {
  render(<TimelineEditor {...createProps()} />)

  const metricCard = screen.getByRole('button', {
    name: /选择核心指标片段/,
  }).parentElement
  const compareCard = screen.getByRole('button', {
    name: /选择compare-split片段/,
  }).parentElement

  expect(metricCard).toHaveStyle({
    left: '10%',
    width: '20%',
    '--timeline-card-color': '#4D8FD8',
  })
  expect(compareCard).toHaveStyle({
    left: '50%',
    width: '30%',
    '--timeline-card-color': '#D39A43',
  })
})

it('uses neutral gray when a motion color is unavailable', () => {
  render(<TimelineEditor {...createProps({ motionColors: {} })} />)

  expect(screen.getByRole('button', {
    name: /选择核心指标片段/,
  }).parentElement).toHaveStyle({
    '--timeline-card-color': '#777A7D',
  })
})
```

- [ ] **Step 2: Run TimelineEditor tests and verify RED**

Run:

```powershell
npm test -- --run src/components/TimelineEditor.test.tsx
```

Expected: FAIL because `motionColors` is not a prop and the CSS variable is absent.

- [ ] **Step 3: Add the color-map prop and local CSS variable**

Update imports and props in `src/components/TimelineEditor.tsx`:

```ts
import type { CSSProperties } from 'react'
import { useRef } from 'react'

const FALLBACK_TIMELINE_COLOR = '#777A7D'

interface TimelineEditorProps {
  cards: OverlayCard[]
  duration: number
  currentTime: number
  selectedCardId: string | null
  motionNames: Partial<Record<MotionId, string>>
  motionColors: Partial<Record<MotionId, string>>
  onDropMotion: (motionId: MotionId, startTime: number) => void
  onSelectCard: (cardId: string) => void
  onMoveCard: (cardId: string, startTime: number) => void
  onResizeCard: (
    cardId: string,
    edge: 'start' | 'end',
    time: number,
  ) => void
  onSeek: (time: number) => void
  onDeleteCard: (cardId: string) => void
}
```

Destructure `motionColors`. Replace the card wrapper style with:

```tsx
style={{
  left: `${left}%`,
  width: `${Math.max(0, right - left)}%`,
  '--timeline-card-color': motionColors[card.motionId]
    ?? FALLBACK_TIMELINE_COLOR,
} as CSSProperties}
```

Do not add color to `OverlayCard`, card params, or callbacks.

- [ ] **Step 4: Apply the restrained timeline-only treatment**

Update the non-selected card rules in `src/styles.css`:

```css
.timeline-editor__card-body {
  position: absolute;
  inset: 0 7px;
  min-width: 0;
  overflow: hidden;
  border: 2px solid var(--timeline-card-color, #777a7d);
  border-radius: 2px 0 3px 1px;
  color: var(--paper);
  background:
    repeating-linear-gradient(
      -9deg,
      transparent 0 8px,
      rgba(236, 236, 231, .035) 9px
    ),
    color-mix(
      in srgb,
      var(--timeline-card-color, #777a7d) 18%,
      #17191b
    );
  box-shadow: 1px 1px 0 rgba(236, 236, 231, .15);
  cursor: grab;
}

.timeline-editor__card-body::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--timeline-card-color, #777a7d);
}
```

Keep `.timeline-editor__card--selected .timeline-editor__card-body`, handle colors, focus outlines, labels, and the playhead unchanged. The left strip remains visible in selected state because it is provided by the base pseudo-element.

- [ ] **Step 5: Run TimelineEditor tests and verify GREEN**

Run:

```powershell
npm test -- --run src/components/TimelineEditor.test.tsx
```

Expected: all timeline interaction tests pass, including color, fallback, geometry, selection, move, resize, seek, and delete behavior.

- [ ] **Step 6: Check component/style scope without committing dirty files**

Run:

```powershell
git diff --check -- src/components/TimelineEditor.tsx src/components/TimelineEditor.test.tsx src/styles.css
git diff -- src/components/TimelineEditor.tsx src/components/TimelineEditor.test.tsx src/styles.css
```

Expected: no whitespace errors and no changes to playback, export, card timing, or project data. Do not stage `src/styles.css` because it contains earlier uncommitted design work.

### Task 3: Wire registry colors through Workbench

**Files:**
- Modify: `src/components/Workbench.tsx:72-78,1305-1317`
- Modify: `src/components/Workbench.test.tsx:1469-1534`

- [ ] **Step 1: Add a failing workbench integration assertion**

In the existing test `atomically imports a valid project without replacing or resetting the video`, capture the imported timeline card button after the `waitFor` block and add:

```ts
const importedTimelineCard = screen.getByRole('button', {
  name: /选择对比卡片片段/,
}).parentElement

expect(importedTimelineCard).toHaveStyle({
  '--timeline-card-color': '#D39A43',
})
```

Use the current Chinese accessible name already present in that test if the source text differs because of encoding; do not alter user-facing copy.

- [ ] **Step 2: Run the integration test and verify RED**

Run:

```powershell
npm test -- --run src/components/Workbench.test.tsx -t "atomically imports a valid project"
```

Expected: FAIL because the real `Workbench` has not passed the registry color map to `TimelineEditor`.

- [ ] **Step 3: Derive and pass the registry color map**

Add next to `MOTION_NAMES` in `src/components/Workbench.tsx`:

```ts
const MOTION_COLORS = Object.fromEntries(
  motionRegistry.map((definition) => [
    definition.id,
    definition.timelineColor,
  ]),
) as Record<MotionId, string>
```

Pass it to the existing timeline component:

```tsx
<TimelineEditor
  cards={cards}
  duration={videoDuration}
  currentTime={videoTime}
  selectedCardId={selectedCardId}
  motionNames={MOTION_NAMES}
  motionColors={MOTION_COLORS}
  onDropMotion={dropMotion}
  onSelectCard={selectCard}
  onMoveCard={moveCard}
  onResizeCard={resizeCard}
  onSeek={(time) => seekControllerRef.current?.(time)}
  onDeleteCard={deleteCard}
/>
```

- [ ] **Step 4: Run workbench and project-file tests and verify GREEN**

Run:

```powershell
npm test -- --run src/components/Workbench.test.tsx src/components/ProjectFileControls.test.tsx
```

Expected: all tests pass; the imported card gets `#D39A43`, and the existing exact JSON export assertions still pass without any `timelineColor` field.

- [ ] **Step 5: Check Workbench scope**

Run:

```powershell
git diff --check -- src/components/Workbench.tsx src/components/Workbench.test.tsx
git diff -- src/components/Workbench.tsx src/components/Workbench.test.tsx
```

Expected: only the derived map, prop wiring, and integration assertion are added.

### Task 4: Verify behavior, compatibility, and the visual result

**Files:**
- Verify: `src/motion/registry.test.ts`
- Verify: `src/components/TimelineEditor.test.tsx`
- Verify: `src/components/Workbench.test.tsx`
- Verify: `src/components/ProjectFileControls.test.tsx`
- Verify: `src/styles.css`

- [ ] **Step 1: Run all feature-focused tests**

Run:

```powershell
npm test -- --run src/motion/registry.test.ts src/components/TimelineEditor.test.tsx src/components/Workbench.test.tsx src/components/ProjectFileControls.test.tsx
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 2: Run the complete verification suite**

Run:

```powershell
npm test -- --run
npm run lint
npm run build
git diff --check
```

Expected: the full Vitest suite passes, ESLint exits 0, TypeScript/Vite build exits 0, and Git reports no whitespace errors. The existing Vite large-chunk advisory may remain; it is unrelated to this feature.

- [ ] **Step 3: Verify project JSON stays unchanged**

Export a project through the existing UI and inspect the downloaded JSON. Confirm every card still contains only the established fields:

```json
{
  "id": "card-id",
  "motionId": "metric-focus",
  "start": 0,
  "end": 3,
  "position": { "x": 0, "y": 0 },
  "zIndex": 0,
  "params": {}
}
```

Expected: no `timelineColor`, `tagColor`, or palette field appears anywhere in the project file.

- [ ] **Step 4: Perform browser visual verification**

Open the local workbench, load a video, and place all eight motions on the timeline. Verify:

```text
1. Each motion uses the approved A-palette color.
2. Narrow clips still show at least the 4px colored left strip.
3. Selected cards retain the warm high-contrast selected border.
4. Handles, labels, playhead, move, resize, seek, and delete remain usable.
5. No color appears inside the preview canvas or exported video.
```

Expected: eight motions are distinguishable at a glance without making the timeline visually noisy.

- [ ] **Step 5: Review the final working tree without committing unrelated changes**

Run:

```powershell
git status --short
git diff --stat
git diff --check
```

Expected: feature files are present alongside the pre-existing one-shot and metric-card changes. Do not stage or commit overlapping dirty files until the user chooses how the complete branch should be integrated.
