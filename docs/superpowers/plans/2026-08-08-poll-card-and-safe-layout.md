# Poll Card and Safe Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the seven-step card left of the presenter-safe line, match the component rail to the parameter panel's gray hierarchy, and add an export-capable audience poll card.

**Architecture:** The new `audience-poll` motion follows the existing split between typed registry metadata, a deterministic shared state sampler, a React preview, and a Canvas renderer. Layout limits are expressed as CSS percentages for preview and matching 1920×1080 coordinates for export, with contract tests preventing future safe-line regressions.

**Tech Stack:** React 19, TypeScript, Motion, Canvas 2D, Vitest, React Testing Library, ESLint, Vite.

---

### Task 1: Lock the safe-line and panel-color contracts

**Files:**
- Modify: `src/layoutContract.test.ts`
- Modify: `src/styles.css`
- Modify: `src/motion/canvas/stepFlowRenderer.test.ts`
- Modify: `src/motion/canvas/stepFlowRenderer.ts`

- [ ] **Step 1: Write failing CSS and Canvas boundary tests**

Add assertions that require the presenter-safe CSS line to be `39%` (`x = 748.8` at 1920), both card previews to start at `6.35%`, use `31.8%` width, and end at `38.15%`. Require every step-flow Canvas drawing endpoint to remain left of the integer test threshold `x = 749`, with the panel ending at `x = 732` and horizontal rules at `x = 700`.

```ts
expect(css).toMatch(/\.presenter-safe-area\s*\{[^}]*left:\s*39%/s)
expect(css).toMatch(/\.step-flow__card\[data-pencil-layout='drawn-path'\]\s*\{[^}]*width:\s*31\.8%/s)
expect(css).toMatch(/\.component-rail\s*\{[^}]*background:\s*#24282d/s)
expect(css).toMatch(/\.rail-list\s*\{[^}]*background:\s*#1c2024/s)
expect(css).toMatch(/\.rail-footer\s*\{[^}]*background:\s*#202429/s)
expect(Math.max(...horizontalLineEnds)).toBeLessThan(749)
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- --run src/layoutContract.test.ts src/motion/canvas/stepFlowRenderer.test.ts`

Expected: FAIL because both cards still use `33%`, crossing the actual `39%` presenter-safe line, while the Canvas boundary assertions still use the older wider coordinates.

- [ ] **Step 3: Implement the narrow layout and gray rail**

Set the React step card to `width: 31.8%`, giving its `6.35%` left edge a `38.15%` right edge, shorten step rows to the available content width, and apply the right-panel gray hierarchy to `.component-rail`, `.rail-heading`, `.rail-list`, and `.rail-footer`. In the Canvas renderer, use a panel width of `610` so it ends at `x = 732`, and cap heading rules and row rules at `x = 700`.

```css
.component-rail { background: #24282d; }
.component-rail .rail-heading { background: #24282d; }
.rail-list { background: #1c2024; }
.rail-footer { background: #202429; }
.step-flow__card[data-pencil-layout='drawn-path'] { width: 31.8%; }
.step-flow__step { width: 100%; }
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- --run src/layoutContract.test.ts src/motion/canvas/stepFlowRenderer.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the safe-layout change**

```bash
git add src/layoutContract.test.ts src/styles.css src/motion/canvas/stepFlowRenderer.test.ts src/motion/canvas/stepFlowRenderer.ts
git commit -m "fix: keep step flow inside presenter safe line"
```

### Task 2: Register the audience poll data model

**Files:**
- Modify: `src/motion/types.ts`
- Modify: `src/motion/registry.ts`
- Modify: `src/components/ComponentRail.test.tsx`
- Create: `src/motion/AudiencePoll.test.tsx`

- [ ] **Step 1: Write failing registry and component-count tests**

Require `audience-poll` to be the eighth motion and expose the confirmed editable fields.

```ts
expect(MOTION_IDS.at(-1)).toBe('audience-poll')
expect(getMotionDefinition('audience-poll')).toMatchObject({
  index: '08',
  name: '投票卡片',
  defaults: {
    option1: expect.any(String),
    option2: expect.any(String),
    option3: expect.any(String),
    option4: '',
  },
})
expect(screen.getByText('8 个组件')).toBeInTheDocument()
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- --run src/components/ComponentRail.test.tsx src/motion/AudiencePoll.test.tsx`

Expected: FAIL because `audience-poll` is not registered.

- [ ] **Step 3: Add the type and registry definition**

Add the ID and parameter interface, then register the card with complete defaults and controls.

```ts
export interface AudiencePollParams extends ParameterValues {
  eyebrow: string
  title: string
  option1: string
  option2: string
  option3: string
  option4: string
  callToAction: string
  duration: number
}
```

Use defaults `08 / LIVE POLL`, `你更看好哪种开发方式？`, `AI 辅助开发`, `传统手写代码`, `两者结合`, an empty fourth option, `把编号打在弹幕或评论区，告诉我你的选择`, and `6.2` seconds. Text controls use lengths 24, 20, 16 per option, and 32 for the call to action; duration ranges from 4.8 to 10 seconds.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- --run src/components/ComponentRail.test.tsx src/motion/AudiencePoll.test.tsx`

