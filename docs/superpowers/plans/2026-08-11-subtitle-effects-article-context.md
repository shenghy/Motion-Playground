# 字幕特效文章上下文增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让已安装的 `subtitle-effects` Skill 支持 AI 提示词卡片，并能在用户提供文章链接时用完整正文辅助判断字幕结构与提示词连贯性。

**Architecture:** 保持 Overlay Studio 九组件 JSON 契约不变，只扩展 Skill 的输入、分析和报告流程。文章正文建立独立语义地图，仅参与字幕分组；卡片文案、重点词和时间仍完全来自 SRT。用现有 Python 契约测试锁定可选输入、非阻塞回退和禁止文章内容进入 JSON 的边界。

**Tech Stack:** Markdown Skill、YAML agent metadata、Python `unittest`

---

### Task 1: 为文章上下文规则建立失败契约

**Files:**
- Modify: `C:/Users/Administrator/.codex/skills/subtitle-effects/scripts/test_tools.py`
- Test: `C:/Users/Administrator/.codex/skills/subtitle-effects/scripts/test_tools.py`

- [ ] **Step 1: 写入失败测试**

在 `SkillContractTests` 中增加测试，读取 `SKILL.md` 与 `agents/openai.yaml`，断言文档包含：文章链接为可选、必须获得完整正文、失败后退回纯字幕、字幕原文与时间轴是唯一依据、文章独有内容禁止进入 JSON、交付时报告文章上下文状态；默认提示同时接受 SRT 和可选文章链接。

```python
def test_docs_define_optional_article_context_boundaries(self) -> None:
    skill_root = SCRIPT_DIR.parent
    skill_text = (skill_root / "SKILL.md").read_text(encoding="utf-8")
    agent_text = (skill_root / "agents" / "openai.yaml").read_text(encoding="utf-8")

    for phrase in (
        "文章链接为可选输入",
        "完整正文",
        "退回纯字幕分析",
        "字幕原文和字幕时间轴是唯一事实依据",
        "文章独有内容不得写入 JSON",
        "文章上下文状态",
    ):
        self.assertIn(phrase, skill_text)
    self.assertIn("可选文章链接", agent_text)
```

- [ ] **Step 2: 运行测试并确认正确失败**

Run:

```powershell
$env:PYTHONUTF8='1'
python "C:\Users\Administrator\.codex\skills\subtitle-effects\scripts\test_tools.py"
```

Expected: 新测试因 `SKILL.md` 尚未包含“文章链接为可选输入”等契约而失败；现有测试继续通过。

### Task 2: 实现可选文章上下文工作流

**Files:**
- Modify: `C:/Users/Administrator/.codex/skills/subtitle-effects/SKILL.md`
- Modify: `C:/Users/Administrator/.codex/skills/subtitle-effects/agents/openai.yaml`

- [ ] **Step 1: 扩展触发描述与核心输入**

将 frontmatter 描述改为：

```yaml
description: Use when a user provides Chinese or bilingual SRT subtitles, optionally with a related article URL or pasted article body, and asks for 字幕特效, AI 提示词卡片, motion cards, timeline JSON, or an Overlay Studio project file.
```

在工作流程开头明确 `.srt` 必选、文章链接或正文可选；没有文章时不得主动阻塞流程。

- [ ] **Step 2: 加入文章获取与回退边界**

增加“可选文章上下文”章节，明确：

```markdown
- 文章链接为可选输入；未提供时直接按字幕分析。
- 提供链接时必须读取完整正文，标题、摘要和搜索片段不算正文。
- 无法取得完整正文时退回纯字幕分析，不猜测缺失内容。
- 文章只用于章节映射、指代消解、重复识别和提示词起止判断。
- 字幕原文和字幕时间轴是唯一事实依据；文章独有内容不得写入 JSON。
```

同步调整主工作流：读取可选正文、建立独立文章章节地图、生成后报告文章上下文状态。

- [ ] **Step 3: 强化 AI 提示词连续性规则**

在 `prompt-display` 规则中明确：文章可以帮助识别跨字幕提示词，但 `prompt` 仍按字幕顺序原样合并，`keywords` 仍只能提取 `prompt` 中存在的词；文章不得改变提示词首尾字幕时间。

- [ ] **Step 4: 更新默认调用提示**

将 `agents/openai.yaml` 的 `default_prompt` 更新为：

```yaml
default_prompt: "使用 $subtitle-effects 分析这个 SRT，并结合我提供的可选文章链接理解字幕结构，生成可直接导入 Overlay Studio 的字幕特效 JSON。"
```

### Task 3: 验证 Skill 契约与安装质量

**Files:**
- Test: `C:/Users/Administrator/.codex/skills/subtitle-effects/scripts/test_tools.py`
- Verify: `C:/Users/Administrator/.codex/skills/subtitle-effects/SKILL.md`
- Verify: `C:/Users/Administrator/.codex/skills/subtitle-effects/agents/openai.yaml`

- [ ] **Step 1: 运行契约测试并确认转绿**

Run:

```powershell
$env:PYTHONUTF8='1'
python "C:\Users\Administrator\.codex\skills\subtitle-effects\scripts\test_tools.py"
```

Expected: 所有测试通过，包含新的文章上下文契约测试。

- [ ] **Step 2: 运行 Skill 结构校验**

Run:

```powershell
$env:PYTHONUTF8='1'
python "C:\Users\Administrator\.codex\skills\.system\skill-creator\scripts\quick_validate.py" "C:\Users\Administrator\.codex\skills\subtitle-effects"
```

Expected: `Skill is valid!`

- [ ] **Step 3: 复核关键契约**

Run:

```powershell
rg -n "文章链接为可选输入|完整正文|退回纯字幕分析|唯一事实依据|文章独有内容不得写入 JSON|文章上下文状态|prompt-display" "C:\Users\Administrator\.codex\skills\subtitle-effects"
```

Expected: 关键规则在 `SKILL.md`、测试和现有提示词 schema 中均可检索，且没有新增 JSON 字段。

