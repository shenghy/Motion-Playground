# Timeline JSON Composer Design

## Goal

Turn the existing motion preview into a lightweight local overlay composer.
Users can place motion cards on a video timeline, preview them at the correct
video time, move them inside the canvas, and import or export the complete card
arrangement as JSON.

## Scope

Included:

- A timeline below the video preview.
- Dragging a component from the existing component rail to the timeline.
- A three-second default duration for new cards.
- Moving a whole timeline clip.
- Resizing a clip from either edge to change its start or end time.
- Showing cards automatically according to video `currentTime`.
- Selecting a timeline card and editing its existing parameters.
- Dragging a selected card inside the preview canvas.
- Saving position as percentage coordinates.
- JSON import and download.

Excluded:

- SRT import.
- Video export.
- Remotion or ffmpeg integration.
- Audio waveform generation.
- Zoomable or multi-track professional editing tools.
- A desktop application framework.

## User Workflow

1. Import a local video using the existing video control.
2. Drag one of the six motion components from the left rail onto the timeline.
3. The timeline drop position becomes the card start time.
4. The new card lasts three seconds, clamped to the video duration.
5. Drag the clip to change its time, or drag its left and right edges to change
   its start and end.
6. Click the clip to select it and edit its content in the existing parameter
   panel.
7. Drag the visible card inside the preview canvas to change its position.
8. Play or seek the video; only cards whose time range contains the current
   video time appear.
9. Export the arrangement as JSON or import a JSON file to replace it.

## Data Model

```ts
interface OverlayProject {
  version: 1
  canvas: {
    width: 1920
    height: 1080
  }
  cards: OverlayCard[]
}

interface OverlayCard {
  id: string
  motionId: MotionId
  start: number
  end: number
  position: {
    x: number
    y: number
  }
  zIndex: number
  params: ParameterValues
}
```

Rules:

- Times are stored in seconds.
- `start` is never negative.
- `end` is greater than `start`.
- The minimum card duration is 0.2 seconds.
- New cards default to three seconds.
- `x` and `y` are clamped to `0–100`.
- Imported parameter values are merged onto the registered defaults for the
  matching motion component.
- Unknown component IDs and malformed cards reject the import with a Chinese
  error message.
- Later-created cards receive a higher `zIndex`.

## State Ownership

`Workbench` owns:

- The project card array.
- The selected card ID.
- The active video time and duration received from `PreviewStage`.
- JSON import errors.

The existing component rail keeps selecting the component type. It becomes a
drag source without losing its click-to-preview behavior.

The parameter panel edits the selected timeline card when a card is selected.
When no timeline card is selected, it continues to edit the component preview
defaults as it does today.

`PreviewStage` keeps the stable video element and reports media time changes to
`Workbench`. It renders all cards active at the current time in `zIndex` order.

## Timeline

A new `TimelineEditor` component sits below the preview canvas inside the center
column.

It contains:

- A time ruler.
- A playhead synchronized with video `currentTime`.
- One horizontal clip lane for the first phase.
- One clip per overlay card.
- Left and right resize handles.
- An empty-state hint when no cards exist.

Dropping a component calculates time from the pointer position within the
timeline width. Moving and resizing use pointer events and clamp values to the
known video duration. If no video is loaded, the timeline accepts no drops and
shows a Chinese instruction to import a video first.

Overlapping cards are allowed in the single lane. Selection and `zIndex`
determine the visible stacking order.

## Video-Time Preview

An overlay card is active when:

```ts
card.start <= currentTime && currentTime < card.end
```

Seeking or playing updates active cards from native media events. Editing text,
moving a card, and switching the selected timeline item do not recreate the
video element.

When no timeline cards exist, the current single-component preview remains
available so the original playground behavior is preserved.

## Canvas Positioning

Each active timeline card is wrapped in a positioned overlay layer. Dragging the
selected layer converts pointer movement from the scaled preview canvas into
percentage coordinates.

The stored coordinates represent translation offsets from the component's
existing designed position, not an absolute replacement of each component's
internal layout. This preserves the six existing component designs while
letting the user move the full card presentation.

The drag result is clamped to the preview bounds. The person and subtitle safety
guides remain visible above the video and below interactive editor controls.

## JSON Import and Export

Export:

- Serialize the current `OverlayProject`.
- Use readable two-space indentation.
- Download a UTF-8 file named `overlay-studio-project.json`.
- Do not include the local video file or Blob URL.

Import:

- Accept `.json`.
- Parse and validate the project before changing current state.
- Replace the current card arrangement only after validation succeeds.
- Clear the selected card after replacement.
- Keep the currently loaded local video.
- Show a Chinese error without changing state if parsing or validation fails.

## Compatibility

The implementation stays inside the existing React, TypeScript, Vite, CSS, and
Vitest stack. No new runtime dependency or project-structure refactor is
required.

Existing behavior that must remain:

- Local video import and validation.
- Sound, pause, resume, and progress controls.
- Six motion previews.
- Parameter editing.
- Person safe area.
- The 150-pixel subtitle safe area.

## Testing

Automated tests cover:

- Project validation and default merging.
- Timeline drop time and three-second duration.
- Moving and resizing with clamping.
- Active-card selection from video time.
- Per-card parameter editing.
- Percentage-position updates.
- JSON export contents.
- Valid JSON replacement.
- Invalid JSON preserving current state.
- Existing video and motion behavior.

Browser validation covers:

- Importing a real local video.
- Dragging a component onto the timeline.
- Playback-driven card visibility.
- Moving the clip and resizing its edges.
- Dragging the card in the preview.
- Exporting and re-importing the JSON project.
