---
description: Execute workflow tasks sequentially from session folder
argument-hint: SESSION=<path-to-session-folder>
---

# Workflow Execute (Codex Version)

## Core Principle

**Serial Execution**: Execute tasks ONE BY ONE in dependency order. Complete current task fully before moving to next. Continue autonomously until ALL tasks complete.

## Input

Session folder path via `$SESSION` (e.g., `.workflow/active/WFS-auth-system`)

## Autonomous Execution Loop

```
INIT: Validate session folder structure

WHILE tasks remain:
  1. Read TODO_LIST.md → Get task statuses
  2. Find FIRST pending task with met dependencies
  3. Read task JSON from .task/{task-id}.json
  4. Execute task fully (pre-analysis → implementation → verification)
  5. Update task JSON status to "completed"
  6. Output progress: "[X/N] ✓ {task.title}"
  7. CONTINUE to next task (DO NOT STOP)

WHEN all tasks completed:
  Output final summary
```

## Execution Steps

### Step 1: Validate Session

Check required files exist:
```
$SESSION/
├── IMPL_PLAN.md        ← Required
├── TODO_LIST.md        ← Required
└── .task/              ← Required, must have IMPL-*.json
```

If missing, report error and stop.

### Step 2: Parse TODO_LIST.md

Extract task list with current statuses:
```markdown
- [x] IMPL-1: Task 1 title (completed)
- [ ] IMPL-1.1: Task 2 title (pending) ← Execute this
- [ ] IMPL-2: Task 3 title (pending, depends on IMPL-1.1)
```

### Step 3: Find Next Executable Task

```javascript
// Sequential scan for first eligible task
for (task of todoList) {
  if (task.completed) continue
  
  // Check dependencies from task JSON
  taskJson = read(`$SESSION/.task/${task.id}.json`)
  if (taskJson.depends_on?.every(dep => isCompleted(dep))) {
    return task  // Execute this one
  }
}
return null  // All done or all blocked
```

### Step 4: Load Task Context

```bash
# Read task definition
cat $SESSION/.task/$TASK_ID.json

# Read context package if exists
cat $SESSION/.process/context-package.json
```

### Step 5: Execute Task

#### 5A: Pre-Analysis (if flow_control.pre_analysis exists)
```markdown
## Pre-Analysis for: [task.title]

Execute each step:
1. [Read referenced files]
2. [Search for patterns]
3. [Load dependencies]
```

#### 5B: Implementation
```markdown
## Implementing: [task.title]

**Objective**: [context.objective]

**Steps**:
1. [flow_control.execution_steps[0]]
2. [flow_control.execution_steps[1]]
...

**Deliverables**:
- [ ] [context.deliverables[0]]
- [ ] [context.deliverables[1]]
```

#### 5C: Verification
```markdown
## Verifying: [task.title]

**Acceptance Criteria**:
- [x] [context.acceptance_criteria[0]]
- [x] [context.acceptance_criteria[1]]

All criteria met: YES → Mark completed
```

### Step 6: Update Status

Update task JSON:
```json
{
  "id": "IMPL-1.1",
  "status": "completed",  // Changed from "pending"
  "completed_at": "2025-12-15T..."
}
```

### Step 7: Continue Immediately

**DO NOT STOP. Return to Step 2 to find next task.**

Output progress:
```
✓ [3/7] Completed: IMPL-1.1 - [task title]
→ Next: IMPL-2 - [next task title]
```

## Task JSON Structure

```json
{
  "id": "IMPL-1.1",
  "title": "Task Title",
  "status": "pending|completed",
  "meta": {
    "type": "feature|test|docs",
    "execution_group": "group-id"
  },
  "context": {
    "objective": "What to achieve",
    "deliverables": ["output 1", "output 2"],
    "acceptance_criteria": ["check 1", "check 2"]
  },
  "flow_control": {
    "pre_analysis": ["step 1", "step 2"],
    "execution_steps": ["impl step 1", "impl step 2"]
  },
  "depends_on": ["IMPL-1"]
}
```

## Execution Rules

1. **Never stop mid-workflow** - Continue until all tasks complete
2. **One task at a time** - Fully complete before moving on
3. **Respect dependencies** - Skip blocked tasks, find next eligible
4. **Update status immediately** - Mark completed right after verification
5. **Self-verify** - All acceptance criteria must pass before marking done
6. **Handle blocked state** - If all remaining tasks blocked, report and stop

## Final Summary

When ALL tasks completed:

```markdown
## Workflow Execution Complete

**Session**: $SESSION
**Total Tasks**: N
**Completed**: N

### Execution Log
| # | Task ID | Title | Status |
|---|---------|-------|--------|
| 1 | IMPL-1 | ... | ✓ |
| 2 | IMPL-1.1 | ... | ✓ |
| 3 | IMPL-2 | ... | ✓ |

### Files Modified
- `src/auth/login.ts`
- `src/utils/validator.ts`

### Summary
[What was accomplished across all tasks]
```

## Error Handling

| Situation | Action |
|-----------|--------|
| Session folder not found | Error and stop |
| Missing required files | Error: specify which file missing |
| Task JSON not found | Error, skip task, continue |
| Task blocked (deps not met) | Skip, find next eligible task |
| All tasks blocked | Report circular dependency, stop |
| Execution error | Report, mark task failed, continue to next |
| Verification failed | Retry once, then report and continue |
