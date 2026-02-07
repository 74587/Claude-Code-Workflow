---
name: workflow-plan-execute
description: 4-phase planning+execution workflow with action-planning-agent task generation, outputs IMPL_PLAN.md and task JSONs, optional Phase 4 execution. Triggers on "workflow:plan".
allowed-tools: spawn_agent, wait, send_input, close_agent, AskUserQuestion, Read, Write, Edit, Bash, Glob, Grep
---

# Workflow Plan

4-phase workflow that orchestrates session discovery, context gathering (with inline conflict resolution), task generation, and conditional execution to produce and implement plans (IMPL_PLAN.md, task JSONs, TODO_LIST.md).

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  Workflow Plan Orchestrator (SKILL.md)                                │
│  → Pure coordinator: Execute phases, parse outputs, pass context     │
└───────────────┬──────────────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┬───────────┐
    ↓           ↓           ↓           ↓           ↓
┌─────────┐ ┌──────────────────┐ ┌─────────┐ ┌─────────┐
│ Phase 1 │ │     Phase 2      │ │ Phase 3 │ │ Phase 4 │
│ Session │ │ Context Gather   │ │  Task   │ │Execute  │
│Discovery│ │& Conflict Resolve│ │Generate │ │(optional)│
└─────────┘ └──────────────────┘ └─────────┘ └─────────┘
     ↓              ↓                  ↓           ↓
  sessionId     contextPath       IMPL_PLAN.md  summaries
                conflict_risk     task JSONs    completed
                resolved          TODO_LIST.md  tasks
```

## Key Design Principles

1. **Pure Orchestrator**: Execute phases in sequence, parse outputs, pass context between them
2. **Auto-Continue**: All phases run autonomously without user intervention between phases
3. **Subagent Lifecycle**: Explicit lifecycle management with spawn_agent → wait → close_agent
4. **Progressive Phase Loading**: Phase docs are read on-demand, not all at once
5. **Inline Conflict Resolution**: Conflicts detected and resolved within Phase 2 (not a separate phase)
6. **Role Path Loading**: Subagent roles loaded via path reference in MANDATORY FIRST STEPS

## Auto Mode

When `--yes` or `-y`: Auto-continue all phases (skip confirmations), use recommended conflict resolutions, auto-execute Phase 4.

When `--with-commit`: Auto-commit after each task completion in Phase 4.

## Execution Flow

```
Input Parsing:
   └─ Convert user input to structured format (GOAL/SCOPE/CONTEXT)

Phase 1: Session Discovery
   └─ Ref: phases/01-session-discovery.md
      └─ Output: sessionId (WFS-xxx)

Phase 2: Context Gathering & Conflict Resolution
   └─ Ref: phases/02-context-gathering.md
      ├─ Step 1: Context-Package Detection
      ├─ Step 2: Complexity Assessment & Parallel Explore (conflict-aware)
      ├─ Step 3: Inline Conflict Resolution (conditional, if significant conflicts)
      ├─ Step 4: Invoke Context-Search Agent (with exploration + conflict results)
      ├─ Step 5: Output Verification
      └─ Output: contextPath + conflict_risk + optional conflict-resolution.json

Phase 3: Task Generation
   └─ Ref: phases/03-task-generation.md
      └─ Output: IMPL_PLAN.md, task JSONs, TODO_LIST.md

User Decision (or --yes auto):
   └─ "Start Execution" → Phase 4
   └─ "Verify Plan Quality" → workflow:plan-verify
   └─ "Review Status Only" → workflow:status

Phase 4: Execution (Conditional)
   └─ Ref: phases/04-execution.md
      └─ Output: completed tasks, summaries, session completion
```

**Phase Reference Documents** (read on-demand when phase executes):

| Phase | Document | Purpose |
|-------|----------|---------|
| 1 | [phases/01-session-discovery.md](phases/01-session-discovery.md) | Session creation/discovery with intelligent session management |
| 2 | [phases/02-context-gathering.md](phases/02-context-gathering.md) | Context collection + inline conflict resolution |
| 3 | [phases/03-task-generation.md](phases/03-task-generation.md) | Implementation plan and task JSON generation |
| 4 | [phases/04-execution.md](phases/04-execution.md) | Task execution (conditional, triggered by user or --yes) |

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 execution
2. **No Preliminary Analysis**: Do not read files, analyze structure, or gather context before Phase 1
3. **Parse Every Output**: Extract required data from each phase output for next phase
4. **Auto-Continue via TodoList**: Check TodoList status to execute next pending phase automatically
5. **Track Progress**: Update TodoWrite dynamically with task attachment/collapse pattern
6. **Progressive Phase Loading**: Read phase docs ONLY when that phase is about to execute
7. **DO NOT STOP**: Continuous multi-phase workflow. After completing each phase, immediately proceed to next
8. **Explicit Lifecycle**: Always close_agent after wait completes to free resources

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

## Input Processing

**Convert User Input to Structured Format**:

1. **Simple Text** → Structure it:
   ```
   User: "Build authentication system"

   Structured:
   GOAL: Build authentication system
   SCOPE: Core authentication features
   CONTEXT: New implementation
   ```

2. **Detailed Text** → Extract components:
   ```
   User: "Add JWT authentication with email/password login and token refresh"

   Structured:
   GOAL: Implement JWT-based authentication
   SCOPE: Email/password login, token generation, token refresh endpoints
   CONTEXT: JWT token-based security, refresh token rotation
   ```

3. **File Reference** (e.g., `requirements.md`) → Read and structure:
   - Read file content
   - Extract goal, scope, requirements
   - Format into structured description

## Data Flow

```
User Input (task description)
    ↓
