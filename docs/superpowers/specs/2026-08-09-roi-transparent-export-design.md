# ROI Transparent Export Design

Date: 2026-08-09

## Goal

Accelerate transparent MOV export without changing the delivered video contract: 1920×1080, 30fps, ProRes 4444 (`ap4h`), `yuva444p12le` decoder output, 16-bit Alpha encoding, and no audio.

## Evidence and decision

The current Worker renders and reads a complete 8,294,400-byte RGBA frame, sends it to two Zero-RLE workers, and asks the server to allocate and reconstruct another complete frame before FFmpeg consumes it. A current 300-frame mixed-motion benchmark runs at roughly 37.6fps. Visible content occupies 22.6% of the frame on average and remains inside a union covering about 29% of the frame.

Alternative encoders are not acceptable as the default. `prores_aw` changes both color and Alpha samples. `prores_ks_vulkan` preserves Alpha but produced lower RGB PSNR than the current CPU `prores_ks` output. Thread and slice tuning did not provide material gains.

The selected design keeps the current CPU encoder and sends only a conservative rectangular region of interest (ROI). The server reconstructs the exact full frame before writing it to unchanged FFmpeg arguments. Existing ordered RLE remains the fallback for unsupported or oversized ROI frames.

## Architecture

Each motion definition publishes a conservative local Canvas bounds rectangle. The export Canvas session resolves active cards at a requested time, transforms and unions their bounds, clamps the result to the 1920×1080 surface, and exposes both full-frame and ROI capture. Bounds include shadows, strokes, entrance/exit movement, and card-position offsets.

The Worker renders the normal full logical canvas but reads only the predicted ROI through `getImageData(x, y, width, height)`. It sends an ordered binary packet containing a versioned header, rectangle coordinates, and raw tightly packed RGBA rows. Empty frames use a header-only packet. If the ROI covers more than the configured area threshold or bounds are unavailable, the Worker uses the existing lossless full-frame RLE transport.

The server validates every coordinate, payload length, and frame order. A small ring of full-frame buffers preserves each write until Node reports that FFmpeg accepted it. For an ROI packet, the selected slot is cleared, ROI rows are copied into the correct full-frame offsets, and the complete buffer is written to the unchanged rawvideo pipe. The server never reuses a slot before its write callback completes.

## Correctness and fallback

- Every registered renderer must declare bounds.
- Browser tests render representative phases and assert that every non-zero RGBA byte lies inside the declared rectangle.
- Protocol tests reject truncated, overflowing, out-of-bounds, and trailing payloads.
- Reconstruction tests compare all 8,294,400 bytes with the existing full-frame capture.
- Capability negotiation advertises ROI v4 independently of RLE v3.
- Worker setup or ROI validation failure falls back to the existing RLE route without changing output quality.

## Performance acceptance

The benchmark reports ROI area, payload bytes, Canvas readback time, server reconstruction time, FFmpeg backpressure, and completed fps. Three 300-frame runs must have a median of at least 45fps on the verified machine, with no run below 42fps. A 600-frame long-mode run must improve over the recorded 40.58fps baseline. If raw ROI is slower for a large rectangle, the adaptive threshold must select RLE.

Quality acceptance remains unchanged: 32 Canvas parity samples, exact ROI reconstruction, ProRes 4444 `ap4h`, `yuva444p12le`, 1920×1080, 30fps, no audio, and transparent/opaque Alpha samples.
