# Motion Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished React + TypeScript + Vite motion-component workbench with three configurable, looping 1920×1080 previews.

**Architecture:** A registry maps each component ID to typed defaults, metadata, controls, and renderer. `Workbench` owns active parameters and playback keys; motion components stay presentation-only and remount when playback restarts. Shared controls and a stage shell provide consistent behavior without inventing a general animation engine.

**Tech Stack:** React 19, TypeScript, Vite, Motion for React, Vitest, React Testing Library, CSS.

---

## File map

- `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `index.html`: build, lint, and test foundation.
- `src/motion/types.ts`: parameter and registry contracts.
- `src/motion/registry.tsx`: component metadata, defaults, and renderer mapping.
- `src/motion/useCountUp.ts`: reusable requestAnimationFrame number interpolation.
- `src/motion/MetricFocus.tsx`: core metric composition.
- `src/motion/CompareSplit.tsx`: comparison composition.
- `src/motion/QuoteLockup.tsx`: quote composition.
- `src/components/ParameterPanel.tsx`: typed controls and actions.
- `src/components/ComponentRail.tsx`: component navigation.
- `src/components/PreviewStage.tsx`: scaled 1920×1080 stage.
- `src/components/Workbench.tsx`: application state and orchestration.
- `src/styles.css`: Precision Monolith visual system and motion.
- `src/test/setup.ts`, `src/**/*.test.tsx`: behavior tests.

### Task 1: Scaffold the Vite testable foundation

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`
- Create: `src/main.tsx`, `src/App.tsx`, `src/test/setup.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

it('renders the motion playground shell', () => {
  render(<App />)
  expect(screen.getByText('MOTION PLAYGROUND')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run `npm test -- --run` and verify it fails because the project is not scaffolded**

- [ ] **Step 3: Add Vite/React scripts and dependencies**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "test": "vitest"
  },
  "dependencies": {
    "@fontsource-variable/ibm-plex-mono": "^5.2.6",
    "@fontsource-variable/space-grotesk": "^5.2.8",
    "motion": "^12.23.11",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  }
}
```

- [ ] **Step 4: Create a minimal `App` that renders the shell label, then install and run the test**

- [ ] **Step 5: Commit with `chore: scaffold vite motion playground`**

### Task 2: Define typed registry and parameter controls

**Files:**
- Create: `src/motion/types.ts`
- Create: `src/motion/registry.tsx`
- Create: `src/components/ParameterPanel.tsx`
- Test: `src/components/ParameterPanel.test.tsx`

- [ ] **Step 1: Test that text and range controls call `onChange`, and reset/replay actions are exposed**

```tsx
render(<ParameterPanel controls={controls} values={values} onChange={onChange}
  onReset={onReset} onReplay={onReplay} />)
fireEvent.change(screen.getByLabelText('核心数值'), { target: { value: '320' } })
expect(onChange).toHaveBeenCalledWith('value', 320)
fireEvent.click(screen.getByRole('button', { name: '重新播放' }))
expect(onReplay).toHaveBeenCalled()
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

- [ ] **Step 3: Define `MotionId`, component parameter interfaces, discriminated control types, and `MotionDefinition`**

```ts
export type MotionId = 'metric-focus' | 'compare-split' | 'quote-lockup'
export type Control =
  | { type: 'text'; key: string; label: string; maxLength: number }
  | { type: 'number'; key: string; label: string; min: number; max: number; step: number }
  | { type: 'select'; key: string; label: string; options: { label: string; value: string }[] }
