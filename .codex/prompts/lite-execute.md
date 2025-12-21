---
description: Execute tasks sequentially from plan.json file
argument-hint: FILE=<path>
---

# Workflow Lite-Execute (Codex Version)

## Core Principle

**Serial Execution**: Execute tasks ONE BY ONE in order. Complete current task fully before moving to next. Continue until ALL tasks complete.

## Input

Read plan file at `$FILE` path (e.g., `.workflow/.lite-plan/session-id/plan.json`)

## Autonomous Execution Loop

```
WHILE tasks remain:
  1. Read plan.json → Get task list
  2. Find FIRST task with status != "completed"
  3. IF task.depends_on exists:
     - Check all dependencies completed
     - IF not met → Skip, find next eligible task
  4. Execute current task fully
  5. Mark task completed in plan.json
  6. Output progress: "[X/N] Task completed: {title}"
  7. CONTINUE to next task (DO NOT STOP)

WHEN all tasks completed:
  Output final summary
```

## Step-by-Step Execution

### Step 1: Load Plan

```bash
cat $FILE
```

Parse JSON, extract:
- `summary`: Overall goal
- `tasks[]`: Task list with status

### Step 2: Find Next Task

```javascript
// Find first non-completed task with met dependencies
for (task of tasks) {
  if (task.status === "completed") continue
  if (task.depends_on?.every(dep => getTask(dep).status === "completed")) {
    return task  // Execute this one
  }
}
return null  // All done
```

### Step 3: Execute Task

For current task, perform:

```markdown
## Executing: [task.title]

**Target**: `[task.file]`
**Action**: [task.action]

### Implementation
[Follow task.implementation steps]

### Reference Pattern
- Pattern: [task.reference.pattern]
- Examples: [task.reference.files]

### Acceptance Criteria
- [ ] [criterion 1]
- [ ] [criterion 2]
```

**Execute all implementation steps. Verify all acceptance criteria.**

### Step 4: Mark Completed

Update task status in plan.json:
```json
{
  "id": "task-id",
  "status": "completed"  // Change from "pending"
}
```

### Step 5: Continue

**DO NOT STOP. Immediately proceed to Step 2 to find next task.**

Output progress:
```
✓ [2/5] Completed: [task.title]
→ Next: [next_task.title]
```

## Task Format Reference

```json
{
  "id": "task-1",
  "title": "Task Title",
  "file": "path/to/file.ts",
  "action": "create|modify|refactor",
  "description": "What to do",
  "implementation": ["step 1", "step 2"],
  "reference": {
    "pattern": "pattern name",
    "files": ["example1.ts", "example2.ts"]
  },
  "acceptance": ["criterion 1", "criterion 2"],
  "depends_on": ["task-0"],
  "status": "pending|completed"
}
```

## Execution Rules

1. **Never stop mid-workflow** - Continue until all tasks complete
2. **One task at a time** - Fully complete before moving on
3. **Respect dependencies** - Skip blocked tasks, return later
4. **Update status immediately** - Mark completed right after finishing
5. **Self-verify** - Check acceptance criteria before marking done

## Final Summary

When ALL tasks completed:

```markdown
## Execution Complete

**Plan**: $FILE
**Total Tasks**: N
**All Completed**: Yes

### Results
| # | Task | Status |
|---|------|--------|
| 1 | [title] | ✓ |
| 2 | [title] | ✓ |

### Files Modified
- `path/file1.ts`
- `path/file2.ts`

### Summary
[Brief description of what was accomplished]
```

## Error Handling

| Situation | Action |
|-----------|--------|
| File not found | Error and stop |
| Task blocked (deps not met) | Skip, try next task |
| All remaining tasks blocked | Report circular dependency |
| Task execution error | Report error, mark failed, continue to next |
| Acceptance criteria not met | Retry or report, then continue |
