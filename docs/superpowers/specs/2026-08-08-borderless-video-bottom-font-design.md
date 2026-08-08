# 无外框动效、贴底播放控制与开源字体设计

## 目标

统一改造 Overlay Studio 的视频预览与透明导出视觉：删除所有动效自身的大外框，将播放按钮和进度条移动到视频最底边，隐藏可见字幕安全区占位，并把全部动效文字从手写字体切换到可商用开源字体。

## 已确认方案

- 视频底部采用用户选择的 A 方案：贴底渐隐控制条。
- 编辑状态下的选中特效虚线框保留，作为拖动定位反馈。
- 编辑选中框不属于动效内容，Canvas/PNG/MOV 导出中不得出现。
- 动效字体统一使用 `Noto Sans SC`。当前 npm 包 `@fontsource-variable/noto-sans-sc` 为 5.3.0，许可证为 OFL-1.1。

## 动效外框

删除的是视频中动效组件的最外层容器边框，不删除表达数据关系的内部结构。

删除范围：

- 核心指标的主框和角标外框。
- 对比卡片的两侧大面板外框与底部结论大框。
- 人物信息的主卡片外框与右侧状态大框。
- 柱状对比、环形占比、步骤流程的主卡片外框与右侧结果大框。
- React 预览和 Canvas 导出的对应 `stroke` / `strokeRect` 绘制。

保留范围：

- 柱形、圆环、流程线、刻度、短分隔线、勾选符号等内部信息结构。
- 工作台中 `.overlay-card--selected` 的编辑虚线与角标。
- 预览画布本身的工作台边界；它不是视频导出的动效卡片边框。

## 视频底部

播放控制条固定在 `.preview-canvas` 最底边：

- `bottom: 0`，左右保留轻微内缩。
- 移除控制条完整边框和厚重实色面板。
- 使用自下而上的轻微黑色渐隐，保证按钮和进度条可读。
- 保持播放、暂停、拖动进度、时间显示和静音功能不变。
- 控制条仍是预览 UI，不进入透明导出。

字幕安全区继续使用 `--subtitle-safe-bottom: 13.8889%` 约束动效的重要内容，避免和后期字幕冲突；但 `.subtitle-safe-area` 不再绘制虚线、标签或渐变背景。人物安全区仍可通过工作台开关显示。

## 字体

新增 `@fontsource-variable/noto-sans-sc`，建立统一的动效内容字体栈：

- 浏览器：`Noto Sans SC Variable, sans-serif`。
- Canvas 主线程：`Noto Sans SC Variable, sans-serif`。
- Worker：加载 Noto Sans SC 字体资源并使用 `Noto Sans SC Worker, sans-serif`。

为消除手写语义和误用风险：

- React 动效中的 `motion-handwriting` 改为 `motion-content-text`。
- 删除动效节点上的 `data-handwritten` 标记。
- Canvas 资源字段 `handwritingFont` 改名为 `contentFont`。
- 所有 Canvas renderer 改用 `contentFont`。
- Syne 和 IBM Plex Mono 仍用于数字、英文眉题和技术标注；其中文回退改为 Noto Sans SC，不再回退到 Microsoft YaHei、KaiTi 或 STKaiti。

项目中现有 Ma Shan Zheng 文件可暂时保留，避免扩大删除范围；本次完成后，视频动效与导出链路不再引用它。

## 文件边界

- `src/styles.css`：贴底控制条、隐藏字幕安全区、无外框 React 样式和新字体变量。
- `src/motion/*.tsx`：替换手写类名和语义标记。
- `src/motion/canvas/*Renderer.ts`：删除外层面板描边并切换 `contentFont`。
- `src/export/canvas/types.ts`、`CanvasExportSurface.ts`：Canvas 字体资源字段。
- `src/export/worker/fontAssets.ts`、`fonts.ts`：Worker 字体加载与返回值。
- `src/main.tsx`、`package.json`、`package-lock.json`：Noto Sans SC 依赖和浏览器字体导入。

## 验证

- CSS/组件测试确认控制条贴底、无完整边框，字幕安全区节点不可见但安全区变量仍存在。
- React 动效测试确认不再出现 `data-handwritten`，统一使用 `motion-content-text`。
- Canvas renderer 测试确认外层面板不再使用描边，同时内部结构仍绘制。
- Worker 字体测试确认 Noto Sans SC 被加载，返回 `contentFont`，不再出现 Ma Shan Zheng、KaiTi、STKaiti 或 Microsoft YaHei 回退。
- 浏览器实际检查播放控制条位于画布底边，安全区标签不可见，动效外框消失。
- 执行完整测试、Lint、生产构建和 `git diff --check`。

## 范围外

- 不删除编辑选中虚线框。
- 不改变字幕安全区高度或透明导出规格。
- 不重做时间轴片段卡片、工作台侧栏卡片或参数面板边框。
- 不改变视频播放、拖动、静音和导出业务逻辑。
