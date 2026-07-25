# Subtitle Safe Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reserve the bottom 150px of the 1920×1080 motion canvas for subtitles across all six components.

**Architecture:** Define one inherited CSS percentage variable for the 150px logical boundary and use it for every component currently ending below that line. Render a preview-only subtitle guide beside the existing person guide so both follow the same safety toggle.

**Tech Stack:** React, TypeScript, CSS, Vitest, React Testing Library, browser geometry inspection.

---

### Task 1: Lock the guide behavior with a failing test

**Files:**
- Modify: `src/components/Workbench.test.tsx`

- [x] Assert `subtitle-safe-area` is visible by default and carries `SUBTITLE SAFE / 150PX`.
- [x] Assert the existing safety switch hides both person and subtitle guides.
- [x] Run the focused test and confirm it fails because the subtitle guide does not exist.

### Task 2: Implement the shared subtitle boundary

**Files:**
- Modify: `src/components/PreviewStage.tsx`
- Modify: `src/styles.css`

- [x] Render the preview-only subtitle guide inside the existing `showSafeArea` branch.
- [x] Define `--subtitle-safe-bottom: 13.8889%`.
- [x] Move CompareSplit's bottom result, ProfileReveal's left card, all three new data/process cards, and bottom coordinate decorations above the boundary.
- [x] Keep components already above the boundary unchanged.

### Task 3: Verify all six components

**Files:**
- Modify only files required by discovered defects.

- [x] Run all tests, lint, and production build.
- [x] In the browser, verify every `[data-zone]` bottom is at or above the subtitle line.
- [x] Confirm the guide toggles with the person safe area and does not intercept pointer events.
