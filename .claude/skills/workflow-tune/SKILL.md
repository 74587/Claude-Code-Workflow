---
name: workflow-tune
description: Workflow tuning skill for multi-command/skill pipelines. Executes each step sequentially, inspects artifacts after each command, analyzes quality via ccw cli resume, builds process documentation, and generates optimization suggestions. Triggers on "workflow tune", "tune workflow", "workflow optimization".
allowed-tools: Skill, Agent, AskUserQuestion, TaskCreate, TaskUpdate, TaskList, Read, Write, Edit, Bash, Glob, Grep
---

# Workflow Tune

Tune multi-step workflows composed of commands or skills. Execute each step, inspect artifacts, analyze via ccw cli resume, build process documentation, and produce actionable optimization suggestions.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  Workflow Tune Orchestrator (SKILL.md)                                │
│  → Parse → Decompose → Confirm → Setup → Step Loop → Synthesize     │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
   ┌───────────────────┼───────────────────────────────────┐
   ↓                   ↓                                   ↓
┌──────────┐   ┌─────────────────────────────┐     ┌──────────────┐
│ Phase 1  │   │  Step Loop (2→3 per step)   │     │ Phase 4 + 5  │
│ Setup    │   │  ┌─────┐  ┌─────┐           │     │ Synthesize + │
│          │──→│  │ P2  │→ │ P3  │           │────→│ Report       │
│ Parse +  │   │  │Exec │  │Anal │           │     │              │
│ Decomp + │   │  └─────┘  └─────┘           │     └──────────────┘
│ Confirm  │   │       ↑       │  next step  │
└──────────┘   │       └───────┘             │
               └─────────────────────────────┘

Phase 1 Detail:
  Input → [Format 1-3: direct parse] ──→ Command Doc → Confirm → Init
       → [Format 4: natural lang]   ──→ Semantic Decompose → Command Doc → Confirm → Init
```

## Key Design Principles

1. **Step-by-Step Execution**: Each workflow step executes independently, artifacts inspected before proceeding
2. **Resume-Based Analysis**: Uses ccw cli `--resume` to maintain analysis context across steps
3. **Process Documentation**: Running `process-log.md` accumulates observations per step
4. **Two-Tool Pipeline**: Claude/target tool (execute) + Gemini (analyze) = complementary perspectives
5. **Pure Orchestrator**: SKILL.md coordinates only — execution detail in phase files
6. **Progressive Phase Loading**: Phase docs read only when that phase executes

## Interactive Preference Collection

```javascript
// ★ Auto mode detection
const autoYes = /\b(-y|--yes)\b/.test($ARGUMENTS)

if (autoYes) {
  workflowPreferences = {
    autoYes: true,
    analysisDepth: 'standard',
    autoFix: false
  }
} else {
  const prefResponse = AskUserQuestion({
    questions: [
      {
        question: "选择 Workflow 调优配置：",
        header: "Tune Config",
        multiSelect: false,
        options: [
          { label: "Quick (轻量分析)", description: "每步简要检查，快速产出建议" },
          { label: "Standard (标准分析) (Recommended)", description: "每步详细分析，完整过程文档" },
          { label: "Deep (深度分析)", description: "每步深度审查，含性能和架构建议" }
        ]
      },
      {
        question: "是否自动应用优化建议？",
        header: "Auto Fix",
        multiSelect: false,
        options: [
          { label: "No (仅生成报告) (Recommended)", description: "只分析，不修改" },
          { label: "Yes (自动应用)", description: "分析后自动应用高优先级建议" }
        ]
      }
    ]
  })

  const depthMap = {
    "Quick": "quick",
    "Standard": "standard",
    "Deep": "deep"
  }
  const selectedDepth = Object.keys(depthMap).find(k =>
    prefResponse["Tune Config"].startsWith(k)
  ) || "Standard"

  workflowPreferences = {
    autoYes: false,
    analysisDepth: depthMap[selectedDepth],
    autoFix: prefResponse["Auto Fix"].startsWith("Yes")
  }
}
```

## Input Processing

```
$ARGUMENTS → Parse:
  ├─ Workflow definition: one of:
  │   ├─ Format 1: Inline steps — "step1 | step2 | step3" (pipe-separated commands)
  │   ├─ Format 2: Skill names — "skill-a,skill-b,skill-c" (comma-separated)
  │   ├─ Format 3: File path — "--file workflow.json" (JSON definition)
  │   └─ Format 4: Natural language — free-text description, auto-decomposed into steps
  ├─ Test context: --context "description of what the workflow should achieve"
  └─ Flags: --depth quick|standard|deep, -y/--yes, --auto-fix
