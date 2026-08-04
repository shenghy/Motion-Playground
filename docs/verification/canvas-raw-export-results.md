# Canvas Raw-Frame Transparent Export Verification

Date: 2026-08-04 (Asia/Shanghai)

Machine: AMD Ryzen 5 7500F (6 cores / 12 threads), AMD Radeon RX 7900 XT, 31.6 GiB RAM, Windows, Google Chrome headless, bundled FFmpeg.

## Output contract

- 1920x1080, 30fps
- QuickTime MOV, ProRes 4444 (`ap4h`)
- `yuva444p12le`, no audio
- Transparent corners and non-zero visible Alpha

## Mixed 300-frame benchmark

The fixture contains all six motions, overlapping cards with different z-index values, positive and negative positions, a transparent gap, and looping motion state.

| Run | Total | FPS | Frame capture | Frame transfer | Encoding |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 10.128 s | 29.62 | 2.474 s | 6.680 s | 0.185 s |
| 2 | 9.125 s | 32.88 | 2.248 s | 5.992 s | 0.196 s |
| 3 | 8.691 s | 34.52 | 2.192 s | 5.684 s | 0.179 s |

Median: 32.88 fps. Minimum: 29.62 fps. The gate requires median >=30 fps and every run >=27 fps, so both conditions pass.

The final 98,232,944-byte short MOV streamed through the local save endpoint in 157.5 ms with `curl` to a null sink. PowerShell `Invoke-WebRequest` is not used for the saving benchmark because its cmdlet buffering added about 38 seconds of client overhead for the same file.

## Deterministic visual invariants

Four samples per motion (entrance, expansion, stable, exit) were rendered twice in a real Chrome Canvas, for 24 samples total. All 24 samples passed:

- visible pixels have non-zero Alpha;
- all four canvas corners remain Alpha 0;
- repeated rendering has byte-identical Alpha output;
- every registered motion produces visible output.

The Canvas export renderer is an independent deterministic renderer rather than a DOM screenshot. Exact anti-aliased pixel identity with the live React preview is therefore not an acceptance criterion; content, layering, transparency, and phase timing are covered by state and browser invariants.

## Full 11,248-frame result

- Frame count accepted: 11,248
- Timeline duration: 374.93 seconds (06:14.93)
- Render and encode elapsed: 309.761 seconds (05:09.761)
- Average throughput: 36.31 fps
- Frame capture: 61.621 seconds
- Backpressured frame transfer: 219.748 seconds
- Final encoding flush: 0.197 seconds
- Output size: 3,662,427,447 bytes
- Local save-endpoint stream: 4.180 seconds (835.6 MiB/s to a null sink)
- Render + save stream total: 313.941 seconds (05:13.941)

The seven-minute hard target passes by 106.1 seconds. The four-minute stretch goal does not pass on this machine.

## FFmpeg probe and Alpha samples

FFmpeg reports:

```text
Duration: 00:06:14.93
Video: prores (4444) (ap4h), yuva444p12le, 1920x1080, 30 fps
Audio streams: none
```

Frames 0, 5,624, and 11,247 were decoded through `alphaextract,signalstats`. Every sample reported `YMIN=0` and `YMAX=4095`, proving each sampled frame contains both fully transparent and fully opaque Alpha regions. The final-frame sample also confirms frame 11,247 exists, matching 11,248 total frames indexed from zero.
