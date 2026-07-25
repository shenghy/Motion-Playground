# Video Playback Controls Design

## Goal

Add custom playback controls to the existing local-video preview so users can
hear the source audio, pause or resume playback, and seek to any point while
editing motion copy.

## User Experience

- Keep the existing import behavior: a valid video starts automatically and
  loops.
- Start muted so browser autoplay remains reliable.
- Let the user explicitly enable or disable audio.
- Add a custom monochrome control bar inside the preview canvas, immediately
  above the 150-pixel subtitle safe area.
- Include:
  - Play and pause button.
  - Mute and sound button.
  - Seekable progress slider.
  - Current time and total duration.
- Keep the controls visually consistent with the black, white, grey, pencil-like
  preview interface.
- Treat the controls as preview UI, not as motion content.

## Architecture

`PreviewStage` continues to own the stable `<video>` DOM node. It also owns the
small amount of playback UI state that comes directly from that node:

- Whether the video is paused.
- Whether the video is muted.
- Current playback time.
- Video duration.

The component synchronizes state from media events such as `play`, `pause`,
`timeupdate`, `durationchange`, and `volumechange`. User actions call the media
element directly through a React ref:

- Play or pause calls `video.play()` or `video.pause()`.
- Sound toggle changes `video.muted`.
- Seeking assigns a clamped value to `video.currentTime`.

The video remains outside the keyed `.motion-slot`, so editing parameters and
switching among the six motion components do not recreate it or reset playback.

## Autoplay and Audio

The active video keeps `autoPlay`, `loop`, and `playsInline`. It starts muted to
comply with browser autoplay policies. Audio begins only after the user clicks
the sound button. Pausing, resuming, seeking, editing motion parameters, and
switching components preserve the selected mute state.

If `video.play()` rejects, the controls remain in the paused state instead of
showing a false playing state.

## Layout and Styling

The control bar is positioned above the subtitle safe area and below the main
motion content. It uses:

- Thin white or grey borders.
- A compact square play button.
- A wide, high-contrast range input for seeking.
- Monospaced time labels.
- Minimal background translucency and no heavy shadow.

The safety overlays remain above the video. The playback controls receive their
own preview-only layer and do not change the 150-pixel subtitle reservation.

## Scope

Included:

- Play and pause.
- Mute and sound.
- Seeking.
- Current time and duration.
- Stable playback across live text edits and component switches.

Excluded:

- Volume slider.
- Playback speed.
- Fullscreen mode.
- Frame-by-frame stepping.
- Keyboard shortcuts.
- Video export or persistence.

## Testing

Automated tests will verify:

- Imported videos still begin muted and autoplay-ready.
- Play and pause buttons call the corresponding media APIs and update labels.
- The sound button toggles the video `muted` property.
- The progress slider writes to `currentTime`.
- Media events update progress and formatted time.
- Editing text and switching motion components preserve the same video node.

Browser validation will use a real local video to confirm sound activation,
pause/resume, seeking, time display, layer order, and control placement.
