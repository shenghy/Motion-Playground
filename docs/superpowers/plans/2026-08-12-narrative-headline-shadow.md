# Narrative Headline Shadow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a soft 80%-opaque dark-gray shadow only to the two white narrative headline lines while preserving all other narrative text and animation behavior.

**Architecture:** Extend the shared Canvas `drawText` primitive with an optional shadow object whose state is isolated by the primitive's existing save/restore pair. Pass the approved shadow only from the two narrative headline calls so live preview and transparent export remain identical.

**Tech Stack:** TypeScript 6, Canvas 2D, Vitest 4, Vite 8

---

## File map

- Modify `src/export/canvas/primitives.ts`: add optional shadow settings to `TextOptions` and apply them inside `drawText`.
- Modify `src/export/canvas/primitives.test.ts`: prove shadow values are applied during text drawing and restored afterward.
- Modify `src/motion/canvas/narrativeRenderer.ts`: attach the approved shadow only to `line1` and `line2`.
- Modify `src/motion/canvas/narrativeRenderer.test.ts`: prove both headlines receive the shadow and non-headline text does not.

### Task 1: Add isolated Canvas text-shadow support

**Files:**
- Modify: `src/export/canvas/primitives.test.ts`
- Modify: `src/export/canvas/primitives.ts`

- [ ] **Step 1: Write the failing primitive test**

Extend the state captured by `recordingContext()` with Canvas shadow fields:

```ts
shadowColor: context.shadowColor,
shadowBlur: context.shadowBlur,
shadowOffsetX: context.shadowOffsetX,
shadowOffsetY: context.shadowOffsetY,
```

Initialize the fake context with neutral values:

```ts
shadowColor: 'rgba(0, 0, 0, 0)',
shadowBlur: 0,
shadowOffsetX: 0,
shadowOffsetY: 0,
```

Add a test that records the values active at `fillText` time:

```ts
it('applies optional text shadow only during the text draw', () => {
  const { context } = recordingContext()
  const activeShadows: Array<[string, number, number, number]> = []
  context.fillText = vi.fn(() => {
    activeShadows.push([
      context.shadowColor,
      context.shadowBlur,
      context.shadowOffsetX,
      context.shadowOffsetY,
    ])
  }) as unknown as CanvasRenderingContext2D['fillText']

  drawText(context, {
    text: '白色标题',
    x: 132,
    y: 250,
    font: '650 90px sans-serif',
    color: '#f1eee5',
    maxWidth: 720,
    shadow: {
      color: 'rgba(38, 40, 43, 0.8)',
      blur: 10,
      offsetX: 4,
      offsetY: 5,
    },
  })

  expect(activeShadows).toEqual([['rgba(38, 40, 43, 0.8)', 10, 4, 5]])
  expect(context.shadowColor).toBe('rgba(0, 0, 0, 0)')
  expect(context.shadowBlur).toBe(0)
  expect(context.shadowOffsetX).toBe(0)
  expect(context.shadowOffsetY).toBe(0)
})
```

- [ ] **Step 2: Run the primitive test and verify it fails**

Run:

```powershell
npm test -- --run src/export/canvas/primitives.test.ts
```

Expected: TypeScript/Vitest FAIL because `TextOptions` does not accept `shadow` and `drawText` does not apply Canvas shadow properties.

- [ ] **Step 3: Implement optional shadow settings**

Add this interface in `src/export/canvas/primitives.ts`:

```ts
interface TextShadowOptions {
  color: string
  blur: number
  offsetX: number
  offsetY: number
}
```

Add the optional property to `TextOptions`:

```ts
shadow?: TextShadowOptions
```

Inside `drawText`, after setting `ctx.filter` and before measuring or drawing, apply the option only when present:

```ts
if (options.shadow) {
  ctx.shadowColor = options.shadow.color
  ctx.shadowBlur = options.shadow.blur
  ctx.shadowOffsetX = options.shadow.offsetX
  ctx.shadowOffsetY = options.shadow.offsetY
}
```

Do not change `drawText` defaults. The existing `ctx.save()` / `ctx.restore()` pair provides state isolation.

- [ ] **Step 4: Run the primitive test and verify it passes**

Run:

```powershell
npm test -- --run src/export/canvas/primitives.test.ts
```

Expected: PASS, including the new shadow-isolation assertion.

### Task 2: Apply the approved shadow only to narrative headlines

**Files:**
- Modify: `src/motion/canvas/narrativeRenderer.test.ts`
- Modify: `src/motion/canvas/narrativeRenderer.ts`

- [ ] **Step 1: Write the failing narrative-scope test**