```

### Format Detection Priority

```
1. --file flag present         → Format 3 (JSON)
2. Contains pipe "|"           → Format 1 (inline commands)
3. Matches skill-name pattern  → Format 2 (comma-separated skills)
4. Everything else             → Format 4 (natural language → semantic decomposition)
```

### Format 4: Semantic Decomposition (Natural Language)

When input is free-text (e.g., "分析 src 目录代码质量，做代码评审，然后修复高优先级问题"), the orchestrator:

1. **Semantic Parse**: Identify intent verbs and targets → map to available skills/commands
2. **Step Chain Generation**: Produce ordered step chain with tool/mode selection
3. **Command Doc**: Generate formatted execution plan document
4. **User Confirmation**: Display plan, ask user to confirm/edit before execution

```javascript
// Semantic decomposition uses intent-to-tool mapping
const intentMap = {
  // Analysis intents
  '分析|analyze|审查|inspect|scan': { tool: 'gemini', mode: 'analysis', rule: 'analysis-analyze-code-patterns' },
  '评审|review|code review': { tool: 'gemini', mode: 'analysis', rule: 'analysis-review-code-quality' },
  '诊断|debug|排查|diagnose': { tool: 'gemini', mode: 'analysis', rule: 'analysis-diagnose-bug-root-cause' },
  '安全|security|漏洞': { tool: 'gemini', mode: 'analysis', rule: 'analysis-assess-security-risks' },
  '性能|performance|perf': { tool: 'gemini', mode: 'analysis', rule: 'analysis-analyze-performance' },
  '架构|architecture': { tool: 'gemini', mode: 'analysis', rule: 'analysis-review-architecture' },
  // Write intents
  '修复|fix|repair|解决': { tool: 'claude', mode: 'write', rule: 'development-debug-runtime-issues' },
  '实现|implement|开发|create': { tool: 'claude', mode: 'write', rule: 'development-implement-feature' },
  '重构|refactor': { tool: 'claude', mode: 'write', rule: 'development-refactor-codebase' },
  '测试|test|generate test': { tool: 'claude', mode: 'write', rule: 'development-generate-tests' },
  // Planning intents
  '规划|plan|设计|design': { tool: 'gemini', mode: 'analysis', rule: 'planning-plan-architecture-design' },
  '拆解|breakdown|分解': { tool: 'gemini', mode: 'analysis', rule: 'planning-breakdown-task-steps' },
};

// Match input segments to intents, produce step chain
// See phases/01-setup.md Step 1.1b for full algorithm
```

### Workflow JSON Format (when using --file)

```json
{
  "name": "my-workflow",
  "description": "What this workflow achieves",
  "steps": [
    {
      "name": "step-1-name",
      "type": "skill|command|ccw-cli",
      "command": "/skill-name args" | "ccw cli -p '...' --tool gemini --mode analysis",
      "expected_artifacts": ["output.md", "report.json"],
      "success_criteria": "description of what success looks like"
    }
  ]
}
```

### Inline Step Parsing

```javascript
// Pipe-separated: each segment is a command
// "ccw cli -p 'analyze' --tool gemini --mode analysis | /review-code src/ | ccw cli -p 'fix' --tool claude --mode write"
const steps = input.split('|').map((cmd, i) => ({
  name: `step-${i + 1}`,
  type: cmd.trim().startsWith('/') ? 'skill' : 'command',
  command: cmd.trim(),
  expected_artifacts: [],
  success_criteria: ''
}));
```

## Pre-Execution Confirmation

After parsing (all formats) or decomposition (Format 4), generate a **Command Document** and ask for user confirmation before executing.

### Command Document Format

```markdown
# Workflow Tune — Execution Plan

**Workflow**: {name}
**Goal**: {context}
**Steps**: {count}
**Analysis Depth**: {depth}

## Step Chain

| # | Name | Type | Command | Tool | Mode |
|---|------|------|---------|------|------|
| 1 | {name} | {type} | {command} | {tool} | {mode} |
| 2 | ... | ... | ... | ... | ... |

## Execution Flow

```
Step 1: {name}
  → Command: {command}
  → Expected: {artifacts}
  → Feeds into: Step 2
       ↓
Step 2: {name}
  → Command: {command}
  → Expected: {artifacts}
  → Feeds into: Step 3
       ↓
  ...
```

## Estimated Scope

