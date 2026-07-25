# Local Video Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users select a local video, keep it playing behind all six motion components, and edit overlay text in real time without uploading or persisting the video.

**Architecture:** `Workbench` owns the selected file name, object URL, validation error, and URL cleanup. `ParameterPanel` exposes the file picker and remove action, while `PreviewStage` renders either the stable video element or the existing reference image beneath the motion layer.

**Tech Stack:** React, TypeScript, browser Blob URLs, HTML video, Vitest, React Testing Library, CSS.

---

### Task 1: Lock video import behavior with tests

**Files:**
- Modify: `src/components/Workbench.test.tsx`

- [x] Mock `URL.createObjectURL` and `URL.revokeObjectURL`.
- [x] Add a test that selects an MP4 file and expects the reference image to be replaced by a video with `autoPlay`, `muted`, `loop`, and `playsInline`.
- [x] Change a text parameter and switch components; assert the same video URL remains mounted.
- [x] Click “移除视频”; assert the video disappears, the reference image returns, and the Blob URL is revoked.
- [x] Add an invalid-file test that expects a Chinese validation message.
- [x] Run `npm test -- --run src/components/Workbench.test.tsx` and confirm RED.

### Task 2: Add Workbench video state and resource cleanup

**Files:**
- Modify: `src/components/Workbench.tsx`

- [x] Add `videoPreview`, `videoError`, and a ref holding the active Blob URL.
- [x] Implement `selectVideo(file)`:

```ts
if (!file.type.startsWith('video/')) {
  setVideoError('请选择有效的视频文件')
  return
}

const nextUrl = URL.createObjectURL(file)
if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
videoUrlRef.current = nextUrl
setVideoPreview({ name: file.name, url: nextUrl })
setVideoError('')
```

- [x] Implement `removeVideo()` and unmount cleanup with `URL.revokeObjectURL`.
- [x] Pass the video URL to `PreviewStage` and video controls to `ParameterPanel`.

### Task 3: Add the parameter-panel import controls

**Files:**
- Modify: `src/components/ParameterPanel.tsx`
- Modify: `src/styles.css`

- [x] Add props for file name, error, import callback, and remove callback.
- [x] Add a “视频背景” block above stage assistance.
- [x] Use a styled file input accepting `video/*`; reset the input value after selection so the same file can be selected again.
- [x] Show “不上传，仅在当前浏览器预览” before import.
- [x] Show file name, “更换视频”, and “移除视频” after import.
- [x] Style the block using existing monochrome borders and spacing.

### Task 4: Render the stable background video

**Files:**
- Modify: `src/components/PreviewStage.tsx`
- Modify: `src/styles.css`

- [x] Add optional `videoUrl` to `PreviewStageProps`.
- [x] Render:

```tsx
<video
  className="presenter-background presenter-background--video"
  data-testid="presenter-video"
  src={videoUrl}
  aria-label="本地视频背景"
  autoPlay
  muted
  loop
  playsInline
/>
```

- [x] Keep the video outside the keyed `.motion-slot` so parameter changes and component switches do not restart it.
- [x] Render the existing reference image only when no video URL exists.
- [x] Apply `object-fit: cover` and preserve the current layer order.
- [x] Run the focused Workbench tests and confirm GREEN.

### Task 5: Verify and deliver

**Files:**
- Modify: `docs/superpowers/plans/2026-07-26-local-video-preview.md`

- [x] Run `npm test -- --run`, `npm run lint`, `npm run build`, and `git diff --check`.
- [x] Import a local test video in the browser and verify it plays while text changes and component switches preserve the same video.
- [x] Verify the person and subtitle safety overlays remain above the video.
- [x] Mark all plan tasks complete and commit.
