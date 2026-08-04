# Subtitle Effects Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and install the Chinese-facing “字幕特效” Codex Skill that turns an SRT file into a validated Overlay Studio JSON project.

**Architecture:** The Skill combines semantic judgment in `SKILL.md` with deterministic Python tools. One script parses SRT into normalized cues, one script validates generated projects against the six current Overlay Studio motion definitions, and a compact reference stores the exact schema/defaults. The finished folder is installed at `C:\Users\Administrator\.codex\skills\subtitle-effects` and forward-tested on a realistic Chinese subtitle file.

**Tech Stack:** Codex Skills, Markdown/YAML, Python 3 standard library, JSON, SRT, Overlay Studio TypeScript project schema

---

### Task 1: Capture the no-Skill baseline

**Files:**
- Create temporarily: `C:\Users\Administrator\AppData\Local\Temp\subtitle-effects-baseline\sample.srt`
- Create temporarily: `C:\Users\Administrator\AppData\Local\Temp\subtitle-effects-baseline\baseline.json`

- [ ] **Step 1: Prepare a representative SRT fixture**

Use a UTF-8 fixture containing ordinary narration plus a metric, a before/after comparison, and a five-step process. Include one multiline cue so parsing behavior is observable.

- [ ] **Step 2: Run a fresh-agent baseline without the new Skill**

Ask the agent to generate an Overlay Studio JSON file while providing only the SRT and the user-level request. Do not disclose the registry defaults or the expected answer.

- [ ] **Step 3: Record the baseline failures**

Check the result for the known failure surfaces:

```text
root.version != 1
canvas != 1920x1080
unknown motionId
missing complete params
cards generated for ordinary filler subtitles
invalid start/end or duplicate ids
```

Expected: at least one schema, completeness, or selection failure demonstrates why the Skill and deterministic validator are necessary.

### Task 2: Initialize the installed Skill

**Files:**
- Create: `C:\Users\Administrator\.codex\skills\subtitle-effects\SKILL.md`
- Create: `C:\Users\Administrator\.codex\skills\subtitle-effects\agents\openai.yaml`
- Create directory: `C:\Users\Administrator\.codex\skills\subtitle-effects\scripts`
- Create directory: `C:\Users\Administrator\.codex\skills\subtitle-effects\references`

- [ ] **Step 1: Read the OpenAI YAML metadata reference**

Read `C:\Users\Administrator\.codex\skills\.system\skill-creator\references\openai_yaml.md` completely before creating UI metadata.

- [ ] **Step 2: Initialize with the official generator**

Run:

```powershell
python C:\Users\Administrator\.codex\skills\.system\skill-creator\scripts\init_skill.py subtitle-effects `
  --path C:\Users\Administrator\.codex\skills `
  --resources scripts,references `
  --interface 'display_name=字幕特效' `
  --interface 'short_description=根据 SRT 生成 Overlay Studio 动效 JSON' `
  --interface 'default_prompt=使用 $subtitle-effects 分析这个 SRT，并生成可直接导入 Overlay Studio 的字幕特效 JSON。'
```

Expected: the folder is created with `SKILL.md`, `agents/openai.yaml`, `scripts`, and `references`.

- [ ] **Step 3: Verify initialization before customization**

Run the official validator and confirm it fails only because the generated template still contains placeholders that must be replaced, or passes structurally if the generator permits placeholders.

### Task 3: Implement the SRT parser with tests first

**Files:**
- Create: `C:\Users\Administrator\.codex\skills\subtitle-effects\scripts\test_tools.py`
- Create: `C:\Users\Administrator\.codex\skills\subtitle-effects\scripts\parse_srt.py`

- [ ] **Step 1: Write failing parser tests**

Create `unittest` cases that call the future parser CLI and assert:

```python
self.assertEqual(cues[0]["start"], 1.2)
self.assertEqual(cues[0]["end"], 3.4)
self.assertEqual(cues[0]["text"], "第一行\n第二行")
self.assertEqual(cues[-1]["index"], 2)
```

Add error cases for an invalid time range, missing text, and an unsupported timestamp.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
python -m unittest C:\Users\Administrator\.codex\skills\subtitle-effects\scripts\test_tools.py -v
```

Expected: FAIL because `parse_srt.py` does not exist.

- [ ] **Step 3: Implement the minimal parser**

Implement a standard-library CLI:

```text
python parse_srt.py input.srt --output normalized-cues.json
```

Decode `utf-8-sig`, then fall back to `gb18030`; accept comma or period milliseconds; require finite non-negative times and `end > start`; preserve multiline text; emit UTF-8 JSON with `ensure_ascii=False`.

- [ ] **Step 4: Run tests and verify GREEN**

Run the same unittest command.

Expected: parser cases PASS with no warnings.

### Task 4: Implement the Overlay Studio validator with tests first

