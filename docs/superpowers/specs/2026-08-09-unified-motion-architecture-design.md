# Unified Motion Architecture Design

## Goal

Reduce the cost and risk of adding or changing motion cards by making live preview and export use the same renderer, grouping Workbench state by domain, and turning renderer parity into an automated contract.

## Non-negotiable contracts

- Existing version-1 project JSON and IndexedDB workspaces remain readable.
- Export remains animation cards only at 1920x1080, 30 fps.
- MOV remains ProRes 4444 (`ap4h`) with `yuva444p12le` alpha.
- Progress, cancellation, retry, immutable export snapshots, worker fallback, and launcher behavior remain unchanged.
- The Precision Monolith visual direction remains unchanged.

## Architecture

### One renderer for preview and export

The Canvas renderer registered for each motion becomes the only production visual renderer. `MotionCanvasPreview` draws that renderer into a 1920x1080 canvas for both the idle component preview and timeline cards. ExportSurface and the worker resolve the exact same renderer function from the same registry.

React remains responsible for editor controls, video playback, selection, keyboard movement, safe-area guides, and the timeline. The legacy per-motion React visual components are removed after the Canvas preview is covered by tests.

### Domain state boundaries

Workbench state is grouped behind four hooks:

- project: active motion, parameters, cards, selection, replay keys, and safe-area preference;
- video: active and pending video, media time/duration, and video errors;
- persistence: hydration, storage errors, and clear-workspace status;
- export: capabilities, immutable export cards, status, progress, and messages.

Workbench continues to orchestrate cross-domain workflows, but state initialization and mutation are no longer an unstructured list of independent `useState` calls.

### Visual acceptance chain

Registry tests prove every motion has one renderer and that preview/export/worker resolution returns that same function. Component tests prove preview canvases receive deterministic time and resources. The existing browser benchmark continues to compare main-thread Canvas with Worker OffscreenCanvas at four phases per motion. The final acceptance run probes the real MOV codec and alpha channel.

## Migration and rollback

The work is split into small commits: contracts, domain hooks, Canvas preview, registry consolidation, legacy removal, and verification. Existing tests stay green after each commit. If Canvas preview introduces a blocker, the previous commit restores the React preview without affecting the export path.

## Error handling

If a 2D context is unavailable, preview renders an accessible error status instead of silently showing an empty stage. Renderer exceptions are caught per preview canvas and surfaced as a status while export retains its existing fail-fast behavior. Animation frames and font-ready callbacks are cancelled when a card unmounts or replay restarts.

## Success criteria

- One production renderer per motion is shared by preview, main-thread export, and worker export.
- Workbench uses four named domain hooks rather than independent domain state declarations.
- All existing tests plus new parity tests pass.
- Lint, TypeScript build, browser benchmark, and real ProRes/alpha checks pass.
- No change to version-1 project parsing, persistence, launcher behavior, or export output contract.