- Total CLI calls: {N} (execute) + {N} (analyze) + 1 (synthesize)
- Analysis tool: gemini (--resume chain)
- Process documentation: process-log.md (accumulated)
```

### Confirmation Flow

```javascript
// ★ Skip confirmation only if -y/--yes flag
if (!workflowPreferences.autoYes) {
  // Display command document to user
  // Output the formatted plan (direct text output, NOT a file)

  const confirmation = AskUserQuestion({
    questions: [{
      question: "确认执行以上 Workflow 调优计划？",
      header: "Confirm Execution",
      multiSelect: false,
      options: [
        { label: "Execute (确认执行)", description: "按计划开始执行" },
        { label: "Edit steps (修改步骤)", description: "我想调整某些步骤" },
        { label: "Cancel (取消)", description: "取消本次调优" }
      ]
    }]
  });

  if (confirmation["Confirm Execution"].startsWith("Cancel")) {
    // Abort workflow
    return;
  }

  if (confirmation["Confirm Execution"].startsWith("Edit")) {
    // Ask user for modifications
    const editResponse = AskUserQuestion({
      questions: [{
        question: "请描述要修改的内容（如：删除步骤2、步骤3改用codex、在步骤1后加入安全扫描）：",
        header: "Edit Steps"
      }]
    });
    // Apply user edits to steps[] → re-display command doc → re-confirm
    // (recursive confirmation loop until Execute or Cancel)
  }
}
```

## Execution Flow

> **COMPACT DIRECTIVE**: Context compression MUST check TaskUpdate phase status.
> The phase currently marked `in_progress` is the active execution phase — preserve its FULL content.
> Only compress phases marked `completed` or `pending`.

### Phase 1: Setup (one-time)

Read and execute: `Ref: phases/01-setup.md`

- Parse workflow steps from input (Format 1-3: direct parse, Format 4: semantic decomposition)
- Generate Command Document (formatted execution plan)
- **User Confirmation**: Display plan, wait for confirm/edit/cancel
- Create workspace at `.workflow/.scratchpad/workflow-tune-{ts}/`
- Initialize workflow-state.json
- Create process-log.md template

Output: `workDir`, `steps[]`, `workflowContext`, `commandDoc`, initialized state

### Step Loop (Phase 2 + Phase 3, per step)

```javascript
// Track analysis session ID for resume chain
let analysisSessionId = null;

for (let stepIdx = 0; stepIdx < state.steps.length; stepIdx++) {
  const step = state.steps[stepIdx];

  TaskUpdate(stepLoopTask, {
    subject: `Step ${stepIdx + 1}/${state.steps.length}: ${step.name}`,
    status: 'in_progress'
  });

  // === Phase 2: Execute Step ===
  // Read: phases/02-step-execute.md
  // Execute command/skill → collect artifacts
  // Write step-{N}-artifacts-manifest.json

  // === Phase 3: Analyze Step ===
  // Read: phases/03-step-analyze.md
  // Inspect artifacts → ccw cli gemini --resume analysisSessionId
  // Write step-{N}-analysis.md → append to process-log.md
  // Update analysisSessionId for next step's resume

  // Update state
  state.steps[stepIdx].status = 'completed';
  Write(`${state.work_dir}/workflow-state.json`, JSON.stringify(state, null, 2));
}
```

### Phase 2: Execute Step (per step)

Read and execute: `Ref: phases/02-step-execute.md`

- Create step working directory
- Execute command/skill via ccw cli or Skill tool
- Collect output artifacts
- Write artifacts manifest

### Phase 3: Analyze Step (per step)

Read and execute: `Ref: phases/03-step-analyze.md`

- Inspect step artifacts (file list, content summary, quality signals)
- Build analysis prompt with step context + previous steps' process log
- Execute: `ccw cli --tool gemini --mode analysis [--resume sessionId]`
- Parse analysis → write step-{N}-analysis.md
- Append findings to process-log.md
- Return analysis session ID for resume chain

### Phase 4: Synthesize (one-time)

Read and execute: `Ref: phases/04-synthesize.md`

- Read complete process-log.md + all step analyses
- Build synthesis prompt with full workflow context
- Execute: `ccw cli --tool gemini --mode analysis --resume analysisSessionId`
- Generate cross-step optimization insights
- Write synthesis.md

### Phase 5: Optimization Report (one-time)

Read and execute: `Ref: phases/05-optimize-report.md`

- Aggregate all analyses and synthesis
- Generate structured optimization report
- Optionally apply high-priority fixes (if autoFix enabled)
- Write final-report.md
- Display summary to user

**Phase Reference Documents**:

| Phase | Document | Purpose | Compact |
|-------|----------|---------|---------|
| 1 | [phases/01-setup.md](phases/01-setup.md) | Initialize workspace and state | TaskUpdate driven |
| 2 | [phases/02-step-execute.md](phases/02-step-execute.md) | Execute workflow step | TaskUpdate driven |
| 3 | [phases/03-step-analyze.md](phases/03-step-analyze.md) | Analyze step artifacts | TaskUpdate driven + resume |
| 4 | [phases/04-synthesize.md](phases/04-synthesize.md) | Cross-step synthesis | TaskUpdate driven + resume |
| 5 | [phases/05-optimize-report.md](phases/05-optimize-report.md) | Generate final report | TaskUpdate driven |

## Data Flow

```
User Input (workflow steps / natural language + context)
    ↓