Expected: PASS for registry and count assertions; preview-specific assertions remain for Task 3.

- [ ] **Step 5: Commit the registry change**

```bash
git add src/motion/types.ts src/motion/registry.ts src/components/ComponentRail.test.tsx src/motion/AudiencePoll.test.tsx
git commit -m "feat: register audience poll motion"
```

### Task 3: Build the deterministic poll preview

**Files:**
- Create: `src/motion/canvas/audiencePollState.ts`
- Create: `src/motion/canvas/audiencePollState.test.ts`
- Create: `src/motion/AudiencePoll.tsx`
- Modify: `src/motion/AudiencePoll.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing sampler and React tests**

Test blank filtering, four-option truncation, two-option fallback, deterministic option timing, left-primary markup, and the absence of right-side content.

```ts
expect(getAudiencePollState(params, 2).options.map((item) => item.label))
  .toEqual(['AI 辅助开发', '传统手写代码', '两者结合'])
expect(getAudiencePollState({ ...params, option1: '', option2: '', option3: '', option4: '' }, 2).options)
  .toHaveLength(2)
expect(screen.getByTestId('audience-poll-primary')).toHaveAttribute('data-zone', 'left-primary')
expect(screen.queryByTestId('audience-poll-secondary')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- --run src/motion/canvas/audiencePollState.test.ts src/motion/AudiencePoll.test.tsx`

Expected: FAIL because sampler and component do not exist.

- [ ] **Step 3: Implement the sampler and React component**

Create `getAudiencePollState(params, localTime)` using `sampleCycle`, `delayedProgress`, and `samplePencilEase`. Return `headerOpacity`, up to four `{ label, opacity, y, active }` items, and `callToActionOpacity`. Render the shared state through Motion values, with reduced-motion and explicit `playbackTime` support matching `Narrative.tsx`.

The DOM contract is:

```tsx
<section className="audience-poll__card" data-testid="audience-poll-primary" data-zone="left-primary">
  <span className="audience-poll__eyebrow">{params.eyebrow}</span>
  <h2>{params.title}</h2>
  <div className="audience-poll__options">...</div>
  <p className="audience-poll__cta">{params.callToAction}</p>
</section>
```

Style the card at `left: 6.35%`, `width: 31.8%`, ending at `38.15%` before the actual `39%` presenter-safe line, and above the subtitle-safe zone. Use Noto Sans SC and IBM Plex Mono, gray option borders, deep-blue active numbering, and no handwriting font.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- --run src/motion/canvas/audiencePollState.test.ts src/motion/AudiencePoll.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the preview**

```bash
git add src/motion/canvas/audiencePollState.ts src/motion/canvas/audiencePollState.test.ts src/motion/AudiencePoll.tsx src/motion/AudiencePoll.test.tsx src/styles.css
git commit -m "feat: add audience poll preview"
```

### Task 4: Add Canvas export parity

**Files:**
- Create: `src/motion/canvas/audiencePollRenderer.ts`
- Create: `src/motion/canvas/audiencePollRenderer.test.ts`
- Modify: `src/export/canvas/rendererRegistry.ts`
- Modify: `src/export/canvas/rendererRegistry.test.ts`
- Modify: `src/export/canvas/visualFixtures.ts`

- [ ] **Step 1: Write failing Canvas renderer tests**

Assert that all title, option, and call-to-action text is drawn; that every text right edge and line endpoint remains left of the actual integer safe threshold `x = 749`; that the panel ends at `x = 732` and rules at `x = 700`; and that the Canvas registry contains all eight IDs.

```ts
expect(drawnText).toEqual(expect.arrayContaining([
  params.title, params.option1, params.option2, params.option3, params.callToAction,
]))
expect(textRightEdges.every((right) => right < 749)).toBe(true)
expect(Object.keys(canvasRendererRegistry).sort()).toEqual([...MOTION_IDS].sort())
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- --run src/motion/canvas/audiencePollRenderer.test.ts src/export/canvas/rendererRegistry.test.ts`

Expected: FAIL because the renderer and registry entry do not exist.

- [ ] **Step 3: Implement and register the Canvas renderer**

Use `getAudiencePollState` and Canvas primitives. Draw a panel from `x = 122` through `x = 732`, preserving about 17px before the actual `x = 748.8` safe line. Cap internal horizontal rules at `x = 700`, shorten text maximum widths proportionally without reducing font sizes, keep up to four vertically stacked option boxes, and draw the call-to-action rule and text. Register the renderer under `'audience-poll'` and add fixture samples `[0.3, 1.4, 3.4, 6]`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- --run src/motion/canvas/audiencePollRenderer.test.ts src/export/canvas/rendererRegistry.test.ts src/export/canvas/registryCoverage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Canvas export support**

```bash
git add src/motion/canvas/audiencePollRenderer.ts src/motion/canvas/audiencePollRenderer.test.ts src/export/canvas/rendererRegistry.ts src/export/canvas/rendererRegistry.test.ts src/export/canvas/visualFixtures.ts
git commit -m "feat: export audience poll motion"
```

### Task 5: Preserve project and workspace compatibility

**Files:**
- Modify: `src/timeline/project.test.ts`
- Modify: `src/persistence/workspaceStorage.test.ts`
- Modify: `src/components/Workbench.test.tsx`

- [ ] **Step 1: Write failing compatibility assertions**

Add an `audience-poll` default entry to typed fixtures, assert a saved poll round-trips without losing options, and assert an older seven-motion project is normalized without rejecting its cards.

```ts
expect(restored.parametersByMotion['audience-poll']).toMatchObject({
  option1: 'AI 辅助开发',
  option4: '',
})
expect(normalized.cards.every((card) => isMotionId(card.motionId))).toBe(true)
```

- [ ] **Step 2: Run compatibility tests and verify RED**

Run: `npm test -- --run src/timeline/project.test.ts src/persistence/workspaceStorage.test.ts`

Expected: FAIL until all exhaustive motion fixtures and defaults include the new ID.

- [ ] **Step 3: Update exhaustive fixtures and normalization expectations**

Add `{ ...getMotionDefinition('audience-poll').defaults }` wherever tests construct a complete `Record<MotionId, ParameterValues>`. Preserve the existing normalization implementation unless a failing behavioral assertion proves a production change is required.

- [ ] **Step 4: Run compatibility tests and verify GREEN**

Run: `npm test -- --run src/timeline/project.test.ts src/persistence/workspaceStorage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit compatibility coverage**

```bash
git add src/timeline/project.test.ts src/persistence/workspaceStorage.test.ts src/components/Workbench.test.tsx
git commit -m "test: cover audience poll compatibility"
```

### Task 6: Verify the complete feature in code and browser

**Files:**
- Modify only if verification reveals a reproducible defect, with a failing test first.

- [ ] **Step 1: Run the complete automated verification**

Run:

```bash
npm test -- --run
npm run lint
npm run build
```

Expected: all tests pass, ESLint exits 0, and Vite production build exits 0. The existing large-chunk warning is informational.

- [ ] **Step 2: Verify in the browser**

Start the local app and verify both “步骤流程” and “投票卡片” at the real preview size. Confirm the rightmost card bound is left of the presenter-safe line, the rail gray matches the parameter panel hierarchy, the poll exposes all editable fields, two through four options render correctly, and the browser console has no errors or warnings.

- [ ] **Step 3: Request a focused code review**

Review the diff for safe-line parity, React/Canvas timing parity, exhaustive `MotionId` coverage, persistence compatibility, and accidental right-side content. Resolve every Critical or Important finding through a failing regression test.

- [ ] **Step 4: Commit any verification fixes and confirm a clean master**

```bash
git status --short
git branch --show-current
```

Expected: `master` and a clean working tree.
