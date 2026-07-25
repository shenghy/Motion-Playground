# Video Playback Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a custom monochrome playback bar that lets users pause, resume, hear, mute, and seek the imported preview video.

**Architecture:** `PreviewStage` keeps the stable video element and synchronizes media state from its events. A focused `VideoPlaybackControls` component renders the controls and forwards user intent without owning the media element, so motion rerenders cannot reset video playback.

**Tech Stack:** React, TypeScript, HTMLMediaElement APIs, CSS, Vitest, React Testing Library.

---

### Task 1: Lock playback behavior with failing tests

**Files:**
- Modify: `src/components/Workbench.test.tsx`

- [ ] **Step 1: Add a media-state test**

Import a valid video, fire its `play` event, and assert:

```tsx
expect(screen.getByRole('button', { name: '暂停视频' })).toBeInTheDocument()
expect(screen.getByRole('button', { name: '开启声音' })).toBeInTheDocument()
expect(screen.getByLabelText('视频进度')).toHaveValue('0')
expect(screen.getByText('00:00 / 00:00')).toBeInTheDocument()
```

- [ ] **Step 2: Add play, pause, sound, and seek assertions**

Mock `HTMLMediaElement.prototype.play` and `pause`. Verify:

```tsx
fireEvent.click(screen.getByRole('button', { name: '暂停视频' }))
expect(pause).toHaveBeenCalled()
fireEvent.pause(video)

fireEvent.click(screen.getByRole('button', { name: '播放视频' }))
expect(play).toHaveBeenCalled()

fireEvent.click(screen.getByRole('button', { name: '开启声音' }))
expect(video.muted).toBe(false)
expect(screen.getByRole('button', { name: '静音' })).toBeInTheDocument()

fireEvent.change(screen.getByLabelText('视频进度'), {
  target: { value: '35' },
})
expect(video.currentTime).toBe(35)
```

- [ ] **Step 3: Add time synchronization assertions**

Define a finite `duration` on the video, assign `currentTime`, and dispatch
`durationChange` and `timeUpdate`. Expect `00:35 / 02:05` and a slider maximum
of `125`.

- [ ] **Step 4: Verify controls survive motion updates**

After enabling sound, edit the active text field and switch to another motion.
Assert the same video node remains mounted, remains unmuted, and the playback
bar still exists.

- [ ] **Step 5: Run the focused test and confirm RED**

Run:

```bash
npm test -- --run src/components/Workbench.test.tsx
```

Expected: FAIL because the custom playback buttons, progress slider, and time
display do not exist.

### Task 2: Add the focused playback control component

**Files:**
- Create: `src/components/VideoPlaybackControls.tsx`

- [ ] **Step 1: Define the controlled component contract**

```tsx
interface VideoPlaybackControlsProps {
  isPlaying: boolean
  isMuted: boolean
  currentTime: number
  duration: number
  onTogglePlayback: () => void
  onToggleMuted: () => void
  onSeek: (time: number) => void
}
```

- [ ] **Step 2: Add deterministic time formatting**

```tsx
const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '00:00'
  const seconds = Math.floor(value)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
    seconds % 60,
  ).padStart(2, '0')}`
}
```

- [ ] **Step 3: Render the custom controls**

Render a preview-only toolbar with:

```tsx
<button aria-label={isPlaying ? '暂停视频' : '播放视频'} />
<input
  type="range"
  aria-label="视频进度"
  min={0}
  max={duration > 0 ? duration : 0}
  step={0.01}
  value={Math.min(currentTime, duration || 0)}
