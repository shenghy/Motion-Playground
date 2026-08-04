# Worker Pipelined Transparent Export Design

## Goal

Export a 11,248-frame, 1920x1080, 30fps transparent timeline in at most four minutes on the verified Ryzen 5 7500F machine without changing visual content, frame count, timing, Alpha precision, ProRes 4444 profile, or retry/cancellation behavior.

The previous verified result is 309.761 seconds for rendering/encoding and 313.941 seconds including local result streaming. Its measured phases are 61.621 seconds of Canvas capture and 219.748 seconds of acknowledged transfer/FFmpeg backpressure. Those phases currently run serially, and the browser also allocates and copies an additional 8,294,404-byte packet for every frame.

## Selected approach

Combine two changes:

1. Move MOV frame rendering and WebSocket transport into a dedicated module Worker backed by `OffscreenCanvas`.
2. Replace the single-frame stop-and-wait loop with a strictly ordered, three-frame bounded pipeline.

The live React preview and PNG export remain unchanged. The existing main-thread raw MOV client remains available as a quality-preserving compatibility fallback.

## Output contract

The optimized path must retain all of the following:

- 1920x1080 pixels;
- 30fps and the exact calculated frame count;
- deterministic card order, positions, timing, text, and Alpha;
- QuickTime MOV with ProRes 4444 (`ap4h`);
- `yuva444p12le` decoder output and no audio;
- transparent corners and non-zero visible Alpha;
- immutable project snapshot, pending-job fingerprint, save retry, cancellation, and cleanup behavior.

No lower resolution, reduced frame rate, lossy intermediate, reduced ProRes profile, or skipped frame is permitted.

## Architecture

### Main thread coordinator

`Workbench` continues to own the file picker, immutable card snapshot, pending-job fingerprint, UI progress, cancellation control, and final file saving. For MOV export it starts a dedicated module Worker and uses a two-phase handshake. First it sends a preparation message containing the immutable cards, duration, dimensions, fps, font assets, and window size. The Worker loads fonts, creates the OffscreenCanvas session, and reports `ready`. Only then does the main thread create the server job and send the second start message containing:

- same-origin job and WebSocket URLs;
- the server job ID.

The coordinator receives progress, completion, performance, and failure messages. It never receives RGBA frame buffers. Save retry continues to reuse the completed server job and does not restart the Worker.

### Worker Canvas renderer

The Worker creates one persistent 1920x1080 `OffscreenCanvas`, loads the exact display, mono, and handwriting font assets using `FontFace`, and waits for `self.fonts.ready`. It reuses the current Canvas motion registry, state calculators, draw primitives, stable z-index sorting, and timeline playback math.

The current UI registry imports React motion components and must not be imported by the Worker. A new Canvas-only registry maps every `MotionId` directly to its Canvas renderer. The UI registry and Worker registry share the same renderer exports, and a coverage test requires both registries to contain exactly all six IDs. This keeps React, Motion, and DOM-only modules out of the Worker bundle.

For every frame it renders directly into the OffscreenCanvas and reads one exact 8,294,400-byte RGBA buffer. The Worker owns the WebSocket and sends the buffer directly, avoiding main-thread `postMessage` transfer and the current extra packet allocation/copy.

If required Worker Canvas or font APIs are unavailable, the coordinator uses the existing main-thread Canvas/raw-WebSocket path. The fallback changes speed only; it retains the same quality contract.

### Headerless ordered WebSocket protocol

WebSocket guarantees message order, while the server already owns the authoritative `nextFrame` value. Binary messages therefore contain only the exact RGBA payload; the four-byte frame index header is removed.

The server assigns each binary message the current expected frame index, validates an exact 8,294,400-byte payload, appends it to FFmpeg, waits for stream drain when necessary, increments the expected frame, and returns:

```json
{"type":"frame-accepted","frameIndex":42}
```

The client still verifies acknowledgements are continuous and exact. `finish` is accepted only after all frames have been acknowledged. This preserves strict ordering while eliminating one full-frame JavaScript copy per frame.

### Three-frame bounded pipeline

The Worker may have at most three unacknowledged frames. It renders and sends until the window is full, then resumes when acknowledgements free slots. It also pauses when `WebSocket.bufferedAmount` exceeds 32 MiB.

The server processes binary messages through one promise chain, so FFmpeg writes remain strictly sequential. An acknowledgement is emitted only after `appendRawFrame` has accepted the frame and any required FFmpeg stdin drain has completed.

The three-frame limit bounds retained RGBA memory to approximately 24.9 MiB plus browser transport overhead. It is large enough to overlap Canvas capture with FFmpeg backpressure but small enough to avoid unbounded buffering and cancellation lag.

## Progress and performance reporting

The Worker reports progress only for acknowledged frames. Performance data separates:

- Worker Canvas draw plus `getImageData`;
- browser WebSocket enqueue;
- acknowledgement/FFmpeg backpressure;
- final encoding flush;
- saving on the main thread.

The UI keeps the current completed-frame count, fps estimate, remaining-time estimate, and cancel button behavior. No frame is reported complete before the server acknowledges it.

## Cancellation and error handling

- Main-thread cancellation posts `cancel` to the Worker and terminates it after a bounded grace period.
- The Worker closes the WebSocket and stops rendering new frames immediately.
- A socket close before completion causes the server to cancel the job and remove temporary output.
- A stale, duplicate, skipped, or non-continuous acknowledgement fails the export.
- A malformed or wrong-sized binary payload fails and cancels the server job.
- Worker initialization or font-loading failure falls back before a server job is created whenever possible.
- A failure after encoding preserves the existing pending-job save retry behavior.

## Testing

Automated tests must cover:

- headerless exact-size frame validation and server-assigned sequence numbers;
- no more than three unacknowledged frames;
- rendering continues while earlier frames await acknowledgement;
- `bufferedAmount` backpressure;
- continuous acknowledgement validation;
- cancellation during Worker setup, rendering, acknowledgement wait, encoding, and saving;
- Worker failure fallback without duplicate jobs;
- save retry without rerendering;
- all six motion renderers in Worker context;
- byte-identical RGBA Alpha output between main-thread Canvas and OffscreenCanvas for the 24 existing visual fixtures;
- unchanged complete unit, integration, lint, and production-build suites.

## Acceptance verification

Run the mixed 300-frame fixture three times in the built local app. Median speed must be at least 47fps and no run may be below 44fps.

Then run the full 11,248-frame fixture once. Render, encode, and local result streaming must complete in at most 240 seconds on the verified machine. Probe the output for 1920x1080, 30fps, ProRes 4444, `yuva444p12le`, no audio, and 11,248 frames. Sample first, middle, and final Alpha planes and require both fully transparent and fully opaque regions.

If the full run exceeds four minutes, keep the quality contract and collect the new Worker draw, enqueue, acknowledgement, encoding, and saving breakdown. Do not lower quality to pass the time target.

## Scope boundaries

This change optimizes transparent MOV export only. It does not redesign the editor, alter live preview animations, change PNG export, add GPU-specific codecs, or modify the visual style of any motion.
