---
name: workflow-lite-plan-execute
description: Lightweight planning and execution skill. Exploration → Clarification → Planning → Confirmation → Execution via lite-execute.
allowed-tools: spawn_agent, wait, send_input, close_agent, AskUserQuestion, Read, Write, Edit, Bash, Glob, Grep, mcp__ace-tool__search_context
---

# Planning Workflow

Lightweight planning skill: Lite Plan produces an implementation plan, then hands off to Lite Execute for task execution.

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│  Planning Workflow Orchestrator (SKILL.md)         │
│  → Parse args → Lite Plan → Lite Execute          │
└────────────┬─────────────────────────────────────┘
             │
    ┌────────┴────────┐
    ↓                 ↓
┌────────┐     ┌────────────┐
│Phase 1 │────→│  Phase 4   │
│  Lite  │     │   Lite     │
│  Plan  │     │  Execute   │
└────────┘     └────────────┘
```

## Key Design Principles

1. **Shared Execution**: Lite Plan produces `executionContext` consumed by Phase 4 (lite-execute)
2. **Progressive Phase Loading**: Only load phase docs when about to execute
3. **Auto-Continue**: Planning completes → automatically loads execution phase
4. **Default Auto Mode**: When `--yes`, skip confirmations and auto-approve plan

## Auto Mode

When `--yes` or `-y`: Auto-approve plan, skip clarifications, use default execution settings.

## Usage

```
Skill(skill="workflow-lite-plan-execute", args="<task description>")
Skill(skill="workflow-lite-plan-execute", args="[FLAGS] \"<task description>\"")

# Flags
-y, --yes                              Skip all confirmations (auto mode)
-e, --explore                          Force exploration phase

# Examples
Skill(skill="workflow-lite-plan-execute", args="\"Implement JWT authentication\"")
Skill(skill="workflow-lite-plan-execute", args="-y \"Add user profile page\"")
Skill(skill="workflow-lite-plan-execute", args="-e \"Refactor payment module\"")
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
   ├─ Extract flags: --yes, --explore
   └─ Extract task description (string or file path)

Planning Phase:
   └─ Phase 1: Lite Plan
       └─ Ref: phases/01-lite-plan.md
          └─ Output: executionContext (plan.json + explorations + selections)

Execution Phase:
   └─ Phase 4: Lite Execute
       └─ Ref: phases/04-lite-execute.md
          └─ Input: executionContext from planning phase
          └─ Output: Executed tasks + optional code review
```

**Phase Reference Documents** (read on-demand when phase executes):

| Phase | Document | Purpose |
|-------|----------|---------|
| 1 | [phases/01-lite-plan.md](phases/01-lite-plan.md) | Lightweight planning with exploration, clarification, and plan generation |
| 4 | [phases/04-lite-execute.md](phases/04-lite-execute.md) | Shared execution engine: task grouping, batch execution, code review |

## Orchestrator Logic

```javascript
// Flag parsing
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')
const forceExplore = $ARGUMENTS.includes('--explore') || $ARGUMENTS.includes('-e')
const taskDescription = extractTaskDescription($ARGUMENTS)

// Phase 1: Lite Plan
Read('phases/01-lite-plan.md')
// Execute planning phase...

// After planning completes:
Read('phases/04-lite-execute.md')
// Execute execution phase with executionContext from Phase 1
```

## Data Flow

```
Phase 1: Lite Plan
   │
   ├─ Produces: executionContext = {
   │     planObject: plan.json,
   │     explorationsContext,
   │     clarificationContext,
   │     executionMethod: "Agent" | "Codex" | "Auto",
   │     codeReviewTool: "Skip" | "Gemini Review" | ...,
   │     originalUserInput: string,
   │     session: { id, folder, artifacts }
   │   }
   │
   ↓
Phase 4: Lite Execute
   │
   ├─ Consumes: executionContext
   ├─ Task grouping → Batch creation → Parallel/sequential execution
   ├─ Optional code review
   └─ Development index update
```

## TodoWrite Pattern

**Initialization**:
```json
[
  {"content": "Lite Plan - Planning", "status": "in_progress", "activeForm": "Planning"},
  {"content": "Execution (Phase 4)", "status": "pending", "activeForm": "Executing tasks"}
]
```

**After planning completes**:
```json
[
  {"content": "Lite Plan - Planning", "status": "completed", "activeForm": "Planning"},
  {"content": "Execution (Phase 4)", "status": "in_progress", "activeForm": "Executing tasks"}
]
```

Phase-internal sub-tasks are managed by each phase document (attach/collapse pattern).

## Core Rules

1. **Planning phase NEVER executes code** - all execution delegated to Phase 4
2. **Phase 4 ALWAYS runs** after planning completes
3. **executionContext is the contract** between planning and execution phases
4. **Progressive loading**: Read phase doc ONLY when about to execute
5. **Explicit Lifecycle**: Always close_agent after wait completes to free resources

## Error Handling

| Error | Resolution |
|-------|------------|
| Planning phase failure | Display error, offer retry |
| executionContext missing | Error: planning phase did not produce context |
| Phase file not found | Error with file path for debugging |

## Related Skills

- Full planning workflow: [workflow-plan-execute/SKILL.md](../workflow-plan-execute/SKILL.md)
- Brainstorming: [workflow-brainstorm-auto-parallel/SKILL.md](../workflow-brainstorm-auto-parallel/SKILL.md)
