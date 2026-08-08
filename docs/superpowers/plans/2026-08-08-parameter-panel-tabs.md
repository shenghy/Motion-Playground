# Parameter Panel Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the component rail scrollbars, widen the right panel by 150px, and reorganize the parameter panel into accessible Card Properties, Import/Export, and Workspace tabs.

**Architecture:** Keep project data and the existing `ParameterPanel` public props unchanged. Add local presentation-only tab state inside `ParameterPanel`, reuse the existing export/project/video/workspace child sections in new tab panels, and enforce the widened three-column workspace plus hidden rail scrollbars through CSS contracts.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, CSS Grid

---

### Task 1: Add accessible parameter-panel tabs

**Files:**
- Modify: `src/components/ParameterPanel.tsx`
- Modify: `src/components/ParameterPanel.test.tsx`

- [ ] **Step 1: Write failing grouping and keyboard tests**

Add a reusable render helper that supplies `exportControls`, video callbacks, project callbacks, and workspace callbacks. Assert that the default selected tab is `卡片属性`, that only its panel is visible, and that the other groups become visible after their tabs are clicked. Add a keyboard test that focuses the first tab, presses `ArrowRight`, and expects `导入导出` to become selected.

```tsx
expect(screen.getByRole('tab', { name: '卡片属性' })).toHaveAttribute(
  'aria-selected',
  'true',
)
expect(screen.getByRole('tabpanel', { name: '卡片属性' })).toBeVisible()
expect(screen.queryByLabelText('视频背景')).not.toBeInTheDocument()

fireEvent.click(screen.getByRole('tab', { name: '导入导出' }))
expect(screen.getByLabelText('视频背景')).toBeInTheDocument()
expect(screen.getByLabelText('项目文件')).toBeInTheDocument()

fireEvent.keyDown(screen.getByRole('tab', { name: '卡片属性' }), {
  key: 'ArrowRight',
})
expect(screen.getByRole('tab', { name: '导入导出' })).toHaveFocus()
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```powershell
npm test -- --run src/components/ParameterPanel.test.tsx
```

Expected: FAIL because the `tablist`, `tab`, and `tabpanel` roles do not exist.

- [ ] **Step 3: Implement local tab state and semantic panels**

Define the tab model and local state inside `ParameterPanel.tsx`:

```tsx
type ParameterTab = 'properties' | 'transfer' | 'workspace'

const parameterTabs = [
  { id: 'properties', label: '卡片属性' },
  { id: 'transfer', label: '导入导出' },
  { id: 'workspace', label: '工作区' },
] as const

const [activeTab, setActiveTab] = useState<ParameterTab>('properties')
```

Render a `role="tablist"` beneath the heading. Each tab must set `id`, `aria-controls`, `aria-selected`, and `tabIndex`. Implement `ArrowLeft`, `ArrowRight`, `Home`, and `End` navigation by updating state and focusing the destination tab through a small `useRef` map.

Group content exactly as follows:

```text
properties: preview-setting + controls + fixed reset/replay actions
transfer: exportControls + ProjectFileControls + video-setting
workspace: workspace-danger-zone
```

Use one mounted `tabpanel` at a time so hidden tabs do not expose duplicate controls to assistive technology. Keep all existing callback and disabled-state behavior unchanged.

- [ ] **Step 4: Run the focused tests and confirm GREEN**

Run:

```powershell
npm test -- --run src/components/ParameterPanel.test.tsx src/components/Workbench.test.tsx
```

Expected: PASS with existing parameter and persistence behavior preserved.

- [ ] **Step 5: Commit the tab implementation**

```powershell
git add src/components/ParameterPanel.tsx src/components/ParameterPanel.test.tsx
git commit -m "feat: organize parameter controls into tabs"
```

### Task 2: Widen and restyle the parameter panel

**Files:**
- Modify: `src/styles.css`
- Create: `src/layoutContract.test.ts`

- [ ] **Step 1: Write a failing CSS contract test**

Read `src/styles.css` as text and assert the required stable contracts:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const css = readFileSync(
  fileURLToPath(new URL('./styles.css', import.meta.url)),
  'utf8',
)

expect(css).toContain('clamp(420px, 30vw, 470px)')
expect(css).toMatch(/\.rail-list\s*\{[^}]*overflow-x:\s*hidden/s)
expect(css).toMatch(/\.rail-list::-webkit-scrollbar\s*\{[^}]*display:\s*none/s)
expect(css).toContain('.parameter-tabs')
expect(css).toContain('.parameter-tab[aria-selected=\'true\']')
```

- [ ] **Step 2: Run the contract test and confirm RED**

Run:

```powershell
npm test -- --run src/layoutContract.test.ts
```

Expected: FAIL because the width, scrollbar, and tab style contracts are absent.

- [ ] **Step 3: Implement width and scrollbar rules**

Update the default workspace grid to:

```css
.workspace {
  grid-template-columns:
    clamp(196px, 17vw, 258px)
    minmax(0, 1fr)
    clamp(420px, 30vw, 470px);
}

.rail-list {
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.rail-list::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
```

Set the 1400px breakpoint right column to `434px`, and retain a compact `320px` right column at the 1120px breakpoint so the preview remains usable.

- [ ] **Step 4: Implement the deep-gray tabbed panel hierarchy**

Change the panel shell to a deep graphite background and add styles for `.parameter-tabs`, `.parameter-tab`, `.parameter-tab[aria-selected='true']`, and `.parameter-tabpanel`. Use `#24282d` / `#1c2024` layers, the existing `--motion-accent-blue` token for the active tab, and avoid thick outer card borders.

Increase typography to these minimum targets:

```text
panel heading: 18px
tab labels: 12px
field labels, values, buttons: 12px
descriptions and counters: 10px
```

Keep `.panel-actions` inside the Properties panel and make it sticky at the bottom of that panel. Allow each tab panel to scroll vertically with a thin, unobtrusive scrollbar.

- [ ] **Step 5: Run layout and component tests**

Run:

```powershell
npm test -- --run src/layoutContract.test.ts src/components/ParameterPanel.test.tsx src/components/ComponentRail.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the layout refresh**

```powershell
git add src/styles.css src/layoutContract.test.ts
git commit -m "feat: widen and restyle parameter workspace"
```

### Task 3: Verify behavior and visual quality

**Files:**
- Modify only if verification reveals a regression in files already listed above.

- [ ] **Step 1: Run the complete automated gate**

Run:

```powershell
npm test -- --run
npm run lint
npm run build
git diff --check
```

Expected: all tests pass, ESLint exits 0, Vite production build exits 0, and `git diff --check` reports no whitespace errors.

- [ ] **Step 2: Inspect the application in a real browser**

Start Vite on an available localhost port and inspect these states:

```text
1. Hover and wheel through the left component rail: no scrollbar is visible and all seven cards remain reachable.
2. Confirm the desktop right panel is 420–470px wide and visibly larger than before.
3. Switch among all three tabs and verify only the expected group is present.
4. Confirm labels, descriptions, controls, and buttons are readable at the larger sizes.
5. Resize to the 1400px and 1120px breakpoints and confirm the preview remains usable.
6. Confirm the browser console contains no application errors or warnings.
```

- [ ] **Step 3: Request final code review**

Review the range from `df3fe4a` to the final implementation commit for tab accessibility, feature preservation, layout regressions, and CSS specificity conflicts. Fix every Critical or Important issue and rerun Step 1.

- [ ] **Step 4: Confirm master is clean**

Run:

```powershell
git status --short --branch
```

Expected: `## master` with no modified or untracked project files.
