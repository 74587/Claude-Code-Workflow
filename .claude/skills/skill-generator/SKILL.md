---
name: skill-generator
description: Meta-skill for creating new Claude Code skills with configurable execution modes. Supports sequential (fixed order) and autonomous (stateless) phase patterns. Use for skill scaffolding, skill creation, or building new workflows. Triggers on "create skill", "new skill", "skill generator", "生成技能", "创建技能".
allowed-tools: Task, AskUserQuestion, Read, Bash, Glob, Grep, Write
---

# Skill Generator

Meta-skill for creating new Claude Code skills with configurable execution modes.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Skill Generator Architecture                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 1: Requirements    → skill-config.json                   │
│           Discovery           (name, type, mode, agents)        │
│           ↓                                                      │
│  Phase 2: Structure       → 目录结构 + 核心文件骨架              │
│           Generation                                             │
│           ↓                                                      │
│  Phase 3: Phase           → phases/*.md (根据 mode 生成)         │
│           Generation          Sequential | Autonomous            │
│           ↓                                                      │
│  Phase 4: Specs &         → specs/*.md + templates/*.md         │
│           Templates                                              │
│           ↓                                                      │
│  Phase 5: Validation      → 验证完整性 + 生成使用说明            │
│           & Documentation                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Execution Modes

### Mode 1: Sequential (固定顺序)

传统线性执行模式，阶段按数字前缀顺序执行。

```
Phase 01 → Phase 02 → Phase 03 → ... → Phase N
```

**适用场景**:
- 流水线式任务（收集 → 分析 → 生成）
- 阶段间有强依赖关系
- 输出结构固定

**示例**: `software-manual`, `copyright-docs`

### Mode 2: Autonomous (无状态自主选择)

智能路由模式，根据上下文动态选择执行路径。

```
┌─────────────────────────────────────────┐
│           Orchestrator Agent            │
│  (读取状态 → 选择 Phase → 执行 → 更新)  │
└───────────────┬─────────────────────────┘
                │
    ┌───────────┼───────────┐
    ↓           ↓           ↓
┌───────┐  ┌───────┐  ┌───────┐
│Phase A│  │Phase B│  │Phase C│
│(独立) │  │(独立) │  │(独立) │
└───────┘  └───────┘  └───────┘
```

**适用场景**:
- 交互式任务（对话、问答）
- 阶段间无强依赖
- 需要动态响应用户意图

**示例**: `issue-manage`, `workflow-debug`

## Key Design Principles

1. **模式感知**: 根据任务特性自动推荐执行模式
2. **骨架生成**: 生成完整目录结构和文件骨架
3. **规范遵循**: 严格遵循 `_shared/SKILL-DESIGN-SPEC.md`
4. **可扩展性**: 生成的 Skill 易于扩展和修改

## Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: Requirements Discovery                                 │
│  → AskUserQuestion: Skill 名称、目标、执行模式                   │
│  → Output: skill-config.json                                    │
├─────────────────────────────────────────────────────────────────┤
│  Phase 2: Structure Generation                                   │
│  → 创建目录结构: phases/, specs/, templates/, scripts/          │
│  → 生成 SKILL.md 入口文件                                        │
│  → Output: 完整目录结构                                          │
├─────────────────────────────────────────────────────────────────┤
│  Phase 3: Phase Generation                                       │
│  → Sequential: 生成 01-xx.md, 02-xx.md, ...                     │
│  → Autonomous: 生成 orchestrator.md + actions/*.md              │
│  → Output: phases/*.md                                          │
├─────────────────────────────────────────────────────────────────┤
│  Phase 4: Specs & Templates                                      │
│  → 生成领域规范: specs/{domain}-requirements.md                  │
│  → 生成质量标准: specs/quality-standards.md                      │
│  → 生成模板: templates/agent-base.md                             │
│  → Output: specs/*.md, templates/*.md                           │
├─────────────────────────────────────────────────────────────────┤
│  Phase 5: Validation & Documentation                             │
│  → 验证文件完整性                                                 │
│  → 生成 README.md 使用说明                                       │
│  → Output: 验证报告 + README.md                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Setup

```javascript
const skillName = config.skill_name;
const skillDir = `.claude/skills/${skillName}`;

// 创建目录结构
Bash(`mkdir -p "${skillDir}/phases"`);
Bash(`mkdir -p "${skillDir}/specs"`);
Bash(`mkdir -p "${skillDir}/templates"`);

// Autonomous 模式额外目录
if (config.execution_mode === 'autonomous') {
  Bash(`mkdir -p "${skillDir}/phases/actions"`);
}
```

## Output Structure

### Sequential Mode

```
.claude/skills/{skill-name}/
├── SKILL.md
├── phases/
│   ├── 01-{step-one}.md
│   ├── 02-{step-two}.md
│   └── 03-{step-three}.md
├── specs/
│   ├── {domain}-requirements.md
│   └── quality-standards.md
└── templates/
    └── agent-base.md
```

### Autonomous Mode

```
.claude/skills/{skill-name}/
├── SKILL.md
├── phases/
│   ├── orchestrator.md          # 编排器：读取状态 → 选择动作
│   ├── state-schema.md          # 状态结构定义
│   └── actions/                 # 独立动作（无顺序）
│       ├── action-{a}.md
│       ├── action-{b}.md
│       └── action-{c}.md
├── specs/
│   ├── {domain}-requirements.md
│   ├── action-catalog.md        # 动作目录（描述、前置条件、效果）
│   └── quality-standards.md
└── templates/
    ├── orchestrator-base.md     # 编排器模板
    └── action-base.md           # 动作模板
```

## Reference Documents

| Document | Purpose |
|----------|---------|
| [phases/01-requirements-discovery.md](phases/01-requirements-discovery.md) | 收集 Skill 需求 |
| [phases/02-structure-generation.md](phases/02-structure-generation.md) | 生成目录结构 |
| [phases/03-phase-generation.md](phases/03-phase-generation.md) | 生成 Phase 文件 |
| [phases/04-specs-templates.md](phases/04-specs-templates.md) | 生成规范和模板 |
| [phases/05-validation.md](phases/05-validation.md) | 验证和文档 |
| [specs/execution-modes.md](specs/execution-modes.md) | 执行模式规范 |
| [specs/skill-requirements.md](specs/skill-requirements.md) | Skill 需求规范 |
| [templates/skill-md.md](templates/skill-md.md) | SKILL.md 模板 |
| [templates/sequential-phase.md](templates/sequential-phase.md) | Sequential Phase 模板 |
| [templates/autonomous-orchestrator.md](templates/autonomous-orchestrator.md) | Autonomous 编排器模板 |
| [templates/autonomous-action.md](templates/autonomous-action.md) | Autonomous Action 模板 |
| [../_shared/SKILL-DESIGN-SPEC.md](../_shared/SKILL-DESIGN-SPEC.md) | 通用设计规范 |
