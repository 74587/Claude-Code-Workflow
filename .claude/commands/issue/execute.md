---
name: execute
description: Execute queue with codex using DAG-based parallel orchestration (solution-level)
argument-hint: ""
allowed-tools: TodoWrite(*), Bash(*), Read(*), AskUserQuestion(*)
---

# Issue Execute Command (/issue:execute)

## Overview

Minimal orchestrator that dispatches **solution IDs** to executors. Each executor receives a complete solution with all its tasks.

**Design Principles:**
- `queue dag` → returns parallel batches with solution IDs (S-1, S-2, ...)
- `detail <id>` → READ-ONLY solution fetch (returns full solution with all tasks)
- `done <id>` → update solution completion status
- No race conditions: status changes only via `done`
- **Executor handles all tasks within a solution sequentially**

## Usage

```bash
/issue:execute
```

**Parallelism**: Determined automatically by task dependency DAG (no manual control)
**Executor & Dry-run**: Selected via interactive prompt (AskUserQuestion)

## Execution Flow

```
Phase 1: Get DAG & User Selection
   ├─ ccw issue queue dag → { parallel_batches: [["S-1","S-2"], ["S-3"]] }
   └─ AskUserQuestion → executor type (codex|gemini|agent), dry-run mode

Phase 2: Dispatch Parallel Batch (DAG-driven)
   ├─ Parallelism determined by DAG (no manual limit)
   ├─ For each solution ID in batch (parallel - all at once):
   │   ├─ Executor calls: ccw issue detail <id>  (READ-ONLY)
   │   ├─ Executor gets FULL SOLUTION with all tasks
   │   ├─ Executor implements all tasks sequentially (T1 → T2 → T3)
   │   ├─ Executor tests + commits per task
   │   └─ Executor calls: ccw issue done <id>
   └─ Wait for batch completion

Phase 3: Next Batch
   └─ ccw issue queue dag → check for newly-ready solutions
```

## Implementation

### Phase 1: Get DAG & User Selection

```javascript
// Get dependency graph and parallel batches
const dagJson = Bash(`ccw issue queue dag`).trim();
const dag = JSON.parse(dagJson);

if (dag.error || dag.ready_count === 0) {
  console.log(dag.error || 'No solutions ready for execution');
  console.log('Use /issue:queue to form a queue first');
  return;
}

console.log(`
## Queue DAG (Solution-Level)

- Total Solutions: ${dag.total}
- Ready: ${dag.ready_count}
- Completed: ${dag.completed_count}
- Parallel in batch 1: ${dag.parallel_batches[0]?.length || 0}
`);

// Interactive selection via AskUserQuestion
const answer = AskUserQuestion({
  questions: [
    {
      question: 'Select executor type:',
      header: 'Executor',
      multiSelect: false,
      options: [
        { label: 'Codex (Recommended)', description: 'Autonomous coding with full write access' },
        { label: 'Gemini', description: 'Large context analysis and implementation' },
        { label: 'Agent', description: 'Claude Code sub-agent for complex tasks' }
      ]
    },
    {
      question: 'Execution mode:',
      header: 'Mode',
      multiSelect: false,
      options: [
        { label: 'Execute (Recommended)', description: 'Run all ready solutions' },
        { label: 'Dry-run', description: 'Show DAG and batches without executing' }
      ]
    }
  ]
});

const executor = answer['Executor'].toLowerCase().split(' ')[0];  // codex|gemini|agent
const isDryRun = answer['Mode'].includes('Dry-run');

// Dry run mode
if (isDryRun) {
  console.log('### Parallel Batches (Dry-run):\n');
  dag.parallel_batches.forEach((batch, i) => {
    console.log(`Batch ${i + 1}: ${batch.join(', ')}`);
  });
  return;
}
```

### Phase 2: Dispatch Parallel Batch (DAG-driven)

```javascript
// Parallelism determined by DAG - no manual limit
// All solutions in same batch have NO file conflicts and can run in parallel
const batch = dag.parallel_batches[0] || [];

// Initialize TodoWrite
TodoWrite({
  todos: batch.map(id => ({
    content: `Execute solution ${id}`,
    status: 'pending',
    activeForm: `Executing solution ${id}`
  }))
});

console.log(`\n### Executing Solutions (DAG batch 1): ${batch.join(', ')}`);

// Launch ALL solutions in batch in parallel (DAG guarantees no conflicts)
const executions = batch.map(solutionId => {
  updateTodo(solutionId, 'in_progress');
  return dispatchExecutor(solutionId, executor);
});

