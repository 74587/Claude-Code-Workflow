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
│                    Skill Generator                               │
│                                                                  │
│  Input: User Request (skill name, purpose, mode)                │
│                         ↓                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Phase 0-5: Sequential Pipeline                          │    │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐             │    │
│  │  │ P0 │→│ P1 │→│ P2 │→│ P3 │→│ P4 │→│ P5 │             │    │
│  │  │Spec│ │Req │ │Dir │ │Gen │ │Spec│ │Val │             │    │
│  │  └────┘ └────┘ └────┘ └─┬──┘ └────┘ └────┘             │    │
│  │                         │                                │    │
│  │                    ┌────┴────┐                           │    │
│  │                    ↓         ↓                           │    │
│  │              Sequential  Autonomous                      │    │
│  │              (phases/)   (actions/)                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                         ↓                                        │
│  Output: .claude/skills/{skill-name}/ (complete package)        │
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

---

## ⚠️ Mandatory Prerequisites (强制前置条件)

> **⛔ 禁止跳过**: 在执行任何生成操作之前，**必须**完整阅读以下文档。未阅读规范直接生成将导致输出不符合质量标准。

### 核心规范 (必读)

| Document | Purpose | Priority |
|----------|---------|----------|
| [../_shared/SKILL-DESIGN-SPEC.md](../_shared/SKILL-DESIGN-SPEC.md) | 通用设计规范 - 定义所有 Skill 的结构、命名、质量标准 | **P0 - 最高** |

### 模板文件 (生成前必读)

| Document | Purpose |
|----------|---------|
| [templates/skill-md.md](templates/skill-md.md) | SKILL.md 入口文件模板 |
| [templates/sequential-phase.md](templates/sequential-phase.md) | Sequential Phase 模板 |
| [templates/autonomous-orchestrator.md](templates/autonomous-orchestrator.md) | Autonomous 编排器模板 |
| [templates/autonomous-action.md](templates/autonomous-action.md) | Autonomous Action 模板 |
| [templates/code-analysis-action.md](templates/code-analysis-action.md) | 代码分析 Action 模板 |
| [templates/llm-action.md](templates/llm-action.md) | LLM Action 模板 |
| [templates/script-bash.md](templates/script-bash.md) | Bash 脚本模板 |
| [templates/script-python.md](templates/script-python.md) | Python 脚本模板 |

### 规范文档 (按需阅读)

| Document | Purpose |
|----------|---------|
| [specs/execution-modes.md](specs/execution-modes.md) | 执行模式规范 |
| [specs/skill-requirements.md](specs/skill-requirements.md) | Skill 需求规范 |
| [specs/cli-integration.md](specs/cli-integration.md) | CLI 集成规范 |
| [specs/scripting-integration.md](specs/scripting-integration.md) | 脚本集成规范 |

### Phase 执行指南 (执行时参考)

| Document | Purpose |
|----------|---------|
| [phases/01-requirements-discovery.md](phases/01-requirements-discovery.md) | 收集 Skill 需求 |
| [phases/02-structure-generation.md](phases/02-structure-generation.md) | 生成目录结构 |
| [phases/03-phase-generation.md](phases/03-phase-generation.md) | 生成 Phase 文件 |
| [phases/04-specs-templates.md](phases/04-specs-templates.md) | 生成规范和模板 |
| [phases/05-validation.md](phases/05-validation.md) | 验证和文档 |

---

## Execution Flow

