# Motion Playground 工程强化设计

## 目标

在不改变编辑器交互、项目格式和透明 MOV 质量契约的前提下，完成三项改进：降低 `Workbench` 的职责密度；让 ROI 边界覆盖极端合法参数和位置偏移；建立可复现的安装、文档与 Windows CI 基线。

## 1. Workbench 边界

保留 `Workbench` 作为页面协调入口，但把可独立理解的职责移出：纯工程模型与快照函数进入 `workbenchModel.ts`；透明导出生命周期进入 `useWorkbenchExport.ts`；页面 JSX 与属性映射进入 `WorkbenchView.tsx`。现有领域状态 hooks 保持不变，避免一次性重写状态模型。结构门禁要求 `Workbench.tsx` 不超过 950 行，且现有交互测试保持通过。

## 2. ROI 质量门禁

新增由注册表 controls 自动生成的极端合法参数：文本填满 `maxLength`、数字覆盖最小值和最大值、选择覆盖首尾选项。浏览器门禁用默认、最小和最大参数，并覆盖四个方向的位置偏移；每个样本以 `session.frameBounds()` 作为位置修正后的预测边界，再与真实 Alpha 包围盒比较。任何可见像素越界都直接失败。编码参数、ROI 协议和 ProRes 输出不变。

## 3. 可复现交付

新增根目录 `README.md`，覆盖安装、启动、项目文件、透明导出、验证和故障排查。把所有 `latest` 依赖替换为当前 lockfile 中的精确版本，仍由 `package-lock.json` 锁定完整依赖树。新增 Windows GitHub Actions，使用 `npm ci` 后依次执行测试、视觉测试、Lint 和构建；CI 不运行耗时的长视频基准，真实 FFmpeg 集成测试继续由 Vitest 覆盖。

## 验收

- 编辑器现有测试全部通过，`Workbench.tsx` 小于等于 950 行。
- ROI 极端参数生成器有单元测试，真实浏览器门禁覆盖默认/最小/最大与位置偏移。
- `package.json` 不再包含 `latest`，`npm ci` 可重建环境。
- Windows CI 配置、README、全量测试、视觉测试、Lint、构建和真实 FFmpeg 集成测试全部通过。
