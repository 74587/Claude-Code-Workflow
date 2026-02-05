---
name: workflow-plan
description: 5-phase planning workflow with action-planning-agent task generation, outputs IMPL_PLAN.md and task JSONs. Triggers on "workflow:plan".
allowed-tools: Task, AskUserQuestion, TodoWrite, Read, Write, Edit, Bash, Glob, Grep, Skill
---

# Workflow Plan

5-phase planning workflow that orchestrates session discovery, context gathering, conflict resolution, and task generation to produce implementation plans (IMPL_PLAN.md, task JSONs, TODO_LIST.md).

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Workflow Plan Orchestrator (SKILL.md)                           │
│  → Pure coordinator: Execute phases, parse outputs, pass context │
└───────────────┬─────────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┬───────────┐
    ↓           ↓           ↓           ↓           ↓
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Phase 1 │ │ Phase 2 │ │ Phase 3 │ │Phase 3.5│ │ Phase 4 │
│ Session │ │ Context │ │Conflict │ │  Gate   │ │  Task   │
│Discovery│ │ Gather  │ │Resolve  │ │(Optional)│ │Generate │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
     ↓           ↓           ↓                       ↓
  sessionId   contextPath  resolved             IMPL_PLAN.md
              conflict_risk artifacts            task JSONs
                                                 TODO_LIST.md
```

## Key Design Principles

1. **Pure Orchestrator**: Execute phases in sequence, parse outputs, pass context between them
2. **Auto-Continue**: All phases run autonomously without user intervention between phases
3. **Task Attachment Model**: Sub-tasks are attached/collapsed dynamically in TodoWrite
4. **Progressive Phase Loading**: Phase docs are read on-demand, not all at once
5. **Conditional Execution**: Phase 3 only executes when conflict_risk >= medium

## Auto Mode

When `--yes` or `-y`: Auto-continue all phases (skip confirmations), use recommended conflict resolutions.

## Usage

```
Skill(skill="workflow-plan", args="<task description>")
Skill(skill="workflow-plan", args="[-y|--yes] \"<task description>\"")

# Flags
-y, --yes    Skip all confirmations (auto mode)

# Arguments
<task description>    Task description text, structured GOAL/SCOPE/CONTEXT, or path to .md file

# Examples
Skill(skill="workflow-plan", args="\"Build authentication system\"")                    # Simple task
Skill(skill="workflow-plan", args="\"Add JWT auth with email/password and refresh\"")   # Detailed task
Skill(skill="workflow-plan", args="-y \"Implement user profile page\"")                 # Auto mode
Skill(skill="workflow-plan", args="\"requirements.md\"")                                # From file
```

## Execution Flow

```
Input Parsing:
   └─ Convert user input to structured format (GOAL/SCOPE/CONTEXT)

Phase 1: Session Discovery
   └─ Ref: phases/01-session-discovery.md
      └─ Output: sessionId (WFS-xxx)

Phase 2: Context Gathering
   └─ Ref: phases/02-context-gathering.md
      ├─ Tasks attached: Analyze structure → Identify integration → Generate package
      └─ Output: contextPath + conflict_risk

Phase 3: Conflict Resolution
   └─ Decision (conflict_risk check):
      ├─ conflict_risk ≥ medium → Ref: phases/03-conflict-resolution.md
      │   ├─ Tasks attached: Detect conflicts → Present to user → Apply strategies
      │   └─ Output: Modified brainstorm artifacts
      └─ conflict_risk < medium → Skip to Phase 4

Phase 4: Task Generation
   └─ Ref: phases/04-task-generation.md
      └─ Output: IMPL_PLAN.md, task JSONs, TODO_LIST.md

Return:
   └─ Summary with recommended next steps
```

**Phase Reference Documents** (read on-demand when phase executes):

| Phase | Document | Purpose |
|-------|----------|---------|
| 1 | [phases/01-session-discovery.md](phases/01-session-discovery.md) | Session creation/discovery with intelligent session management |
| 2 | [phases/02-context-gathering.md](phases/02-context-gathering.md) | Project context collection via context-search-agent |
| 3 | [phases/03-conflict-resolution.md](phases/03-conflict-resolution.md) | Conflict detection and resolution with CLI analysis |
| 4 | [phases/04-task-generation.md](phases/04-task-generation.md) | Implementation plan and task JSON generation |

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 execution
2. **No Preliminary Analysis**: Do not read files, analyze structure, or gather context before Phase 1
3. **Parse Every Output**: Extract required data from each phase output for next phase
4. **Auto-Continue via TodoList**: Check TodoList status to execute next pending phase automatically
5. **Track Progress**: Update TodoWrite dynamically with task attachment/collapse pattern
6. **Progressive Phase Loading**: Read phase docs ONLY when that phase is about to execute
7. **DO NOT STOP**: Continuous multi-phase workflow. After completing each phase, immediately proceed to next

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
    ↓ Output: contextPath (context-package.json with prioritized_context) + conflict_risk
    ↓ Update: planning-notes.md (Context Findings + Consolidated Constraints)
    ↓
Phase 3: conflict-resolution [AUTO-TRIGGERED if conflict_risk ≥ medium]
    ↓ Input: sessionId + contextPath + conflict_risk
    ↓ Output: Modified brainstorm artifacts
    ↓ Update: planning-notes.md (Conflict Decisions + Consolidated Constraints)
    ↓ Skip if conflict_risk is none/low → proceed directly to Phase 4
    ↓
Phase 4: task-generate-agent --session sessionId
    ↓ Input: sessionId + planning-notes.md + context-package.json + brainstorm artifacts
    ↓ Output: IMPL_PLAN.md, task JSONs, TODO_LIST.md
    ↓
Return summary to user
```

