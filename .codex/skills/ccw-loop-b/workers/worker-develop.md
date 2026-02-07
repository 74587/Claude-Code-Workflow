# Worker: DEVELOP

Code implementation worker. Execute pending tasks, record changes.

## Purpose

- Execute next pending development task
- Implement code changes following project conventions
- Record progress to markdown and NDJSON log
- Update task status in state

## Preconditions

- `state.skill_state.pending_tasks.length > 0`
- `state.status === 'running'`

## Execution

### Step 1: Find Pending Task

```javascript
const tasks = state.skill_state.pending_tasks
const currentTask = tasks.find(t => t.status === 'pending')

if (!currentTask) {
  // All tasks done
  return WORKER_RESULT with next_suggestion: 'validate'
}

currentTask.status = 'in_progress'
```

### Step 2: Find Existing Patterns

```javascript
// Use ACE search_context to find similar implementations
const patterns = mcp__ace_tool__search_context({
  project_root_path: '.',
  query: `implementation patterns for: ${currentTask.description}`
})

// Study 3+ similar features/components
// Follow existing conventions
```

### Step 3: Implement Task

```javascript
// Use appropriate tools:
// - ACE search_context for finding patterns
// - Read for loading files
// - Edit/Write for making changes

const filesChanged = []
// ... implementation logic ...
```

### Step 4: Record Changes

```javascript
// Append to progress document
const progressEntry = `
### Task ${currentTask.id} - ${currentTask.description} (${getUtc8ISOString()})

**Files Changed**:
${filesChanged.map(f => `- \`${f}\``).join('\n')}

**Summary**: [implementation description]

**Status**: COMPLETED

---
`

const existingProgress = Read(`${progressDir}/develop.md`)
Write(`${progressDir}/develop.md`, existingProgress + progressEntry)
```

### Step 5: Update State

```javascript
currentTask.status = 'completed'
state.skill_state.completed_tasks.push(currentTask)
state.skill_state.pending_tasks = tasks.filter(t => t.status === 'pending')
saveState(loopId, state)
```

## Output Format

```
WORKER_RESULT:
- action: develop
- status: success
- summary: Implemented: {task_description}
- files_changed: ["file1.ts", "file2.ts"]
- next_suggestion: develop | validate
- loop_back_to: null

DETAILED_OUTPUT:
  tasks_completed: [T1]
  tasks_remaining: [T2, T3]
  metrics:
    lines_added: 180
    lines_removed: 15
```

## Clarification Mode

If task is ambiguous, output:

```
CLARIFICATION_NEEDED:
Q1: [question about implementation approach] | Options: [A, B] | Recommended: [A]
Q2: [question about scope] | Options: [A, B, C] | Recommended: [B]
```

## Error Handling

| Error | Recovery |
|-------|----------|
| Pattern unclear | Output CLARIFICATION_NEEDED |
| Task blocked | Mark blocked, suggest debug |
| Partial completion | Set loop_back_to: "develop" |