```
Input Parsing:
   └─ Convert user request to structured format (skill-name/purpose/mode)

Phase 0: Specification Study (⚠️ MANDATORY - 禁止跳过)
   └─ Read specification documents
      ├─ Load: ../_shared/SKILL-DESIGN-SPEC.md
      ├─ Load: All templates/*.md files
      ├─ Understand: Structure rules, naming conventions, quality standards
      └─ Output: Internalized requirements (in-memory, no file output)
      └─ Validation: ⛔ MUST complete before Phase 1

Phase 1: Requirements Discovery
   └─ Gather skill requirements via user interaction
      ├─ Tool: AskUserQuestion
      │   ├─ Prompt: Skill name, purpose, execution mode
      │   ├─ Prompt: Phase/Action definition
      │   └─ Prompt: Tool dependencies, output format
      ├─ Process: Generate configuration object
      └─ Output: skill-config.json → ${workDir}/
          ├─ skill_name: string
          ├─ execution_mode: "sequential" | "autonomous"
          ├─ phases/actions: array
          └─ allowed_tools: array

Phase 2: Structure Generation
   └─ Create directory structure and entry file
      ├─ Input: skill-config.json (from Phase 1)
      ├─ Tool: Bash
      │   └─ Execute: mkdir -p .claude/skills/{skill-name}/{phases,specs,templates,scripts}
      ├─ Tool: Write
      │   └─ Generate: SKILL.md (entry point with architecture diagram)
      └─ Output: Complete directory structure
          ├─ .claude/skills/{skill-name}/SKILL.md
          ├─ .claude/skills/{skill-name}/phases/
          ├─ .claude/skills/{skill-name}/specs/
          ├─ .claude/skills/{skill-name}/templates/
          └─ .claude/skills/{skill-name}/scripts/

Phase 3: Phase/Action Generation
   └─ Decision (execution_mode check):
      ├─ execution_mode === "sequential" → Generate Sequential Phases
      │   ├─ Tool: Read (template: templates/sequential-phase.md)
      │   ├─ Loop: For each phase in config.sequential_config.phases
      │   │   ├─ Generate: phases/{phase-id}.md
      │   │   └─ Link: Previous phase output → Current phase input
      │   ├─ Tool: Write (orchestrator: phases/_orchestrator.md)
      │   ├─ Tool: Write (workflow definition: workflow.json)
      │   └─ Output: phases/01-{name}.md, phases/02-{name}.md, ...
      │
      └─ execution_mode === "autonomous" → Generate Orchestrator + Actions
          ├─ Tool: Read (template: templates/autonomous-orchestrator.md)
          ├─ Tool: Write (state schema: phases/state-schema.md)
          ├─ Tool: Write (orchestrator: phases/orchestrator.md)
          ├─ Tool: Write (action catalog: specs/action-catalog.md)
          ├─ Loop: For each action in config.autonomous_config.actions
          │   ├─ Tool: Read (template: templates/autonomous-action.md)
          │   └─ Generate: phases/actions/{action-id}.md
          └─ Output: phases/orchestrator.md, phases/actions/*.md

Phase 4: Specs & Templates
   └─ Generate domain specifications and templates
      ├─ Input: skill-config.json (domain context)
      ├─ Tool: Write
      │   ├─ Generate: specs/{domain}-requirements.md
      │   ├─ Generate: specs/quality-standards.md
      │   └─ Generate: templates/agent-base.md (if needed)
      └─ Output: Domain-specific documentation
          ├─ specs/{skill-name}-requirements.md
          ├─ specs/quality-standards.md
          └─ templates/agent-base.md

Phase 5: Validation & Documentation
   └─ Verify completeness and generate usage guide
      ├─ Input: All generated files from previous phases
      ├─ Tool: Glob + Read
      │   └─ Check: Required files exist and contain proper structure
      ├─ Tool: Write
      │   ├─ Generate: README.md (usage instructions)
      │   └─ Generate: validation-report.json (completeness check)
      └─ Output: Final documentation
          ├─ README.md (how to use this skill)
          └─ validation-report.json (quality gate results)

Return:
   └─ Summary with skill location and next steps
      ├─ Skill path: .claude/skills/{skill-name}/
      ├─ Status: ✅ All phases completed
      └─ Suggestion: "Review SKILL.md and customize phase files as needed"
```

**Execution Protocol**:

```javascript
// Phase 0: Read specifications (in-memory)
Read('.claude/skills/_shared/SKILL-DESIGN-SPEC.md');
Read('.claude/skills/skill-generator/templates/*.md'); // All templates

// Phase 1: Gather requirements
const answers = AskUserQuestion({
  questions: [
    { question: "Skill name?", header: "Name", options: [...] },
    { question: "Execution mode?", header: "Mode", options: ["Sequential", "Autonomous"] }
  ]
});

const config = generateConfig(answers);
const workDir = `.workflow/.scratchpad/skill-gen-${timestamp}`;
Write(`${workDir}/skill-config.json`, JSON.stringify(config));

// Phase 2: Create structure
const skillDir = `.claude/skills/${config.skill_name}`;
Bash(`mkdir -p "${skillDir}/phases" "${skillDir}/specs" "${skillDir}/templates"`);
Write(`${skillDir}/SKILL.md`, generateSkillEntry(config));

// Phase 3: Generate phases (mode-dependent)
if (config.execution_mode === 'sequential') {
  Write(`${skillDir}/phases/_orchestrator.md`, generateOrchestrator(config));
  Write(`${skillDir}/workflow.json`, generateWorkflowDef(config));
  config.sequential_config.phases.forEach(phase => {
    Write(`${skillDir}/phases/${phase.id}.md`, generatePhase(phase, config));
  });
} else {
  Write(`${skillDir}/phases/orchestrator.md`, generateAutonomousOrchestrator(config));
  Write(`${skillDir}/phases/state-schema.md`, generateStateSchema(config));
  config.autonomous_config.actions.forEach(action => {
    Write(`${skillDir}/phases/actions/${action.id}.md`, generateAction(action, config));
  });
}

// Phase 4: Generate specs
Write(`${skillDir}/specs/${config.skill_name}-requirements.md`, generateRequirements(config));
Write(`${skillDir}/specs/quality-standards.md`, generateQualityStandards(config));


// Phase 5: Validate & Document
const validation = validateStructure(skillDir);
Write(`${skillDir}/validation-report.json`, JSON.stringify(validation));
Write(`${skillDir}/README.md`, generateReadme(config, validation));
```

