# Motion Playground

Motion Playground（界面名 Overlay Studio）是一个本地运行的透明动效编辑器。它把动效卡片编排到视频时间轴上，并导出仅包含动效层的 PNG 序列或 ProRes 4444 Alpha 视频，便于叠加到剪映、Premiere Pro、DaVinci Resolve 或 Final Cut Pro。

## 核心能力

- 8 种可参数化动效卡片，支持时间、位置、层级与内容编辑。
- 项目和视频保存在浏览器本地，可导入、导出项目 JSON。
- Canvas 与 Worker 使用同一套渲染器，透明 MOV 导出带 ROI、RLE 和流水线优化。
- 导出过程可取消；已编码但保存失败的 MOV 可以直接重试保存。

## 安装与启动

运行要求：Windows 10/11、Node.js 22 LTS（含 npm），推荐最新版 Chrome 或 Edge。

最简单的启动方式是双击根目录的 `启动 Overlay Studio.bat`。脚本会在缺少依赖时自动安装、执行生产构建、寻找 `4173` 至 `4192` 的可用端口，并打开默认浏览器。启动窗口必须保持打开。

也可以从 PowerShell 启动：

```powershell
npm ci
npm run start:local
```

仅进行前端开发、不启用透明 MOV 本地编码服务时：

```powershell
npm run dev
```

## 基本使用

1. 导入本地视频。
2. 从左侧组件栏添加动效卡片。
3. 在时间轴调整出现时间和时长，在预览区调整位置，在参数面板修改内容。
4. 保存项目 JSON，或从右侧导出透明动效层。

浏览器本地数据不是跨设备备份。重要工程请同时导出项目 JSON。

## 透明视频导出

透明导出的固定质量契约为：

- `1920 × 1080`
- `30 fps`
- 仅包含动效卡片，不包含原视频画面或声音
- MOV 使用 `ProRes 4444` 和 Alpha 通道
- PNG 序列保留逐帧 Alpha

透明 MOV 必须通过 `启动 Overlay Studio.bat` 或 `npm run start:local` 启动，因为 FFmpeg 编码和高速帧传输由本地服务提供。浏览器支持时优先使用 Worker 流水线；不支持时自动回退到主线程渲染，输出规格和画质不变。

## 验证

提交代码前运行：

```powershell
npm test -- --run
npm run test:visual
npm run lint
npm run build
```

验证真实的 300 帧 Worker 透明 MOV 导出：

```powershell
node scripts/run-worker-export-benchmark.mjs short
```

该基准还会检查所有动效在参数上下限、四角位置下的 ROI 覆盖，以及 HTML Canvas 与 Worker Canvas 的像素一致性。

## 故障排查

- 提示找不到 Node.js 或 npm：安装 Node.js 22 LTS，重新打开终端后确认 `node --version` 和 `npm --version` 可用。
- 启动后没有打开网页：查看启动窗口给出的实际地址，手动在 Chrome 或 Edge 打开。
- 端口被占用：启动器会自动尝试 `4173` 至 `4192`；若全部占用，请停止对应进程后重试。
- “导出透明 MOV”不可用：确认使用本地启动器而不是 `npm run dev`，并保持启动窗口开启。
- 浏览器不能选择保存位置：更新 Chrome/Edge，或改用 PNG 序列；部分浏览器不支持 File System Access API。
- 构建或测试出现依赖异常：删除 `node_modules` 后执行 `npm ci`，不要手工升级单个包；依赖版本由 `package-lock.json` 锁定。

更多启动细节见 [本地启动说明.md](./本地启动说明.md)。