**Files:**
- Modify: `C:\Users\Administrator\.codex\skills\subtitle-effects\scripts\test_tools.py`
- Create: `C:\Users\Administrator\.codex\skills\subtitle-effects\scripts\validate_project.py`
- Create: `C:\Users\Administrator\.codex\skills\subtitle-effects\references\overlay-studio-schema.md`

- [ ] **Step 1: Add failing validator tests**

Add one valid project and invalid variants for:

```text
wrong version or canvas
duplicate/blank card id
unknown motionId
start < 0 or end-start < 0.2
position outside numeric input requirements
missing, unknown, or wrongly typed params
```

Assert valid input exits `0`; invalid input exits nonzero and includes the JSON path of the first error.

- [ ] **Step 2: Run tests and verify RED**

Expected: FAIL because `validate_project.py` does not exist.

- [ ] **Step 3: Write the exact schema reference**

Transcribe all six IDs and complete defaults from `src/motion/registry.ts`. Document the root/card schema from `src/timeline/types.ts` and validation constraints from `src/timeline/project.ts`. Include the semantic mapping table from the approved design.

- [ ] **Step 4: Implement the minimal validator**

Implement:

```text
python validate_project.py generated.json
```

The validator must require `version: 1`, a `1920x1080` canvas, unique IDs, known component IDs, valid timing, numeric positions, finite `zIndex`, and a complete exact-key parameter object with the right string/number types. Clamp nothing silently; report invalid generated data so the agent fixes it before delivery.

- [ ] **Step 5: Run tests and verify GREEN**

Expected: all parser and validator tests PASS.

### Task 5: Write the Skill instructions and metadata

**Files:**
- Modify: `C:\Users\Administrator\.codex\skills\subtitle-effects\SKILL.md`
- Regenerate: `C:\Users\Administrator\.codex\skills\subtitle-effects\agents\openai.yaml`

- [ ] **Step 1: Write the minimal Skill body**

Use frontmatter:

```yaml
---
name: subtitle-effects
description: Use when a user provides Chinese or bilingual SRT subtitles and asks for subtitle effects, motion cards, timeline JSON, or an Overlay Studio project file.
---
```

The body must require this workflow: parse SRT; read the schema reference; select only independent high-value facts; merge adjacent related cues; never invent facts; fill every parameter from registry defaults; write `<stem>-字幕特效.json`; validate; repair until valid; report path and component counts.

- [ ] **Step 2: Add component selection and safety rules**

Include all six semantic mappings, default `{ "x": 0, "y": 0 }`, stable increasing `zIndex`, bottom 150px subtitle safety, a `0.2` second minimum, and an explicit instruction to skip unsupported content instead of inventing data.

- [ ] **Step 3: Regenerate UI metadata**

Run `generate_openai_yaml.py` with the same three interface values from Task 2 so the display name remains “字幕特效”.

- [ ] **Step 4: Run official Skill validation**

Run:

```powershell
python C:\Users\Administrator\.codex\skills\.system\skill-creator\scripts\quick_validate.py C:\Users\Administrator\.codex\skills\subtitle-effects
```

Expected: `Skill is valid!`

### Task 6: Forward-test and prove real Overlay Studio compatibility

**Files:**
- Create temporarily: `C:\Users\Administrator\AppData\Local\Temp\subtitle-effects-forward-test\sample.srt`
- Create temporarily: `C:\Users\Administrator\AppData\Local\Temp\subtitle-effects-forward-test\sample-字幕特效.json`

- [ ] **Step 1: Run a fresh-agent test with the installed Skill**

Prompt only:

```text
使用 $subtitle-effects，把附件 sample.srt 生成可直接导入 Overlay Studio 的字幕特效 JSON。
```

Expected: the agent creates a focused subset of cards, uses only supported component IDs, does not invent facts, and runs the bundled validator.

- [ ] **Step 2: Validate the generated file with bundled tooling**

Run:

```powershell
python C:\Users\Administrator\.codex\skills\subtitle-effects\scripts\validate_project.py C:\Users\Administrator\AppData\Local\Temp\subtitle-effects-forward-test\sample-字幕特效.json
```

Expected: exit `0` and a Chinese success summary with card count and component distribution.

- [ ] **Step 3: Validate against the application parser**

Use a small TypeScript/Vitest compatibility test or the existing `parseOverlayProject` test harness with `motionRegistry` defaults to parse the generated JSON.

Expected: the real Overlay Studio parser accepts the file without `JSON 项目格式无效`.

- [ ] **Step 4: Run final checks**

Run the Skill unittest suite, `quick_validate.py`, Overlay Studio compatibility check, `npm run lint`, and `npm test -- --run`.

Expected: every command exits `0`, and the installed Skill remains discoverable at `C:\Users\Administrator\.codex\skills\subtitle-effects\SKILL.md`.

- [ ] **Step 5: Commit the implementation plan and report usage**

Commit the repository plan document. Report the installed path and the exact invocation sentence the user can use next time.