/>
<output>{formatTime(currentTime)} / {formatTime(duration)}</output>
<button aria-label={isMuted ? '开启声音' : '静音'} />
```

The range input calls `onSeek(Number(event.target.value))`.

### Task 3: Connect controls to the stable video element

**Files:**
- Modify: `src/components/PreviewStage.tsx`

- [ ] **Step 1: Add media refs and UI state**

Add:

```tsx
const videoRef = useRef<HTMLVideoElement>(null)
const [isPlaying, setIsPlaying] = useState(false)
const [isMuted, setIsMuted] = useState(true)
const [currentTime, setCurrentTime] = useState(0)
const [duration, setDuration] = useState(0)
```

- [ ] **Step 2: Synchronize from media events**

Attach the ref and handlers to the active video:

```tsx
ref={videoRef}
onPlay={() => setIsPlaying(true)}
onPause={() => setIsPlaying(false)}
onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
onDurationChange={(event) => {
  const nextDuration = event.currentTarget.duration
  setDuration(Number.isFinite(nextDuration) ? nextDuration : 0)
}}
onVolumeChange={(event) => setIsMuted(event.currentTarget.muted)}
```

- [ ] **Step 3: Implement control actions**

```tsx
const togglePlayback = () => {
  const video = videoRef.current
  if (!video) return
  if (video.paused) {
    void video.play().catch(() => setIsPlaying(false))
  } else {
    video.pause()
  }
}

const toggleMuted = () => {
  const video = videoRef.current
  if (!video) return
  video.muted = !video.muted
  setIsMuted(video.muted)
}

const seek = (time: number) => {
  const video = videoRef.current
  if (!video) return
  const nextTime = Math.min(Math.max(time, 0), duration || 0)
  video.currentTime = nextTime
  setCurrentTime(nextTime)
}
```

- [ ] **Step 4: Reset only when the source changes**

Use an effect keyed by `videoUrl` to reset the control display to muted,
zero-time state. Do not key it by motion ID, parameters, or playback key.

- [ ] **Step 5: Render controls only for an active video**

Place `VideoPlaybackControls` after the motion layer and before safety overlays.
Do not place the video itself or the controls inside `.motion-slot`.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run:

```bash
npm test -- --run src/components/Workbench.test.tsx
```

Expected: all Workbench tests pass.

### Task 4: Style the preview-only playback bar

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Position the bar above the subtitle area**

Add `.video-playback-controls` with absolute positioning, `z-index: 6`, and:

```css
left: 4%;
right: 4%;
bottom: calc(var(--subtitle-safe-bottom) + 1.1cqw);
```

- [ ] **Step 2: Match the monochrome pencil interface**

Use a compact grid with thin borders, translucent near-black background, white
controls, monospaced time text, no heavy shadow, and a high-contrast range
track/thumb.

- [ ] **Step 3: Keep interaction targets usable**

Give both icon buttons at least a 30-pixel target in the scaled preview UI and
add visible `:focus-visible` styles.

### Task 5: Verify, review, and deliver

**Files:**
- Modify: `docs/superpowers/plans/2026-07-26-video-playback-controls.md`

- [ ] **Step 1: Run all automated checks**

```bash
npm test -- --run
npm run lint
npm run build
git diff --check
```

Expected: all tests pass, lint reports no errors, Vite production build
succeeds, and diff check emits no output.

- [ ] **Step 2: Validate with a real local video**

In the running browser:

- Import a video with audio.
- Confirm it starts muted.
- Enable sound and verify the media element is unmuted.
- Pause and resume.
- Seek to a different timestamp and verify progress/time.
- Edit text and switch motions; confirm the same video element and state remain.
- Confirm the toolbar sits above the 150-pixel subtitle safe area.

- [ ] **Step 3: Request independent code review**

Review lifecycle handling, rejected `play()` promises, finite duration handling,
seek clamping, accessibility labels, and regressions in Blob URL cleanup.

- [ ] **Step 4: Commit**

```bash
git add src/components/VideoPlaybackControls.tsx \
  src/components/PreviewStage.tsx \
  src/components/Workbench.test.tsx \
  src/styles.css \
  docs/superpowers/plans/2026-07-26-video-playback-controls.md
git commit -m "feat: add video playback controls"
```
