# “字幕特效”Skill 设计

## 目标

创建一个可直接调用的本地 Codex Skill。用户提供 SRT 字幕文件后，Skill 智能筛选适合视觉强化的重点内容，生成能够被 Overlay Studio 直接导入的 JSON 项目文件。

第一版不修改 Overlay Studio，不把每条字幕机械地转换为卡片，也不生成视频。交付物只包含 Skill、确定性的辅助脚本和验证用例。

## 名称与触发方式

- Skill 内部名称：`subtitle-effects`
- 中文显示名称：`字幕特效`
- 典型触发语句：
  - “使用字幕特效，把这个 SRT 生成 JSON。”
  - “根据字幕生成 Overlay Studio 特效项目。”
  - “分析这个 SRT，挑重点句制作动效卡。”

## 输入与输出

输入为一个 UTF-8、UTF-8 BOM 或常见中文编码的 `.srt` 文件。字幕必须包含序号、起止时间码和文本；多行字幕合并为一个语义单元。

输出为一个 UTF-8 JSON 文件，默认保存到 SRT 同目录，文件名为 `<原文件名>-字幕特效.json`。根结构严格为：

```json
{
  "version": 1,
  "canvas": { "width": 1920, "height": 1080 },
  "cards": []
}
```

每张卡片必须包含唯一 `id`、有效 `motionId`、`start`、`end`、`position`、`zIndex` 和该组件完整的 `params`。生成后必须通过与 Overlay Studio 当前导入规则等价的校验。

## 智能选句与组件匹配

Skill 只选择有独立信息价值、适合视觉强调的字幕。普通衔接句、口头语、重复表达和信息不完整的短句不生成卡片。相邻字幕共同表达一个信息时，先合并再生成一张卡。

组件匹配规则：

| 字幕语义 | Overlay Studio 组件 |
| --- | --- |
| 单个关键数字、增长率、金额或结果 | `metric-focus` |
| 两个对象、前后变化、优劣对照 | `compare-split` |
| 人物身份、背景、三条人物事实 | `profile-reveal` |
| 三到四项数值对比 | `bar-compare` |
| 构成、份额、比例分布 | `share-ring` |
| 三到五个连续步骤或流程 | `step-flow` |

无法可靠提取组件所需信息时跳过，不编造数据。数字、名称和结论只能来自字幕文字；允许压缩措辞，但不得改变原意。

## 时间、位置与画面安全

- 卡片开始时间取对应重点字幕组的首条开始时间。
- 卡片结束时间取该字幕组末条结束时间，并保证持续时间不少于 Overlay Studio 要求的 `0.2` 秒。
- 允许多个语义相关组件在时间上重叠，但默认避免无意义的卡片堆叠。
- 默认位置使用 `{ "x": 0, "y": 0 }`，沿用现有组件的左侧布局，避开画面中间偏右的人物。
- 组件内容不得侵入现有底部 150px 字幕安全区。
- `zIndex` 按生成顺序递增，保证结果稳定可复现。

## Skill 结构

安装目录为 `C:\Users\Administrator\.codex\skills\subtitle-effects`：

```text
subtitle-effects/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
│   ├── parse_srt.py
│   └── validate_project.py
└── references/
    └── overlay-studio-schema.md
```

`SKILL.md` 负责触发条件、语义选择、组件匹配和端到端操作流程。`parse_srt.py` 负责可靠解析字幕并输出标准化语义单元。`validate_project.py` 负责对最终 JSON 做确定性验证。详细组件参数和默认值放在 schema 参考文件，避免主说明过长。

## 处理流程

1. 解析 SRT，并报告无法识别的时间码或空字幕。
2. 阅读标准化字幕，筛选重点语义组。
3. 根据语义选择最匹配的组件，并从字幕中提取参数。
4. 使用 Overlay Studio 当前默认参数补全每张卡片。
5. 写入 JSON 文件。
6. 运行校验器；校验失败时修正并重新验证，不交付无效文件。
7. 向用户报告输出路径、卡片数量、组件分布和被跳过内容的简要原因。

## 错误处理

- 文件不存在或无法解码：停止并明确报告文件路径与原因。
- SRT 格式错误：指出首个错误字幕块，不生成半成品 JSON。
- 没有适合生成卡片的重点内容：仍可输出合法的空 `cards` 项目，但必须提示用户。
- 组件参数超过软件限制：缩短展示文案或选择更匹配的组件；不得绕过校验。
- 软件格式发生变化：以项目中的 `src/timeline/project.ts`、`src/timeline/types.ts` 和 `src/motion/registry.ts` 为真实来源，更新参考与校验器后再生成。

## 验证标准

- 基线失败测试证明：没有 Skill 时，容易生成错误根结构、缺少完整默认参数或使用不存在的组件 ID。
- SRT 解析测试覆盖 BOM、多行字幕、逗号毫秒、空行和错误时间码。
- JSON 校验测试覆盖合法项目、重复 ID、未知组件、错误参数类型、过短持续时间和画布尺寸错误。
- 使用一份中文示例 SRT 完成端到端生成，随后通过本地校验器。
- 将生成文件交给 Overlay Studio 的真实 `parseOverlayProject` 规则验证，确认可以导入。
- 运行 Skill 官方验证工具，确认 `SKILL.md` 和 `agents/openai.yaml` 合法且可被 Codex 发现。

## 非目标

- 不改动 Overlay Studio 的组件、时间轴或导入界面。
- 不生成、合成或导出视频。
- 不把全部字幕逐条做成特效。
- 不根据字幕之外的常识补写人物资料或数据。
- 不依赖云端 API；Skill 在本机即可完成解析、生成和校验。
