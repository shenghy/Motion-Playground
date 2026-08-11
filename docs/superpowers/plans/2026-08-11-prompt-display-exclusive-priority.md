# 提示词展示排他优先级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当字幕包含完整 AI 提示词时，只生成 `prompt-display`，并阻止任何其他动效卡片与提示词完整展示区间重叠。

**Architecture:** Skill 工作流先识别提示词并保留其排他区间，再扫描剩余字幕。`validate_project.py` 对最终 JSON 做确定性重叠检查，任何非 `prompt-display` 卡片与提示词区间相交都会校验失败；区间边界刚好相接不视为重叠。

**Tech Stack:** Markdown Skill、Python `unittest`、Overlay Studio JSON validator

---

### Task 1: 建立提示词排他优先级失败契约

**Files:**
- Modify: `C:/Users/Administrator/.codex/skills/subtitle-effects/scripts/test_tools.py`
- Test: `C:/Users/Administrator/.codex/skills/subtitle-effects/scripts/test_tools.py`

- [ ] **Step 1: 添加校验器失败测试**

在 `ValidateProjectCliTests` 中加入一个与 `prompt-display` 重叠的 `narrative` 卡片，断言校验失败并包含“提示词展示区间内不得增加其他特效”。

```python
def test_rejects_non_prompt_card_overlapping_prompt_display(self) -> None:
    project = self.prompt_project()
    cards = project["cards"]
    assert isinstance(cards, list)
    cards.append({
        "id": "card-2",
        "motionId": "narrative",
        "start": 6.0,
        "end": 8.0,
        "position": {"x": 0, "y": 0},
        "zIndex": 1,
        "params": dict(VALID_PARAMS_BY_MOTION["narrative"]),
    })

    result = self.run_validator(project)

    self.assertNotEqual(result.returncode, 0)
    self.assertIn("提示词展示区间内不得增加其他特效", result.stderr)
```

- [ ] **Step 2: 添加边界相接通过测试**

加入 `start == prompt.end` 的 `narrative`，断言项目通过，证明提示词前后无关字幕仍可使用其他特效。

- [ ] **Step 3: 添加 Skill 文档契约测试**

断言 `SKILL.md` 包含“最高优先级”“排他区间”“不生成其他特效”“包含停留和退出时间”“删除所有重叠的非提示词卡片”和“提示词前后”。

- [ ] **Step 4: 运行测试确认 RED**

Run:

```powershell
$env:PYTHONUTF8='1'
python "C:\Users\Administrator\.codex\skills\subtitle-effects\scripts\test_tools.py"
```

Expected: 重叠卡片仍被当前校验器接受，文档契约缺失，新增测试失败。

### Task 2: 实现确定性排他校验

**Files:**
- Modify: `C:/Users/Administrator/.codex/skills/subtitle-effects/scripts/validate_project.py`
- Test: `C:/Users/Administrator/.codex/skills/subtitle-effects/scripts/test_tools.py`

- [ ] **Step 1: 在单卡校验完成后收集提示词区间**

使用已验证的 `start`、`end` 创建 `(index, start, end)` 列表，不改变 JSON schema。

- [ ] **Step 2: 拒绝重叠非提示词卡片**

在所有卡片基础字段通过后执行：

```python
prompt_intervals = [
    (index, card["start"], card["end"])
    for index, card in enumerate(cards)
    if card["motionId"] == "prompt-display"
]
for index, card in enumerate(cards):
    if card["motionId"] == "prompt-display":
        continue
    for prompt_index, prompt_start, prompt_end in prompt_intervals:
        if card["start"] < prompt_end and card["end"] > prompt_start:
            fail(
                f"$.cards[{index}]",
                f"与 $.cards[{prompt_index}] 的提示词展示区间重叠；提示词展示区间内不得增加其他特效",
            )
```

- [ ] **Step 3: 运行测试确认校验器转绿**

Run the full `test_tools.py`; expected validator overlap tests pass while the Skill document test still fails until Task 3.

### Task 3: 更新生成工作流和提示词专用规则

**Files:**
- Modify: `C:/Users/Administrator/.codex/skills/subtitle-effects/SKILL.md`
- Test: `C:/Users/Administrator/.codex/skills/subtitle-effects/scripts/test_tools.py`

- [ ] **Step 1: 调整语义扫描顺序**

把工作流改为先扫描完整 AI 提示词并登记排他区间，再只在剩余字幕范围内扫描其他语义组。

- [ ] **Step 2: 写入最高优先级规则**

在“提示词展示专用规则”中明确：

```markdown
- `prompt-display` 拥有最高优先级。提示词即使包含数字、步骤、对比、人物、结论或互动问句，也不生成其他特效。
- 排他区间从首条提示词字幕 `start` 到卡片最终 `end`，包含 `holdDuration` 和 `exitDuration`。
- 最终复核删除所有与排他区间重叠的非提示词卡片，不得缩短或移动提示词卡片来保留它们。
- 提示词前后不属于该提示词的字幕仍可按常规规则生成其他特效。
```

- [ ] **Step 3: 增加常见错误**

明确禁止把同一提示词拆成 `narrative`、`step-flow`、数据组件或投票组件，并禁止在停留、退出阶段插入其他特效。

- [ ] **Step 4: 运行全量 Skill 测试确认 GREEN**

Run `test_tools.py`; expected all tests pass.

### Task 4: 最终验证

**Files:**
- Verify: `C:/Users/Administrator/.codex/skills/subtitle-effects/SKILL.md`
- Verify: `C:/Users/Administrator/.codex/skills/subtitle-effects/scripts/validate_project.py`
- Verify: `C:/Users/Administrator/.codex/skills/subtitle-effects/scripts/test_tools.py`

- [ ] **Step 1: 运行 Skill 结构校验**

```powershell
$env:PYTHONUTF8='1'
python "C:\Users\Administrator\.codex\skills\.system\skill-creator\scripts\quick_validate.py" "C:\Users\Administrator\.codex\skills\subtitle-effects"
```

Expected: `Skill is valid!`

- [ ] **Step 2: 检索关键契约**

```powershell
rg -n "最高优先级|排他区间|不得增加其他特效|停留和退出|重叠的非提示词卡片|提示词前后" "C:\Users\Administrator\.codex\skills\subtitle-effects"
```

Expected: 文档、校验器和测试均包含对应契约。