Extend each `textDraws` entry and its `fillText` recorder in `createContext()`:

```ts
shadowColor: string
shadowBlur: number
shadowOffsetX: number
shadowOffsetY: number
```

```ts
textDraws.push({
  text,
  font: context.font,
  x,
  y,
  maxWidth,
  shadowColor: context.shadowColor,
  shadowBlur: context.shadowBlur,
  shadowOffsetX: context.shadowOffsetX,
  shadowOffsetY: context.shadowOffsetY,
})
```

Initialize the fake context with the same neutral shadow values used by the primitive test. Add:

```ts
it('adds the approved shadow only to the two white headline lines', () => {
  const { ctx, textDraws } = createContext()
  renderNarrativeToCanvas({
    ctx,
    params,
    localTime: 2,
    resources: {
      width: 1920,
      height: 1080,
      displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono',
      contentFont: 'Noto Sans SC Variable',
    },
  })

  const headlineDraws = textDraws.filter(({ text }) => (
    text === params.line1 || text === params.line2
  ))
  const otherDraws = textDraws.filter(({ text }) => (
    text !== params.line1 && text !== params.line2
  ))

  expect(headlineDraws).toHaveLength(2)
  expect(headlineDraws.every((draw) => (
    draw.shadowColor === 'rgba(38, 40, 43, 0.8)'
      && draw.shadowBlur === 10
      && draw.shadowOffsetX === 4
      && draw.shadowOffsetY === 5
  ))).toBe(true)
  expect(otherDraws.every((draw) => (
    draw.shadowColor === 'rgba(0, 0, 0, 0)'
      && draw.shadowBlur === 0
      && draw.shadowOffsetX === 0
      && draw.shadowOffsetY === 0
  ))).toBe(true)
})
```

- [ ] **Step 2: Run the narrative test and verify it fails**

Run:

```powershell
npm test -- --run src/motion/canvas/narrativeRenderer.test.ts
```

Expected: FAIL because neither headline currently receives a shadow.

- [ ] **Step 3: Apply one shared approved shadow constant**

Add near the imports in `src/motion/canvas/narrativeRenderer.ts`:

```ts
const HEADLINE_SHADOW = {
  color: 'rgba(38, 40, 43, 0.8)',
  blur: 10,
  offsetX: 4,
  offsetY: 5,
} as const
```

Pass `shadow: HEADLINE_SHADOW` to only the `line1` and `line2` `drawText` calls. Do not pass it to the eyebrow or explanation calls.

- [ ] **Step 4: Run both focused test files**

Run:

```powershell
npm test -- --run src/export/canvas/primitives.test.ts src/motion/canvas/narrativeRenderer.test.ts
```

Expected: both files PASS; the existing headline entrance-blur and explanation-layout assertions remain green.

- [ ] **Step 5: Commit the implementation files**

```powershell
git add src/export/canvas/primitives.ts src/export/canvas/primitives.test.ts src/motion/canvas/narrativeRenderer.ts src/motion/canvas/narrativeRenderer.test.ts
git commit -m "feat: add shadow to narrative headlines"
```

### Task 3: Regression and visual verification

**Files:**
- Verify: `src/export/canvas/primitives.test.ts`
- Verify: `src/motion/canvas/narrativeRenderer.test.ts`
- Verify: `src/motion/rendererContract.test.ts`
- Verify: `src/export/canvas/CanvasExportSurface.test.ts`

- [ ] **Step 1: Run Canvas and motion regression tests**

Run:

```powershell
npm test -- --run src/export/canvas src/motion
```

Expected: all Canvas and motion tests PASS.

- [ ] **Step 2: Run the complete test suite**

Run:

```powershell
npm test -- --run
```

Expected: all tests PASS with zero failures.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm run build
```

Expected: TypeScript and Vite complete with exit code 0.

- [ ] **Step 4: Inspect the settled narrative frame**

Start the local app with `npm run dev`, select the narrative card, and wait until both title lines settle. Confirm:

- both white headline lines have a soft dark-gray shadow;
- the shadow improves separation from the video background without looking like an outline;
- the eyebrow, divider, and bottom explanation have no shadow;
- the title layout and entrance animation are unchanged;
- the browser console contains no warning or error.

- [ ] **Step 5: Commit only if visual verification required a targeted correction**

If a correction was necessary, stage only these files and commit it:

```powershell
git add src/export/canvas/primitives.ts src/export/canvas/primitives.test.ts src/motion/canvas/narrativeRenderer.ts src/motion/canvas/narrativeRenderer.test.ts
git commit -m "fix: refine narrative headline shadow"
```

If no correction was necessary, do not create an empty commit.
