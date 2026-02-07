---
name: workflow-lite-plan
description: Unified lightweight planning skill with mode selection (Lite Plan, Multi-CLI Plan, Lite Fix). Supports exploration, diagnosis, multi-CLI collaboration, and shared execution via lite-execute.
allowed-tools: spawn_agent, wait, send_input, close_agent, AskUserQuestion, Read, Write, Edit, Bash, Glob, Grep, mcp__ace-tool__search_context
---

# Planning Workflow

Unified lightweight planning skill that consolidates multiple planning approaches into a single entry point with mode selection. Default mode: **Lite Plan**. All planning modes share a common execution phase (lite-execute).

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Planning Workflow Orchestrator (SKILL.md)                │
│  → Parse args → Mode selection → Load phase → Execute    │
└────────────┬─────────────────────────────────────────────┘
             │ Mode Selection (default: Lite Plan)
    ┌────────┼────────┬──────────┐
    ↓        ↓        ↓          ↓ (shared)
┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐
│Phase 1 │ │Phase 2 │ │Phase 3 │ │  Phase 4   │
│  Lite  │ │Multi-  │ │  Lite  │ │   Lite     │
│  Plan  │ │CLI Plan│ │  Fix   │ │  Execute   │
└────────┘ └────────┘ └────────┘ └────────────┘
     │          │          │           ↑
     └──────────┴──────────┴───────────┘
            (all hand off to Phase 4)
```

## Key Design Principles

1. **Mode Selection First**: User chooses planning approach before any work begins
2. **Shared Execution**: All planning modes produce `executionContext` consumed by Phase 4 (lite-execute)
3. **Progressive Phase Loading**: Only load the selected planning phase + execution phase
4. **Auto-Continue**: Planning phase completes → automatically loads execution phase
5. **Default Lite Plan**: When no mode specified, use Lite Plan (most common)

## Auto Mode

When `--yes` or `-y`: Skip mode selection (use default or flag-specified mode), auto-approve plan, skip clarifications.

## Usage

```
Skill(skill="workflow-lite-plan", args="<task description>")
Skill(skill="workflow-lite-plan", args="[FLAGS] \"<task description>\"")

# Flags
--mode lite-plan|multi-cli|lite-fix    Planning mode selection (default: lite-plan)
-y, --yes                              Skip all confirmations (auto mode)
-e, --explore                          Force exploration (lite-plan only)
--hotfix                               Fast hotfix mode (lite-fix only)

# Examples
Skill(skill="workflow-lite-plan", args="\"Implement JWT authentication\"")                              # Default: lite-plan
Skill(skill="workflow-lite-plan", args="--mode multi-cli \"Refactor payment module\"")                  # Multi-CLI planning
Skill(skill="workflow-lite-plan", args="--mode lite-fix \"Login fails with 500 error\"")                # Bug fix mode
Skill(skill="workflow-lite-plan", args="-y \"Add user profile page\"")                                  # Auto mode
Skill(skill="workflow-lite-plan", args="--mode lite-fix --hotfix \"Production DB timeout\"")            # Hotfix mode
```

## Subagent API Reference

### spawn_agent

Create a new subagent with task assignment.

```javascript
const agentId = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/{agent-type}.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

## TASK CONTEXT
${taskContext}

## DELIVERABLES
${deliverables}
`
})
```

### wait

Get results from subagent (only way to retrieve results).

```javascript
const result = wait({
  ids: [agentId],
  timeout_ms: 600000  // 10 minutes
})

if (result.timed_out) {
  // Handle timeout - can continue waiting or send_input to prompt completion
}
```

### send_input

Continue interaction with active subagent (for clarification or follow-up).

```javascript
send_input({
  id: agentId,
  message: `
## CLARIFICATION ANSWERS
${answers}

## NEXT STEP
Continue with plan generation.
`
})
```

### close_agent

Clean up subagent resources (irreversible).

```javascript
close_agent({ id: agentId })
```

## Execution Flow

```
Input Parsing:
   ├─ Extract flags: --mode, --yes, --explore, --hotfix
   └─ Extract task description (string or file path)

Mode Selection:
   └─ Decision:
      ├─ --mode lite-plan (or no --mode flag) → Read phases/01-lite-plan.md
      ├─ --mode multi-cli → Read phases/02-multi-cli-plan.md
      ├─ --mode lite-fix → Read phases/03-lite-fix.md
      └─ No flag + not --yes → AskUserQuestion (default: Lite Plan)

Planning Phase (one of):
   ├─ Phase 1: Lite Plan
   │   └─ Ref: phases/01-lite-plan.md
   │      └─ Output: executionContext (plan.json + explorations + selections)
   │
   ├─ Phase 2: Multi-CLI Plan
   │   └─ Ref: phases/02-multi-cli-plan.md
   │      └─ Output: executionContext (plan.json + synthesis rounds + selections)
   │
   └─ Phase 3: Lite Fix
       └─ Ref: phases/03-lite-fix.md
          └─ Output: executionContext (fix-plan.json + diagnoses + selections)

Execution Phase (always):
   └─ Phase 4: Lite Execute
       └─ Ref: phases/04-lite-execute.md
          └─ Input: executionContext from planning phase
          └─ Output: Executed tasks + optional code review
```