---

## Phase Reference Guide

Navigation and entry points for each execution phase:

### Phase 0: Specification Study (Mandatory)

**Document**: 🔗 [SKILL-DESIGN-SPEC.md](../_shared/SKILL-DESIGN-SPEC.md)

**Purpose**: Understand skill design standards before generating

**What to Read**:
- Skill structure conventions
- Naming standards
- Quality criteria
- Output format specifications

---

### Phase 1: Requirements Discovery

**Document**: 🔗 [phases/01-requirements-discovery.md](phases/01-requirements-discovery.md)

| Attribute | Value |
|-----------|-------|
| **Purpose** | Gather configuration from user via interactive prompts |
| **Input** | User responses (Skill name, purpose, execution mode) |
| **Output** | `skill-config.json` (configuration file) |
| **Key Decision** | Execution mode: Sequential vs Autonomous vs Hybrid |

---

### Phase 2: Structure Generation

**Document**: 🔗 [phases/02-structure-generation.md](phases/02-structure-generation.md)

| Attribute | Value |
|-----------|-------|
| **Purpose** | Create directory structure and entry file |
| **Input** | `skill-config.json` (from Phase 1) |
| **Output** | `.claude/skills/{skill-name}/` directory + `SKILL.md` |

---

### Phase 3: Phase/Action Generation

**Document**: 🔗 [phases/03-phase-generation.md](phases/03-phase-generation.md)

| Attribute | Value |
|-----------|-------|
| **Purpose** | Generate execution phases or actions based on mode |
| **Input** | `skill-config.json` + Templates |
| **Output** | Sequential: `phases/01-*.md` ... OR Autonomous: `phases/orchestrator.md` + `actions/*.md` |

**Decision Logic**:
```
IF execution_mode === "sequential":
  └─ Generate sequential phases with linear flow
ELSE IF execution_mode === "autonomous":
  └─ Generate orchestrator + independent actions
```

---

### Phase 4: Specs & Templates

**Document**: 🔗 [phases/04-specs-templates.md](phases/04-specs-templates.md)

| Attribute | Value |
|-----------|-------|
| **Purpose** | Generate domain specifications and template files |
| **Input** | `skill-config.json` (domain context) |
| **Output** | `specs/{skill-name}-requirements.md`, `specs/quality-standards.md` |

---

### Phase 5: Validation & Documentation

**Document**: 🔗 [phases/05-validation.md](phases/05-validation.md)

| Attribute | Value |
|-----------|-------|
| **Purpose** | Verify completeness and generate usage documentation |
| **Input** | All files from previous phases |
| **Output** | `README.md`, `validation-report.json` |

---

## Template Reference

| Template | Generated For | When Used |
|----------|--------------|-----------|
| [skill-md.md](templates/skill-md.md) | SKILL.md entry file | Phase 2 |
| [sequential-phase.md](templates/sequential-phase.md) | Sequential phase files | Phase 3 |
| [autonomous-orchestrator.md](templates/autonomous-orchestrator.md) | Orchestrator (autonomous) | Phase 3 |
| [autonomous-action.md](templates/autonomous-action.md) | Action files | Phase 3 |
| [code-analysis-action.md](templates/code-analysis-action.md) | Code analysis actions | Phase 3 |
| [llm-action.md](templates/llm-action.md) | LLM-powered actions | Phase 3 |
| [script-bash.md](templates/script-bash.md) | Bash scripts | Phase 3/4 |
| [script-python.md](templates/script-python.md) | Python scripts | Phase 3/4 |

## Output Structure

### Sequential Mode

```
.claude/skills/{skill-name}/
├── SKILL.md                        # 入口文件
├── phases/
│   ├── _orchestrator.md            # 声明式编排器
│   ├── workflow.json               # 工作流定义
│   ├── 01-{step-one}.md           # 阶段 1
│   ├── 02-{step-two}.md           # 阶段 2
│   └── 03-{step-three}.md         # 阶段 3
├── specs/
│   ├── {skill-name}-requirements.md
│   └── quality-standards.md
├── templates/
│   └── agent-base.md
├── scripts/
└── README.md
```

### Autonomous Mode

```
.claude/skills/{skill-name}/
├── SKILL.md                        # 入口文件
├── phases/
│   ├── orchestrator.md             # 编排器 (状态驱动)
│   ├── state-schema.md             # 状态结构定义
│   └── actions/
│       ├── action-init.md
│       ├── action-create.md
│       └── action-list.md
├── specs/
│   ├── {skill-name}-requirements.md
│   ├── action-catalog.md
│   └── quality-standards.md
├── templates/
│   ├── orchestrator-base.md
│   └── action-base.md
├── scripts/
└── README.md
```