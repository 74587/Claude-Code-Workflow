---
name: workflow-lite-plan-execute
description: Lightweight planning + execution workflow. Exploration -> Clarification -> Planning -> Confirmation -> Execution (via lite-execute).
allowed-tools: spawn_agent, wait, send_input, close_agent, AskUserQuestion, Read, Write, Edit, Bash, Glob, Grep, mcp__ace-tool__search_context
---

# Planning Workflow

Lite Plan produces an implementation plan and an `executionContext`, then hands off to Lite Execute for task execution.

## Key Design Principles

1. **Shared Execution**: Lite Plan produces `executionContext` consumed by Phase 2 (Lite Execute)
2. **Progressive Phase Loading**: Only load phase docs when about to execute
3. **Auto-Continue**: After the plan is confirmed ("Allow"), automatically load execution phase
4. **Default Auto Mode**: When `--yes`, skip confirmations and auto-approve the plan

## Auto Mode

When `--yes` or `-y`:
- Auto-approve plan and use default execution settings
- Skip non-critical clarifications; still ask minimal clarifications if required for safety/correctness

## Usage (Pseudo)

This section describes the skill input shape; actual invocation depends on the host runtime.

```
$workflow-lite-plan-execute <task description>
$workflow-lite-plan-execute [FLAGS] "<task description or file path>"

# Flags
-y, --yes                              Skip confirmations (auto mode)
-e, --explore                          Force exploration phase
```

Examples:
```
$workflow-lite-plan-execute "Implement JWT authentication"
$workflow-lite-plan-execute -y "Add user profile page"
$workflow-lite-plan-execute -e "Refactor payment module"
$workflow-lite-plan-execute "docs/todo.md"
```

> **Implementation sketch**: 编排器内部使用 `Skill(skill="workflow-lite-plan-execute", args="...")` 接口调用，此为伪代码示意，非命令行语法。

## Phase Reference Documents (Read On Demand)

| Phase | Document | Purpose |
|-------|----------|---------|
| 1 | `phases/01-lite-plan.md` | Lightweight planning with exploration, clarification, plan generation, and confirmation |
| 2 | `phases/02-lite-execute.md` | Shared execution engine: task grouping, batch execution, optional code review |

## Orchestrator Logic

```javascript
// Flag parsing
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')
const forceExplore = $ARGUMENTS.includes('--explore') || $ARGUMENTS.includes('-e')

// Task extraction rule:
// - Strip known flags: -y/--yes, -e/--explore
// - Remaining args are joined as the task description
// - Treat it as a file path ONLY if (a) exactly one arg remains AND (b) the path exists
function extractTaskDescription(args) {
  const knownFlags = new Set(['--yes', '-y', '--explore', '-e'])
  const rest = args.filter(a => !knownFlags.has(a))
  if (rest.length === 1 && file_exists(rest[0])) return rest[0]
  return rest.join(' ').trim()
}

const taskDescription = extractTaskDescription($ARGUMENTS)

// Phase 1: Lite Plan
Read('phases/01-lite-plan.md')
// Execute planning phase...

// Gate: only continue when confirmed (or --yes)
if (executionContext?.userSelection?.confirmation !== 'Allow' && !autoYes) {
  // Stop: user cancelled or requested modifications
  return
}

// Phase 2: Lite Execute
Read('phases/02-lite-execute.md')
// Execute execution phase with executionContext from Phase 1
```

## executionContext Contract (High Level)

`executionContext` is the only contract between Phase 1 and Phase 2.

Required (minimum) fields:
```javascript
{
  planObject: { summary, approach, tasks, complexity, estimated_time, recommended_execution },
  originalUserInput: string,
  executionMethod: "Agent" | "Codex" | "Auto",
  codeReviewTool: "Skip" | "Gemini Review" | "Codex Review" | "Agent Review" | string,
  userSelection: { confirmation: "Allow" | "Modify" | "Cancel" }
}
```

Recommended fields:
- `explorationsContext`, `clarificationContext`, `executorAssignments`, and `session` (artifacts folder + paths)

## TodoWrite Pattern

Initialization:
```json
[
  {"content": "Lite Plan - Planning", "status": "in_progress", "activeForm": "Planning"},
  {"content": "Execution (Phase 2)", "status": "pending", "activeForm": "Executing tasks"}
]
```

After planning completes:
```json
[
  {"content": "Lite Plan - Planning", "status": "completed", "activeForm": "Planning"},
  {"content": "Execution (Phase 2)", "status": "in_progress", "activeForm": "Executing tasks"}
]
```

## Core Rules

1. **Planning phase NEVER modifies project code** - it may write planning artifacts, but all implementation is delegated to Phase 2
2. **Phase 2 runs only after confirmation** - execute only when confirmation is "Allow" (or `--yes` auto mode)
3. **executionContext is the contract** between planning and execution phases
4. **Progressive loading**: Read phase doc only when about to execute
5. **File-path detection**: Treat input as a file path only if the path exists; do not infer from file extensions
6. **Explicit lifecycle**: Always `close_agent` after `wait` completes

## Error Handling

| Error | Resolution |
|-------|------------|
| Planning phase failure | Display error, offer retry |
| executionContext missing | Error: planning phase did not produce context |
| Phase file not found | Error with file path for debugging |

## Related Skills

- Full planning workflow: `../workflow-plan-execute/SKILL.md`
- Brainstorming: `../workflow-brainstorm-auto-parallel/SKILL.md`