**Phase Reference Documents** (read on-demand when phase executes):

| Phase | Document | Purpose |
|-------|----------|---------|
| 1 | [phases/01-lite-plan.md](phases/01-lite-plan.md) | Lightweight planning with exploration, clarification, and plan generation |
| 2 | [phases/02-multi-cli-plan.md](phases/02-multi-cli-plan.md) | Multi-CLI collaborative planning with ACE context and cross-verification |
| 3 | [phases/03-lite-fix.md](phases/03-lite-fix.md) | Bug diagnosis and fix planning with severity-based workflow |
| 4 | [phases/04-lite-execute.md](phases/04-lite-execute.md) | Shared execution engine: task grouping, batch execution, code review |

## Mode Selection Logic

```javascript
// Flag parsing
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')
const modeFlag = extractFlag($ARGUMENTS, '--mode')  // 'lite-plan' | 'multi-cli' | 'lite-fix' | null

// Mode determination
let selectedMode

if (modeFlag) {
  // Explicit mode flag
  selectedMode = modeFlag
} else if (autoYes) {
  // Auto mode: default to lite-plan
  selectedMode = 'lite-plan'
} else {
  // Interactive: ask user
  const selection = AskUserQuestion({
    questions: [{
      question: "Select planning approach:",
      header: "Mode",
      multiSelect: false,
      options: [
        { label: "Lite Plan (Recommended)", description: "Lightweight planning with exploration and clarification" },
        { label: "Multi-CLI Plan", description: "Multi-model collaborative planning (Gemini + Codex + Claude)" },
        { label: "Lite Fix", description: "Bug diagnosis and fix planning with severity assessment" }
      ]
    }]
  })
  selectedMode = parseSelection(selection)  // Map to 'lite-plan' | 'multi-cli' | 'lite-fix'
}

// Load phase document
const phaseDoc = {
  'lite-plan': 'phases/01-lite-plan.md',
  'multi-cli': 'phases/02-multi-cli-plan.md',
  'lite-fix': 'phases/03-lite-fix.md'
}[selectedMode]

Read(phaseDoc)  // Load selected planning phase
// Execute planning phase...
// After planning completes:
Read('phases/04-lite-execute.md')  // Load execution phase
```

## Data Flow

```
Planning Phase (01/02/03)
   │
   ├─ Produces: executionContext = {
   │     planObject: plan.json or fix-plan.json,
   │     explorationsContext / diagnosisContext / synthesis rounds,
   │     clarificationContext,
   │     executionMethod: "Agent" | "Codex" | "Auto",
   │     codeReviewTool: "Skip" | "Gemini Review" | ...,
   │     originalUserInput: string,
   │     session: { id, folder, artifacts }
   │   }
   │
   ↓
Execution Phase (04)
   │
   ├─ Consumes: executionContext
   ├─ Task grouping → Batch creation → Parallel/sequential execution
   ├─ Optional code review
   └─ Development index update
```

## TodoWrite Pattern

**Initialization** (after mode selection):
```json
[
  {"content": "Mode: {selectedMode} - Planning", "status": "in_progress", "activeForm": "Planning ({selectedMode})"},
  {"content": "Execution (Phase 4)", "status": "pending", "activeForm": "Executing tasks"}
]
```

**After planning completes**:
```json
[
  {"content": "Mode: {selectedMode} - Planning", "status": "completed", "activeForm": "Planning ({selectedMode})"},
  {"content": "Execution (Phase 4)", "status": "in_progress", "activeForm": "Executing tasks"}
]
```

Phase-internal sub-tasks are managed by each phase document (attach/collapse pattern).

## Core Rules

1. **Planning phases NEVER execute code** - all execution delegated to Phase 4
2. **Only ONE planning phase runs** per invocation (Phase 1, 2, or 3)
3. **Phase 4 ALWAYS runs** after planning completes
4. **executionContext is the contract** between planning and execution phases
5. **Progressive loading**: Read phase doc ONLY when about to execute
6. **No cross-phase loading**: Don't load Phase 2 if user selected Phase 1
7. **Explicit Lifecycle**: Always close_agent after wait completes to free resources

## Error Handling

| Error | Resolution |
|-------|------------|
| Unknown --mode value | Default to lite-plan with warning |
| Planning phase failure | Display error, offer retry or mode switch |
| executionContext missing | Error: planning phase did not produce context |
| Phase file not found | Error with file path for debugging |

## Related Skills

- Full planning workflow: [workflow-plan/SKILL.md](../workflow-plan/SKILL.md)
- Brainstorming: [workflow-brainstorm-auto-parallel/SKILL.md](../workflow-brainstorm-auto-parallel/SKILL.md)