**Session Memory Flow**: Each phase receives session ID, which provides access to:
- Previous task summaries
- Existing context and analysis
- Brainstorming artifacts (potentially modified by Phase 3)
- Session-specific configuration

## TodoWrite Pattern

**Core Concept**: Dynamic task attachment and collapse for real-time visibility into workflow execution.

### Key Principles

1. **Task Attachment** (when phase executed):
   - Sub-command's internal tasks are **attached** to orchestrator's TodoWrite
   - **Phase 2, 3**: Multiple sub-tasks attached (e.g., Phase 2.1, 2.2, 2.3)
   - **Phase 4**: Single agent task attached
   - First attached task marked as `in_progress`, others as `pending`
   - Orchestrator **executes** these attached tasks sequentially

2. **Task Collapse** (after sub-tasks complete):
   - **Applies to Phase 2, 3**: Remove detailed sub-tasks from TodoWrite
   - **Collapse** to high-level phase summary
   - **Phase 4**: No collapse needed (single task, just mark completed)
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
  {"content": "Phase 2: Context Gathering", "status": "in_progress"},
  {"content": "  → Analyze codebase structure", "status": "in_progress"},
  {"content": "  → Identify integration points", "status": "pending"},
  {"content": "  → Generate context package", "status": "pending"},
  {"content": "Phase 4: Task Generation", "status": "pending"}
]
```

### Phase 2 (Collapsed):
```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed"},
  {"content": "Phase 2: Context Gathering", "status": "completed"},
  {"content": "Phase 4: Task Generation", "status": "pending"}
]
```

### Phase 3 (Conditional, Tasks Attached):
```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed"},
  {"content": "Phase 2: Context Gathering", "status": "completed"},
  {"content": "Phase 3: Conflict Resolution", "status": "in_progress"},
  {"content": "  → Detect conflicts with CLI analysis", "status": "in_progress"},
  {"content": "  → Present conflicts to user", "status": "pending"},
  {"content": "  → Apply resolution strategies", "status": "pending"},
  {"content": "Phase 4: Task Generation", "status": "pending"}
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

## Conflict Decisions (Phase 3)
(To be filled if conflicts detected)

## Consolidated Constraints (Phase 4 Input)
1. ${userConstraints}

---

## Task Generation (Phase 4)
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
- `Consolidated Constraints`: Append Phase 2 constraints

### After Phase 3

If executed, read conflict-resolution.json, update planning-notes.md:
- `Conflict Decisions (Phase 3)`: RESOLVED, MODIFIED_ARTIFACTS, CONSTRAINTS
- `Consolidated Constraints`: Append Phase 3 planning constraints

### Memory State Check

After Phase 3, evaluate context window usage. If memory usage is high (>120K tokens):
```javascript
Skill(skill="compact")
```

## Phase 4 User Decision

After Phase 4 completes, present user with action choices:

```javascript
AskUserQuestion({
  questions: [{
    question: "Planning complete. What would you like to do next?",
    header: "Next Action",
    multiSelect: false,
    options: [
      {
        label: "Verify Plan Quality (Recommended)",
        description: "Run quality verification to catch issues before execution."
      },
      {
        label: "Start Execution",
        description: "Begin implementing tasks immediately."
      },
      {
        label: "Review Status Only",
        description: "View task breakdown and session status without taking further action."
      }
    ]
  }]
});

// Execute based on user choice
// "Verify Plan Quality" → Skill(skill="workflow:plan-verify", args="--session " + sessionId)
// "Start Execution" → Skill(skill="workflow:execute", args="--session " + sessionId)
// "Review Status Only" → Skill(skill="workflow:status", args="--session " + sessionId)
```

## Error Handling

- **Parsing Failure**: If output parsing fails, retry command once, then report error
- **Validation Failure**: If validation fails, report which file/data is missing
- **Command Failure**: Keep phase `in_progress`, report error to user, do not proceed to next phase

## Coordinator Checklist

- **Pre-Phase**: Convert user input to structured format (GOAL/SCOPE/CONTEXT)
- Initialize TodoWrite before any command (Phase 3 added dynamically after Phase 2)
- Execute Phase 1 immediately with structured description
- Parse session ID from Phase 1 output, store in memory
- Pass session ID and structured description to Phase 2 command
- Parse context path from Phase 2 output, store in memory
- **Extract conflict_risk from context-package.json**: Determine Phase 3 execution
- **If conflict_risk >= medium**: Launch Phase 3 with sessionId and contextPath
- **If conflict_risk is none/low**: Skip Phase 3, proceed directly to Phase 4
- **Build Phase 4 command**: `/workflow:tools:task-generate-agent --session [sessionId]`
- Verify all Phase 4 outputs
- Update TodoWrite after each phase
- After each phase, automatically continue to next phase based on TodoList status

## Related Commands

**Prerequisite Commands**:
- `/workflow:brainstorm:artifacts` - Optional: Generate role-based analyses before planning
- `/workflow:brainstorm:synthesis` - Optional: Refine brainstorm analyses with clarifications

**Follow-up Commands**:
- `/workflow:plan-verify` - Recommended: Verify plan quality before execution
- `/workflow:status` - Review task breakdown and current progress
- `/workflow:execute` - Begin implementation of generated tasks