await Promise.all(executions);
batch.forEach(id => updateTodo(id, 'completed'));
```

### Executor Dispatch

```javascript
function dispatchExecutor(solutionId, executorType) {
  // Executor fetches FULL SOLUTION via READ-ONLY detail command
  // Executor handles all tasks within solution sequentially
  // Then reports completion via done command
  const prompt = `
## Execute Solution ${solutionId}

### Step 1: Get Solution (read-only)
\`\`\`bash
ccw issue detail ${solutionId}
\`\`\`

### Step 2: Execute All Tasks Sequentially
The detail command returns a FULL SOLUTION with all tasks.
Execute each task in order (T1 → T2 → T3 → ...):

For each task:
1. Follow task.implementation steps
2. Run task.test commands
3. Verify task.acceptance criteria
4. Commit using task.commit specification

### Step 3: Report Completion
When ALL tasks in solution are done:
\`\`\`bash
ccw issue done ${solutionId} --result '{"summary": "...", "files_modified": [...], "tasks_completed": N}'
\`\`\`

If any task failed:
\`\`\`bash
ccw issue done ${solutionId} --fail --reason "Task TX failed: ..."
\`\`\`
`;

  if (executorType === 'codex') {
    return Bash(
      `ccw cli -p "${escapePrompt(prompt)}" --tool codex --mode write --id exec-${solutionId}`,
      { timeout: 7200000, run_in_background: true }  // 2hr for full solution
    );
  } else if (executorType === 'gemini') {
    return Bash(
      `ccw cli -p "${escapePrompt(prompt)}" --tool gemini --mode write --id exec-${solutionId}`,
      { timeout: 3600000, run_in_background: true }
    );
  } else {
    return Task({
      subagent_type: 'code-developer',
      run_in_background: false,
      description: `Execute solution ${solutionId}`,
      prompt: prompt
    });
  }
}
```

### Phase 3: Check Next Batch

```javascript
// Refresh DAG after batch completes
const refreshedDag = JSON.parse(Bash(`ccw issue queue dag`).trim());

console.log(`
## Batch Complete

- Solutions Completed: ${refreshedDag.completed_count}/${refreshedDag.total}
- Next ready: ${refreshedDag.ready_count}
`);

if (refreshedDag.ready_count > 0) {
  console.log('Run `/issue:execute` again for next batch.');
}
```

## Parallel Execution Model

```
┌─────────────────────────────────────────────────────────────┐
│ Orchestrator                                                │
├─────────────────────────────────────────────────────────────┤
│ 1. ccw issue queue dag                                      │
│    → { parallel_batches: [["S-1","S-2"], ["S-3"]] }        │
│                                                             │
│ 2. Dispatch batch 1 (parallel):                            │
│    ┌──────────────────────┐ ┌──────────────────────┐       │
│    │ Executor 1           │ │ Executor 2           │       │
│    │ detail S-1           │ │ detail S-2           │       │
│    │ → gets full solution │ │ → gets full solution │       │
│    │ [T1→T2→T3 sequential]│ │ [T1→T2 sequential]   │       │
│    │ done S-1             │ │ done S-2             │       │
│    └──────────────────────┘ └──────────────────────┘       │
│                                                             │
│ 3. ccw issue queue dag (refresh)                           │
│    → S-3 now ready (S-1 completed, file conflict resolved) │
└─────────────────────────────────────────────────────────────┘
```

**Why this works for parallel:**
- `detail <id>` is READ-ONLY → no race conditions
- Each executor handles **all tasks within a solution** sequentially
- `done <id>` updates only its own solution status
- `queue dag` recalculates ready solutions after each batch
- Solutions in same batch have NO file conflicts

## CLI Endpoint Contract

### `ccw issue queue dag`
Returns dependency graph with parallel batches (solution-level):
```json
{
  "queue_id": "QUE-...",
  "total": 3,
  "ready_count": 2,
  "completed_count": 0,
  "nodes": [
    { "id": "S-1", "issue_id": "ISS-xxx", "status": "pending", "ready": true, "task_count": 3 },
    { "id": "S-2", "issue_id": "ISS-yyy", "status": "pending", "ready": true, "task_count": 2 },
    { "id": "S-3", "issue_id": "ISS-zzz", "status": "pending", "ready": false, "depends_on": ["S-1"] }
  ],
  "parallel_batches": [["S-1", "S-2"], ["S-3"]]
}
```

### `ccw issue detail <item_id>`
Returns FULL SOLUTION with all tasks (READ-ONLY):
```json
{
  "item_id": "S-1",
  "issue_id": "ISS-xxx",
  "solution_id": "SOL-xxx",
  "status": "pending",
  "solution": {
    "id": "SOL-xxx",
    "approach": "...",
    "tasks": [
      { "id": "T1", "title": "...", "implementation": [...], "test": {...} },
      { "id": "T2", "title": "...", "implementation": [...], "test": {...} },
      { "id": "T3", "title": "...", "implementation": [...], "test": {...} }
    ],
    "exploration_context": { "relevant_files": [...] }
  },
  "execution_hints": { "executor": "codex", "estimated_minutes": 180 }
}
```

### `ccw issue done <item_id>`
Marks solution completed/failed, updates queue state, checks for queue completion.

## Error Handling

| Error | Resolution |
|-------|------------|
| No queue | Run /issue:queue first |
| No ready solutions | Dependencies blocked, check DAG |
| Executor timeout | Solution not marked done, can retry |
| Solution failure | Use `ccw issue retry` to reset |
| Partial task failure | Executor reports which task failed via `done --fail` |

## Related Commands

- `/issue:plan` - Plan issues with solutions
- `/issue:queue` - Form execution queue
- `ccw issue queue dag` - View dependency graph
- `ccw issue detail <id>` - View task details
- `ccw issue retry` - Reset failed tasks
