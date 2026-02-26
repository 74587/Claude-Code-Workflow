---
name: team-skill-designer
description: Design and generate unified team skills with role-based routing. All team members invoke ONE skill, SKILL.md routes to role-specific execution via --role arg. Triggers on "design team skill", "create team skill", "team skill designer".
allowed-tools: Task, AskUserQuestion, Read, Write, Bash, Glob, Grep
---

# Team Skill Designer v2

Meta-skill for creating unified team skills where all team members invoke ONE skill with role-based routing. Generates a complete skill package with SKILL.md as role router and `roles/` folder for per-role execution detail.

**v2 Style**: 生成的技能包遵循 v3 撰写规范 — text + decision tables + flow symbols, 无伪代码, `<placeholder>` 占位符, 显式节拍控制。

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Team Skill Designer (this meta-skill)                          │
│  → Collect requirements → Analyze patterns → Generate skill pkg │
└───────────────┬─────────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┬───────────┐
    ↓           ↓           ↓           ↓           ↓
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Phase 1 │ │ Phase 2 │ │ Phase 3 │ │ Phase 4 │ │ Phase 5 │
│ Require │ │ Pattern │ │  Skill  │ │  Integ  │ │  Valid  │
│ Collect │ │ Analyze │ │  Gen    │ │  Verify │ │         │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
     ↓           ↓           ↓           ↓           ↓
  team-        pattern-    preview/    integ-     validated
  config.json  analysis   SKILL.md +  report     skill pkg
               .json      roles/*.md  .json      → delivery
```

## Key Innovation: Unified Skill + Role Router

**Before** (command approach): 5 separate command files → 5 separate skill paths

**After** (unified skill approach):

```
.claude/skills/team-<name>/
├── SKILL.md          →  Skill(skill="team-<name>", args="--role=xxx")
├── roles/
│   ├── coordinator/
│   │   ├── role.md
│   │   └── commands/
│   ├── <worker-1>/
│   │   ├── role.md
│   │   └── commands/
│   └── <worker-N>/
│       ├── role.md
│       └── commands/
└── specs/
    └── team-config.json
```

→ 1 skill entry point, `--role` arg routes to per-role execution

## Core Design Patterns

### Pattern 1: Role Router (Unified Entry Point)

SKILL.md parses `$ARGUMENTS` to extract `--role`:

```
Input: Skill(skill="team-<name>", args="--role=planner")
  → Parse --role=planner
  → Read roles/planner/role.md
  → Execute planner-specific phases
```

No `--role` → Orchestration Mode (auto route to coordinator).

### Pattern 2: SKILL.md = Orchestration-Level Only

SKILL.md 仅包含编排级内容:

| 包含 | 不包含 |
|------|--------|
| Role Router (parse → dispatch) | Message bus 代码 |
| Architecture 图 | Task lifecycle 代码 |
| Role Registry 表 (含 markdown links) | 工具声明/使用示例 |
| Pipeline 定义 + Cadence Control | 角色特定检测逻辑 |
| Coordinator Spawn Template | 实现级代码块 |
| Shared Infrastructure (Phase 1/5 模板) | |
| Compact Protection | |

### Pattern 3: Role Files = Self-Contained Execution

每个 `roles/<role>/role.md` 包含角色执行所需的一切:
- Identity, Boundaries (MUST/MUST NOT)
- Toolbox 表 (command links)
- Phase 2-4 核心逻辑 (text + decision tables, 无伪代码)
- Error Handling 表

**关键原则**: subagent 加载 role.md 后无需回读 SKILL.md 即可执行。

### Pattern 4: v3 Style Output

生成的技能包遵循以下风格规则:

| 规则 | 说明 |
|------|------|
| 无伪代码 | 流程用 text + decision tables + flow symbols (→ ├─ └─) |
| 代码块仅限工具调用 | 只有 Task(), TaskCreate(), Bash(), Read() 等实际执行的调用 |
| `<placeholder>` 占位符 | 不使用 `${variable}` 或 `{{handlebars}}` |
| Decision tables | 所有分支逻辑用 `\| Condition \| Action \|` 表格 |
| Phase 1/5 共享 | SKILL.md 定义 Shared Infrastructure, role.md 只写 Phase 2-4 |
| Cadence Control | SKILL.md 包含节拍图和检查点定义 |
| Compact Protection | Phase Reference 表含 Compact 列, 关键 phase 标记重读 |

### Pattern 5: Batch Role Generation

Phase 1 一次性收集所有角色 (非逐个):
- Team name + all role definitions in one pass
- Coordinator always generated
- Worker roles collected as batch

### Pattern 6: Coordinator Commands Alignment

**dispatch.md 约束**: owner 值匹配 Role Registry | 任务 ID 匹配 Pipeline 图 | 无幽灵角色名

**monitor.md 约束**: spawn prompt 含完整 `Skill(skill="...", args="--role=...")` | Task() 含 description + team_name + name | Message Routing 角色名匹配 Registry

**验证时机**: Phase 4 自动检查。

---

## Mandatory Prerequisites

> **Do NOT skip**: Read these before any execution.

### Specification Documents

| Document | Purpose | When |
|----------|---------|------|
| [specs/team-design-patterns.md](specs/team-design-patterns.md) | Infrastructure patterns (9) + collaboration index | Phase 0 必读 |
| [specs/collaboration-patterns.md](specs/collaboration-patterns.md) | 11 collaboration patterns with convergence control | Phase 0 必读 |
| [specs/quality-standards.md](specs/quality-standards.md) | Quality criteria (4 dimensions + command standards) | Phase 3 前必读 |

### Template Files

| Document | Purpose |
|----------|---------|
| [templates/skill-router-template.md](templates/skill-router-template.md) | 生成 SKILL.md 模板 (v3 style) |
| [templates/role-template.md](templates/role-template.md) | 生成 role.md 模板 (v3 style) |
| [templates/role-command-template.md](templates/role-command-template.md) | 生成 command 文件模板 (v3 style) |

---

## Cadence Control

**节拍模型**: 串行 5-Phase, 每个 Phase 产出一个 artifact 作为下一 Phase 的输入。

```
Phase Cadence (设计生成节拍)
═══════════════════════════════════════════════════════════════════
Phase   0          1           2            3             4          5
        │          │           │            │             │          │
     读规格  →  收集需求  →  模式分析  →  技能生成  →  集成验证  →  质量交付
        │          │           │            │             │          │
     [memory]   config     analysis     preview/       report    delivery
                .json       .json       SKILL.md       .json    → skills/
                                        roles/
                                        commands/
═══════════════════════════════════════════════════════════════════

Phase 产物链:
  Phase 0 → [in-memory] specs + templates 内化
  Phase 1 → team-config.json (角色定义 + pipeline)
  Phase 2 → pattern-analysis.json (模式映射 + 协作模式)
  Phase 3 → preview/ 完整技能包
  Phase 4 → integration-report.json (一致性报告)
  Phase 5 → validation-report.json + delivery → .claude/skills/team-<name>/

检查点:
  Phase 3 完成 → ⏸ 向用户展示 preview 结构，确认后进入 Phase 4
  Phase 5 评分 → ⏸ 评分 < 60% 则回退 Phase 3 重新生成
```

**Phase 间衔接**:

| 当前 Phase | 完成条件 | 产物 | 下一步 |
|------------|----------|------|--------|
| Phase 0 | 3 个 spec + 3 个 template 已读取 | in-memory | → Phase 1 |
| Phase 1 | team-config.json 写入成功 | team-config.json | → Phase 2 |
| Phase 2 | pattern-analysis.json 写入成功 | pattern-analysis.json | → Phase 3 |
| Phase 3 | preview/ 目录下所有文件生成 | preview/* | → ⏸ 用户确认 → Phase 4 |
| Phase 4 | integration-report.json 无 FAIL 项 | integration-report.json | → Phase 5 |
| Phase 5 | score ≥ 80% | delivery to skills/ | → 完成 |

**回退机制**:

| 条件 | 回退到 | 动作 |
|------|--------|------|
| Phase 4 发现 FAIL | Phase 3 | 修复后重新生成 |
| Phase 5 score < 60% | Phase 3 | 重大返工 |
| Phase 5 score 60-79% | Phase 4 | 修复建议后重验 |

---

## Execution Flow

### Phase Reference Documents

| Phase | Document | Purpose | Compact |
|-------|----------|---------|---------|
| 0 | (inline) | Read specs + templates | N/A |
| 1 | [phases/01-requirements-collection.md](phases/01-requirements-collection.md) | Batch collect team + all role definitions | 完成后可压缩 |
| 2 | [phases/02-pattern-analysis.md](phases/02-pattern-analysis.md) | Per-role pattern matching and phase mapping | 完成后可压缩 |
| 3 | [phases/03-skill-generation.md](phases/03-skill-generation.md) | Generate unified skill package | **⚠️ 压缩后必须重读** |
| 4 | [phases/04-integration-verification.md](phases/04-integration-verification.md) | Verify internal consistency | 压缩后必须重读 |
| 5 | [phases/05-validation.md](phases/05-validation.md) | Quality gate and delivery | 压缩后必须重读 |

> **⚠️ COMPACT PROTECTION**: Phase 文件是执行文档。当 context compression 发生后，Phase 指令仅剩摘要时，**必须立即 `Read` 对应 phase 文件重新加载后再继续执行**。不得基于摘要执行任何 Step。

### Phase 0: Specification Study (Inline)

**必须在生成前读取以下文件**:

1. Read `specs/team-design-patterns.md` → 9 基础设施模式
2. Read `specs/collaboration-patterns.md` → 11 协作模式
3. Read `specs/quality-standards.md` → 质量标准
4. Read `templates/skill-router-template.md` → SKILL.md 生成模板
5. Read `templates/role-template.md` → role.md 生成模板
6. Read `templates/role-command-template.md` → command 文件模板

### Phase 1-5: Delegated

各 Phase 读取对应 phase 文件执行。See Phase Reference Documents table above.

---

## Directory Setup

工作目录: `.workflow/.scratchpad/team-skill-<timestamp>/`

```bash
Bash("mkdir -p .workflow/.scratchpad/team-skill-$(date +%Y%m%d%H%M%S)")
```

## Output Structure

```
.workflow/.scratchpad/team-skill-<timestamp>/
├── team-config.json             # Phase 1 output
├── pattern-analysis.json        # Phase 2 output
├── integration-report.json      # Phase 4 output
├── validation-report.json       # Phase 5 output
└── preview/                     # Phase 3 output (preview before delivery)
    ├── SKILL.md
    ├── roles/
    │   ├── coordinator/
    │   │   ├── role.md
    │   │   └── commands/
    │   └── <role-N>/
    │       ├── role.md
    │       └── commands/
    └── specs/
        └── team-config.json

Final delivery → .claude/skills/team-<name>/
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Specs not found | Fall back to inline pattern knowledge |
| Role name conflicts | AskUserQuestion for rename |
| Task prefix conflicts | Suggest alternative prefix |
| Template variable unresolved | FAIL with specific variable name |
| Quality score < 60% | Re-run Phase 3 with additional context |
| Phase file compressed | Re-read phase file before continuing |