Phase 1: Setup
    ├─ [Format 1-3] Direct parse → steps[]
    ├─ [Format 4]   Semantic decompose → steps[]
    ↓
    Command Document (formatted plan)
    ↓
    User Confirmation (Execute / Edit / Cancel)
    ↓ (Execute confirmed)
    ↓ workDir, steps[], workflow-state.json, process-log.md
    ↓
┌─→ Phase 2: Execute Step N (ccw cli / Skill)
│   ↓ step-N/ artifacts
│   ↓
│   Phase 3: Analyze Step N (ccw cli gemini --resume)
│   ↓ step-N-analysis.md, process-log.md updated
│   ↓ analysisSessionId carried forward
│   ↓
│   [More steps?]─── YES ──→ next step (Phase 2)
│   ↓ NO
│   ↓
└───┘
    ↓
Phase 4: Synthesize (ccw cli gemini --resume)
    ↓ synthesis.md
    ↓
Phase 5: Report
    ↓ final-report.md + optional auto-fix
    ↓
Done
```

## TaskUpdate Pattern

```javascript
// Initial state
TaskCreate({ subject: "Phase 1: Setup workspace", activeForm: "Parsing workflow" })
TaskCreate({ subject: "Step Loop", activeForm: "Executing steps" })
TaskCreate({ subject: "Phase 4-5: Synthesize & Report", activeForm: "Pending" })

// Per-step tracking
for (const step of state.steps) {
  TaskCreate({
    subject: `Step: ${step.name}`,
    activeForm: `Pending`,
    description: `${step.type}: ${step.command}`
  })
}

// During step execution
TaskUpdate(stepTask, {
  subject: `Step: ${step.name} — Executing`,
  activeForm: `Running ${step.command}`
})

// After step analysis
TaskUpdate(stepTask, {
  subject: `Step: ${step.name} — Analyzed`,
  activeForm: `Quality: ${stepQuality} | Issues: ${issueCount}`,
  status: 'completed'
})

// Final
TaskUpdate(synthesisTask, {
  subject: `Synthesis & Report (${state.steps.length} steps, ${totalIssues} issues)`,
  status: 'completed'
})
```

## Resume Chain Strategy

```
Step 1 Execute → artifacts
Step 1 Analyze → ccw cli gemini --mode analysis → sessionId_1
Step 2 Execute → artifacts
Step 2 Analyze → ccw cli gemini --mode analysis --resume sessionId_1 → sessionId_2
  ...
Step N Analyze → sessionId_N
Synthesize   → ccw cli gemini --mode analysis --resume sessionId_N → final
```

Each analysis step resumes the previous session, maintaining full context of:
- All prior step observations
- Accumulated quality patterns
- Cross-step dependency insights

## Error Handling

| Phase | Error | Recovery |
|-------|-------|----------|
| 2: Execute | CLI timeout/crash | Retry once, then record failure and continue to next step |
| 2: Execute | Skill not found | Skip step, note in process-log |
| 3: Analyze | CLI fails | Retry without --resume, start fresh session |
| 3: Analyze | Resume session not found | Start fresh analysis session |
| 4: Synthesize | CLI fails | Generate report from individual step analyses only |
| Any | 3+ consecutive errors | Terminate with partial report |

**Error Budget**: Each step gets 1 retry. 3 consecutive failures triggers early termination.

## Core Rules

1. **Start Immediately**: First action is preference collection → Phase 1 setup
2. **Progressive Loading**: Read phase doc ONLY when that phase is about to execute
3. **Inspect Before Proceed**: Always check step artifacts before moving to next step
4. **Background CLI**: ccw cli runs in background, wait for hook callback before proceeding
5. **Resume Chain**: Maintain analysis session continuity via --resume
6. **Process Documentation**: Every step observation goes into process-log.md
7. **Single State Source**: `workflow-state.json` is the only source of truth
8. **DO NOT STOP**: Continuous execution until all steps processed
