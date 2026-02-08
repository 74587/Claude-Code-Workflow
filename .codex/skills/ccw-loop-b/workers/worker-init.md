# Worker: INIT

Session initialization worker. Parse requirements, create execution plan.

## Purpose

- Parse task description and project context
- Break task into development phases
- Generate initial task list
- Create progress document structure

## Preconditions

- `state.status === 'running'`
- `state.skill_state.phase === 'init'` or first run

## Execution

### Step 1: Read Project Context

```javascript
// MANDATORY FIRST STEPS (already in prompt)
// 1. Read role definition
// 2. Read ${projectRoot}/.workflow/project-tech.json
// 3. Read ${projectRoot}/.workflow/project-guidelines.json
```

### Step 2: Analyze Task

```javascript
// Use ACE search_context to find relevant patterns
const searchResults = mcp__ace_tool__search_context({
  project_root_path: '.',
  query: `code related to: ${state.description}`
})

// Parse task into 3-7 development tasks
const tasks = analyzeAndDecompose(state.description, searchResults)
```

### Step 3: Create Task Breakdown

```javascript
const breakdown = tasks.map((t, i) => ({
  id: `T${i + 1}`,
  description: t.description,
  priority: t.priority || i + 1,
  status: 'pending',
  files: t.relatedFiles || []
}))
```

### Step 4: Initialize Progress Document

```javascript
const progressPath = `${progressDir}/develop.md`

Write(progressPath, `# Development Progress

**Loop ID**: ${loopId}
**Task**: ${state.description}
**Started**: ${getUtc8ISOString()}

---

## Task List

${breakdown.map((t, i) => `${i + 1}. [ ] ${t.description}`).join('\n')}

---

## Progress Timeline

`)
```

### Step 5: Update State

```javascript
state.skill_state.pending_tasks = breakdown
state.skill_state.phase = 'init'
state.skill_state.workers_completed.push('init')
saveState(loopId, state)
```

## Output Format

```
WORKER_RESULT:
- action: init
- status: success
- summary: Initialized with {N} development tasks
- files_changed: []
- next_suggestion: develop
- loop_back_to: null

DETAILED_OUTPUT:
TASK_BREAKDOWN:
- T1: {description}
- T2: {description}
...

EXECUTION_PLAN:
1. Develop (T1-T2)
2. Validate
3. Complete
```

## Error Handling

| Error | Recovery |
|-------|----------|
| Task analysis failed | Create single generic task |
| Project context missing | Proceed without context |
| State write failed | Retry once, then report |
