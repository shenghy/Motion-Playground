# Canvas Raw-Frame Transparent Export Verification

Date: 2026-08-05 (Asia/Shanghai)

Machine: AMD Ryzen 5 7500F (6 cores / 12 threads), AMD Radeon RX 7900 XT, 31.6 GiB RAM, Windows, Google Chrome headless, bundled FFmpeg.

## Output contract

- 1920x1080, 30fps
- QuickTime MOV, ProRes 4444 (`ap4h`)
- `yuva444p12le`, no audio
- Transparent corners and non-zero visible Alpha

## Worker pipeline

The production path now renders with `OffscreenCanvas` in a dedicated Worker,
keeps three frames in flight, compresses transparent zero pixels with a
lossless RLE transport, and streams ordered frames to the same ProRes 4444
encoder. The server reconstructs the original RGBA bytes before encoding.

The legacy path remains available as an automatic fallback when the browser or
local export server does not advertise the v3 ordered RLE protocol.

## Mixed 300-frame benchmark

The fixture contains all eight motions, overlapping cards with different z-index values, positive and negative positions, a transparent gap, and one-shot motion state.

| Run | Total | FPS | Frame capture | Frame transfer | Encoding |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 7.132 s | 42.06 | 2.662 s | 4.276 s | 0.262 s |
| 2 | 7.218 s | 41.56 | 2.692 s | 4.285 s | 0.295 s |
| 3 | 7.249 s | 41.39 | 2.480 s | 4.596 s | 0.247 s |

Median: 41.56 fps. Minimum: 41.39 fps. Every run generated the same
96,295,170-byte MOV.

The three local save times were 336 ms, 303 ms, and 295 ms.

## Deterministic visual invariants

Four samples per motion (entrance, expansion, stable, exit) were rendered in
both the main-thread HTML Canvas renderer and the Worker OffscreenCanvas
renderer, for 32 samples total. All 32 samples passed:

- visible pixels have non-zero Alpha;
- all four canvas corners remain Alpha 0;
- changed-byte ratio is at most 0.0598%;
- mean absolute channel error is at most 0.0147;
- every registered motion produces visible output.

The remaining differences occur on anti-aliased clipping edges between Chrome's
HTMLCanvas and OffscreenCanvas implementations. Content, layering, transparency,
and phase timing are covered by the browser parity gate.

## Full 11,248-frame result

- Frame count accepted: 11,248
- Timeline duration: 374.93 seconds (06:14.93)
- Render and encode elapsed: 244.911 seconds (04:04.911)
- Average throughput: 45.93 fps
- Frame capture: 79.542 seconds
- Backpressured compressed transfer: 164.343 seconds
- Final encoding flush: 0.264 seconds
- Output size: 2,229,623,412 bytes
- Local save-endpoint stream: 4.250 seconds
- Render + save stream total: 249.161 seconds (04:09.161)

Compared with the previous verified 309.761-second render, the new pipeline is
64.850 seconds faster (20.9%). Including save time, the result is 9.161 seconds
above the four-minute stretch goal on this machine.

## FFmpeg probe and Alpha samples

FFmpeg reports:

```text
Duration: 00:06:14.93
Video: prores (4444) (ap4h), yuva444p12le, 1920x1080, 30 fps
Audio streams: none
```

Frames 0, 5,624, and 11,247 were decoded through `alphaextract,signalstats`. Every sample reported `YMIN=0` and `YMAX=4095`, proving each sampled frame contains both fully transparent and fully opaque Alpha regions. The final-frame sample also confirms frame 11,247 exists, matching 11,248 total frames indexed from zero.

## Unified preview/export renderer verification

Date: 2026-08-09 (Asia/Shanghai)

The live React preview now hosts the same Canvas renderer function used by
main-thread export and Worker OffscreenCanvas export. The legacy per-motion
React visual renderers are no longer part of the production registry or bundle.

- `npm run test:visual`: 6 files / 18 tests passed.
- Browser benchmark: 60/60 frames completed in 2.632 seconds.
- Browser/Worker parity: 32 samples, changed-byte ratio 0, mean absolute error 0, maximum channel delta 0.
- Output: 16,549,304-byte MOV, 2.00 seconds, 30 fps.
- FFmpeg probe: ProRes 4444 (`ap4h`), `yuva444p12le`, 1920x1080, no audio.
- Alpha samples: frame 0 is fully transparent as the one-shot entrance begins; frames 30 and 59 both contain `YMIN=0` and `YMAX=4095`, proving transparent and fully opaque regions coexist after entrance.