```

- [ ] **Step 4: Implement accessible text, number/range, and select controls plus action buttons**

- [ ] **Step 5: Run the focused test and commit with `feat: add typed motion controls`**

### Task 3: Build MetricFocus with deterministic counting

**Files:**
- Create: `src/motion/useCountUp.ts`
- Create: `src/motion/MetricFocus.tsx`
- Test: `src/motion/MetricFocus.test.tsx`

- [ ] **Step 1: Test its semantic labels and final value under reduced motion**

```tsx
render(<MetricFocus params={metricDefaults} />)
expect(screen.getByText('QUARTERLY GROWTH')).toBeInTheDocument()
expect(screen.getByLabelText('核心指标 +248%')).toBeInTheDocument()
```

- [ ] **Step 2: Run the test and verify it fails**

- [ ] **Step 3: Implement a clamped requestAnimationFrame counter with immediate final-state support**

- [ ] **Step 4: Implement line scan, count-up, staggered unit/trend entry, and lock pulse with Motion**

- [ ] **Step 5: Run the test and commit with `feat: add metric focus motion`**

### Task 4: Build CompareSplit

**Files:**
- Create: `src/motion/CompareSplit.tsx`
- Test: `src/motion/CompareSplit.test.tsx`

- [ ] **Step 1: Test both comparison values, labels, conclusion, and emphasized-side marker**

```tsx
render(<CompareSplit params={compareDefaults} />)
expect(screen.getByText('BEFORE')).toBeInTheDocument()
expect(screen.getByText('AFTER')).toBeInTheDocument()
expect(screen.getByText('2.05× IMPROVEMENT')).toBeInTheDocument()
expect(screen.getByTestId('compare-right')).toHaveAttribute('data-emphasized', 'true')
```

- [ ] **Step 2: Verify failure, then implement the center cut, opposing reveals, count-ups, and emphasis lock**

- [ ] **Step 3: Run the focused test and commit with `feat: add compare split motion`**

### Task 5: Build QuoteLockup

**Files:**
- Create: `src/motion/QuoteLockup.tsx`
- Test: `src/motion/QuoteLockup.test.tsx`

- [ ] **Step 1: Test Chinese quote, author metadata, alignment, and width style**

```tsx
render(<QuoteLockup params={quoteDefaults} />)
const quote = screen.getByText('真正的效率，不是做得更快，而是更少地做错。')
expect(quote).toHaveStyle({ maxWidth: '1180px', textAlign: 'left' })
expect(screen.getByText('JSPANG')).toBeInTheDocument()
```

- [ ] **Step 2: Verify failure, then implement guide marks, line reveal, highlight sweep, and author lockup**

- [ ] **Step 3: Run the focused test and commit with `feat: add quote lockup motion`**

### Task 6: Assemble and polish the workbench

**Files:**
- Create: `src/components/ComponentRail.tsx`
- Create: `src/components/PreviewStage.tsx`
- Create: `src/components/Workbench.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`
- Create: `src/styles.css`
- Test: `src/components/Workbench.test.tsx`

- [ ] **Step 1: Test default selection, switching, live parameter changes, replay remount, and scoped reset**

```tsx
render(<Workbench />)
expect(screen.getByRole('button', { name: /MetricFocus/ })).toHaveAttribute('aria-pressed', 'true')
fireEvent.click(screen.getByRole('button', { name: /CompareSplit/ }))
expect(screen.getByText('2.05× IMPROVEMENT')).toBeInTheDocument()
expect(screen.getByText('1920 × 1080')).toBeInTheDocument()
```

- [ ] **Step 2: Verify failure, then implement rail, stage, state map, playback keys, live updates, and reset**

- [ ] **Step 3: Implement Precision Monolith CSS: fixed header, 220px rail, fluid 16:9 stage, 310px controls, hairlines, minimal cold-white feedback, no decorative shadows**

- [ ] **Step 4: Add reduced-motion rules, keyboard focus, minimum desktop workspace width, safe-area markers, and empty-text fallbacks**

- [ ] **Step 5: Run all tests and commit with `feat: assemble motion component workbench`**

### Task 7: Final verification

**Files:**
- Modify only files required by discovered defects.

- [ ] **Step 1: Run `npm test -- --run` and require all tests to pass**
- [ ] **Step 2: Run `npm run lint` and require zero errors**
- [ ] **Step 3: Run `npm run build` and require a successful production bundle**
- [ ] **Step 4: Start Vite, verify the page returns HTTP 200, and inspect the workbench in a desktop browser**
- [ ] **Step 5: Check all three components, parameter changes, replay, reset, 16:9 scaling, and visible overflow**
- [ ] **Step 6: Commit any verification fixes with `fix: polish motion playground preview`**