[Convert to Structured Format]
    ↓ Structured Description:
    ↓   GOAL: [objective]
    ↓   SCOPE: [boundaries]
    ↓   CONTEXT: [background]
    ↓
Phase 1: session:start --auto "structured-description"
    ↓ Output: sessionId
    ↓ Write: planning-notes.md (User Intent section)
    ↓
Phase 2: context-gather --session sessionId "structured-description"
    ↓ Input: sessionId + structured description
    ↓ Step 2: Parallel exploration (with conflict detection)
    ↓ Step 3: Inline conflict resolution (if significant conflicts detected)
    ↓ Step 4: Context-search-agent packaging
    ↓ Output: contextPath (context-package.json with prioritized_context)
    ↓         + optional conflict-resolution.json
    ↓ Update: planning-notes.md (Context Findings + Conflict Decisions + Consolidated Constraints)
    ↓
Phase 3: task-generate-agent --session sessionId
    ↓ Input: sessionId + planning-notes.md + context-package.json + brainstorm artifacts
    ↓ Output: IMPL_PLAN.md, task JSONs, TODO_LIST.md
    ↓
User Decision: "Start Execution" / --yes auto
    ↓
Phase 4: Execute tasks (conditional)
    ↓ Input: sessionId + IMPL_PLAN.md + TODO_LIST.md + .task/*.json
    ↓ Loop: lazy load → spawn_agent → wait → close_agent → commit (optional)
    ↓ Output: completed tasks, summaries, session completion
```

**Session Memory Flow**: Each phase receives session ID, which provides access to:
- Previous task summaries
- Existing context and analysis
- Brainstorming artifacts (potentially modified by Phase 2 conflict resolution)
- Session-specific configuration

## TodoWrite Pattern

**Core Concept**: Dynamic task attachment and collapse for real-time visibility into workflow execution.

### Key Principles

1. **Task Attachment** (when phase executed):
   - Sub-command's internal tasks are **attached** to orchestrator's TodoWrite
   - **Phase 2**: Multiple sub-tasks attached (e.g., explore, conflict resolution, context packaging)
   - **Phase 3**: Single agent task attached
   - First attached task marked as `in_progress`, others as `pending`
   - Orchestrator **executes** these attached tasks sequentially

2. **Task Collapse** (after sub-tasks complete):
   - **Applies to Phase 2**: Remove detailed sub-tasks from TodoWrite
   - **Collapse** to high-level phase summary
   - **Phase 3**: No collapse needed (single task, just mark completed)
   - Maintains clean orchestrator-level view

3. **Continuous Execution**:
   - After completion, automatically proceed to next pending phase
   - No user intervention required between phases
   - TodoWrite dynamically reflects current execution state

**Lifecycle**: Initial pending tasks → Phase executed (tasks ATTACHED) → Sub-tasks executed sequentially → Phase completed (tasks COLLAPSED) → Next phase begins → Repeat until all phases complete.

## Phase-Specific TodoWrite Updates

### Phase 2 (Tasks Attached):
```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed"},
  {"content": "Phase 2: Context Gathering & Conflict Resolution", "status": "in_progress"},
  {"content": "  → Parallel exploration (conflict-aware)", "status": "in_progress"},
  {"content": "  → Inline conflict resolution (if needed)", "status": "pending"},
  {"content": "  → Context-search-agent packaging", "status": "pending"},
  {"content": "Phase 3: Task Generation", "status": "pending"}
]
```

### Phase 2 (Collapsed):
```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed"},
  {"content": "Phase 2: Context Gathering & Conflict Resolution", "status": "completed"},
  {"content": "Phase 3: Task Generation", "status": "pending"}
]
```

### Phase 4 (Tasks Attached, conditional):
```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed"},
  {"content": "Phase 2: Context Gathering & Conflict Resolution", "status": "completed"},
  {"content": "Phase 3: Task Generation", "status": "completed"},
  {"content": "Phase 4: Execution", "status": "in_progress"},
  {"content": "  → IMPL-1: [task title]", "status": "in_progress"},
  {"content": "  → IMPL-2: [task title]", "status": "pending"},
  {"content": "  → IMPL-3: [task title]", "status": "pending"}
]
```

## Planning Notes Template

After Phase 1, create `planning-notes.md` with this structure:

```markdown
# Planning Notes

**Session**: ${sessionId}
**Created**: ${timestamp}

## User Intent (Phase 1)

- **GOAL**: ${userGoal}
- **KEY_CONSTRAINTS**: ${userConstraints}

---

## Context Findings (Phase 2)
(To be filled by context-gather)

## Conflict Decisions (Phase 2)
(To be filled if conflicts detected)

## Consolidated Constraints (Phase 3 Input)
1. ${userConstraints}

---

## Task Generation (Phase 3)
(To be filled by action-planning-agent)

## N+1 Context
### Decisions
| Decision | Rationale | Revisit? |
|----------|-----------|----------|

### Deferred
- [ ] (For N+1)
```

## Post-Phase Updates

### After Phase 2

Read context-package to extract key findings, update planning-notes.md:
- `Context Findings (Phase 2)`: CRITICAL_FILES, ARCHITECTURE, CONFLICT_RISK, CONSTRAINTS
- `Conflict Decisions (Phase 2)`: RESOLVED, CUSTOM_HANDLING, CONSTRAINTS (if conflicts were resolved inline)
- `Consolidated Constraints`: Append Phase 2 constraints (context + conflict)

### Memory State Check

After Phase 2, evaluate context window usage. If memory usage is high (>120K tokens):
```javascript
// Codex: Use compact command if available
codex compact
```

## Phase 3 User Decision

After Phase 3 completes, present user with action choices.

**Auto Mode** (`--yes`): Skip user decision, directly enter Phase 4 (Execution).

```javascript
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')

if (autoYes) {
  // Auto mode: Skip decision, proceed to Phase 4
  console.log(`[--yes] Auto-continuing to Phase 4: Execution`)
  // Read phases/04-execution.md and execute Phase 4
} else {
  ASK_USER([{
    id: "phase3-next-action",
    type: "select",
    prompt: "Planning complete. What would you like to do next?",
    options: [
      {
        label: "Verify Plan Quality (Recommended)",
        description: "Run quality verification to catch issues before execution."
      },
      {
        label: "Start Execution",
        description: "Begin implementing tasks immediately (Phase 4)."
      },
      {
        label: "Review Status Only",
        description: "View task breakdown and session status without taking further action."
      }
    ]
  }])  // BLOCKS (wait for user response)
}

// Execute based on user choice
// "Verify Plan Quality" → workflow:plan-verify --session sessionId
// "Start Execution" → Read phases/04-execution.md, execute Phase 4 inline
// "Review Status Only" → workflow:status --session sessionId
```

## Error Handling

- **Parsing Failure**: If output parsing fails, retry command once, then report error
- **Validation Failure**: If validation fails, report which file/data is missing
- **Command Failure**: Keep phase `in_progress`, report error to user, do not proceed to next phase
- **Subagent Timeout**: If wait times out, evaluate whether to continue waiting or send_input to prompt completion

## Coordinator Checklist

- **Pre-Phase**: Convert user input to structured format (GOAL/SCOPE/CONTEXT)
- Parse flags: `--yes`, `--with-commit`
- Initialize TodoWrite before any command
- Execute Phase 1 immediately with structured description
- Parse session ID from Phase 1 output, store in memory
- Pass session ID and structured description to Phase 2 command
- Parse context path from Phase 2 output, store in memory
- **Phase 2 handles conflict resolution inline** (no separate Phase 3 decision needed)
- **Build Phase 3 command**: workflow:tools:task-generate-agent --session [sessionId]
- Verify all Phase 3 outputs
- **Phase 3 User Decision**: Present choices or auto-continue if `--yes`
- **Phase 4 (conditional)**: If user selects "Start Execution" or `--yes`, read phases/04-execution.md and execute
- Pass `--with-commit` flag to Phase 4 if present
- Update TodoWrite after each phase
- After each phase, automatically continue to next phase based on TodoList status
- **Always close_agent after wait completes**

## Related Commands

**Prerequisite Commands**:
- `workflow:brainstorm:artifacts` - Optional: Generate role-based analyses before planning
- `workflow:brainstorm:synthesis` - Optional: Refine brainstorm analyses with clarifications

**Follow-up Commands**:
- `workflow:plan-verify` - Recommended: Verify plan quality before execution
- `workflow:status` - Review task breakdown and current progress
- `workflow:execute` - Begin implementation (also available via Phase 4 inline execution)
