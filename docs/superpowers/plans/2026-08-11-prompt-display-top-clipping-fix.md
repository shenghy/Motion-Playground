# AI 提示词卡片首行顶部裁切修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `prompt-display` 正文增加 8px 顶部安全间距，避免第一行中文笔画被裁切。

**Architecture:** 保持现有 `CONTENT` 裁切矩形不变，在裁切区域内部定义正文起点 `CONTENT.y + 8`。所有正文行和打字光标共享该起点；自动滚动继续使用现有行高和可见行数。

**Tech Stack:** TypeScript、Canvas 2D、Vitest

---

### Task 1: 建立首行顶部安全间距失败测试

**Files:**
- Modify: `src/motion/canvas/promptDisplayRenderer.test.ts`
- Test: `src/motion/canvas/promptDisplayRenderer.test.ts`

- [ ] **Step 1: 添加首行绘制坐标断言**

在现有渲染器测试中筛选 `42px` 正文字形记录，并断言最小 `y` 坐标为 `204`，即裁切顶部 `196 + 8`。

```ts
const bodyRecords = records.filter(({ font }) => /\b42px\b/.test(font))
expect(Math.min(...bodyRecords.map(({ y }) => y))).toBe(204)
```

- [ ] **Step 2: 运行专项测试确认 RED**

Run:

```powershell
npm test -- --run src/motion/canvas/promptDisplayRenderer.test.ts
```

Expected: 当前最小正文 `y` 为 `196`，断言期望 `204`，测试失败。

### Task 2: 实现 8px 顶部安全间距

**Files:**
- Modify: `src/motion/canvas/promptDisplayRenderer.ts`
- Test: `src/motion/canvas/promptDisplayRenderer.test.ts`

- [ ] **Step 1: 定义正文顶部偏移**

在布局常量旁加入：

```ts
const CONTENT_TOP_PADDING = 8
const BODY_START_Y = CONTENT.y + CONTENT_TOP_PADDING
```

- [ ] **Step 2: 统一正文与光标起点**

把 `cursorY` 初值和每行 `y` 的基准从 `CONTENT.y` 改为 `BODY_START_Y`：

```ts
let cursorY: number = BODY_START_Y
const y = BODY_START_Y + lineIndex * LINE_HEIGHT
```

不修改裁切矩形、行高、字号和滚动偏移。

- [ ] **Step 3: 运行专项测试确认 GREEN**

Run the renderer, layout and state tests; expected all pass.

### Task 3: 回归验证

**Files:**
- Verify: `src/motion/canvas/promptDisplayRenderer.ts`
- Verify: `src/motion/canvas/promptDisplayRenderer.test.ts`

- [ ] **Step 1: 运行视觉测试**

```powershell
npm run test:visual
```

Expected: all visual contract tests pass.

- [ ] **Step 2: 运行全量测试、Lint 和构建**

```powershell
npm test -- --run
npm run lint
npm run build
```

Expected: all commands exit with code `0`.

- [ ] **Step 3: 检查补丁格式**

```powershell
git diff --check
```

Expected: no output.

