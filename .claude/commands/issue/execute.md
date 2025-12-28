---
name: execute
description: Execute queue with codex using DAG-based parallel orchestration (read-only task fetch)
argument-hint: "[--parallel <n>] [--executor codex|gemini|agent]"
allowed-tools: TodoWrite(*), Bash(*), Read(*), AskUserQuestion(*)
---

# Issue Execute Command (/issue:execute)

## Overview

Minimal orchestrator that dispatches task IDs to executors. Uses read-only `detail` command for parallel-safe task fetching.

**Design Principles:**
- `queue dag` → returns parallel batches with task IDs
- `detail <id>` → READ-ONLY task fetch (no status modification)
- `done <id>` → update completion status
- No race conditions: status changes only via `done`

## Usage

```bash
/issue:execute [FLAGS]

# Examples
/issue:execute                    # Execute with default parallelism
/issue:execute --parallel 4       # Execute up to 4 tasks in parallel
/issue:execute --executor agent   # Use agent instead of codex

# Flags
--parallel <n>        Max parallel executors (default: 3)
--executor <type>     Force executor: codex|gemini|agent (default: codex)
--dry-run             Show DAG and batches without executing
```

## Execution Flow

```
Phase 1: Get DAG
   └─ ccw issue queue dag → { parallel_batches: [["T-1","T-2","T-3"], ...] }

Phase 2: Dispatch Parallel Batch
   ├─ For each ID in batch (parallel):
   │   ├─ Executor calls: ccw issue detail <id>  (READ-ONLY)
   │   ├─ Executor gets full task definition
   │   ├─ Executor implements + tests + commits
   │   └─ Executor calls: ccw issue done <id>
   └─ Wait for batch completion

Phase 3: Next Batch
   └─ ccw issue queue dag → check for newly-ready tasks
```

## Implementation

### Phase 1: Get DAG

```javascript
// Get dependency graph and parallel batches
const dagJson = Bash(`ccw issue queue dag`).trim();
const dag = JSON.parse(dagJson);

if (dag.error || dag.ready_count === 0) {
  console.log(dag.error || 'No tasks ready for execution');
  console.log('Use /issue:queue to form a queue first');
  return;
}

console.log(`
## Queue DAG

- Total: ${dag.total}
- Ready: ${dag.ready_count}
- Completed: ${dag.completed_count}
- Parallel in batch 1: ${dag.parallel_batches[0]?.length || 0}
`);

// Dry run mode
if (flags.dryRun) {
  console.log('### Parallel Batches:\n');
  dag.parallel_batches.forEach((batch, i) => {
    console.log(`Batch ${i + 1}: ${batch.join(', ')}`);
  });
  return;
}
```

### Phase 2: Dispatch Parallel Batch

```javascript
const parallelLimit = flags.parallel || 3;
const executor = flags.executor || 'codex';

// Process first batch (all can run in parallel)
const batch = dag.parallel_batches[0] || [];

// Initialize TodoWrite
TodoWrite({
  todos: batch.map(id => ({
    content: `Execute ${id}`,
    status: 'pending',
    activeForm: `Executing ${id}`
  }))
});

// Dispatch all in parallel (up to limit)
const chunks = [];
for (let i = 0; i < batch.length; i += parallelLimit) {
  chunks.push(batch.slice(i, i + parallelLimit));
}

for (const chunk of chunks) {
  console.log(`\n### Executing: ${chunk.join(', ')}`);

  // Launch all in parallel
  const executions = chunk.map(itemId => {
    updateTodo(itemId, 'in_progress');
    return dispatchExecutor(itemId, executor);
  });

  await Promise.all(executions);
  chunk.forEach(id => updateTodo(id, 'completed'));
}
```

### Executor Dispatch

```javascript
function dispatchExecutor(itemId, executorType) {
  // Executor fetches task via READ-ONLY detail command
  // Then reports completion via done command
  const prompt = `
## Execute Task ${itemId}

### Step 1: Get Task (read-only)
\`\`\`bash
ccw issue detail ${itemId}
\`\`\`

### Step 2: Execute
Follow the task definition returned above:
- task.implementation: Implementation steps
- task.test: Test commands
- task.acceptance: Acceptance criteria
- task.commit: Commit specification

### Step 3: Report Completion
When done:
\`\`\`bash
ccw issue done ${itemId} --result '{"summary": "...", "files_modified": [...]}'
\`\`\`

If failed:
\`\`\`bash
ccw issue done ${itemId} --fail --reason "..."
\`\`\`
`;

  if (executorType === 'codex') {
    return Bash(
      `ccw cli -p "${escapePrompt(prompt)}" --tool codex --mode write --id exec-${itemId}`,
      { timeout: 3600000, run_in_background: true }
    );
  } else if (executorType === 'gemini') {
    return Bash(
      `ccw cli -p "${escapePrompt(prompt)}" --tool gemini --mode write --id exec-${itemId}`,
      { timeout: 1800000, run_in_background: true }
    );
  } else {
    return Task({
      subagent_type: 'code-developer',
      run_in_background: false,
      description: `Execute ${itemId}`,
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

- Completed: ${refreshedDag.completed_count}/${refreshedDag.total}
- Next ready: ${refreshedDag.ready_count}
`);

if (refreshedDag.ready_count > 0) {
  console.log('Run `/issue:execute` again for next batch.');
}
```

## Parallel Execution Model

```
┌─────────────────────────────────────────────────────────┐
│ Orchestrator                                            │
├─────────────────────────────────────────────────────────┤
│ 1. ccw issue queue dag                                  │
│    → { parallel_batches: [["T-1","T-2","T-3"], ["T-4"]] │
│                                                         │
│ 2. Dispatch batch 1 (parallel):                        │
│    ┌────────────────┐ ┌────────────────┐ ┌────────────┐│
│    │ Executor 1     │ │ Executor 2     │ │ Executor 3 ││
│    │ detail T-1     │ │ detail T-2     │ │ detail T-3 ││
│    │ [work]         │ │ [work]         │ │ [work]     ││
│    │ done T-1       │ │ done T-2       │ │ done T-3   ││
│    └────────────────┘ └────────────────┘ └────────────┘│
│                                                         │
│ 3. ccw issue queue dag (refresh)                       │
│    → T-4 now ready (dependencies T-1,T-2 completed)    │
└─────────────────────────────────────────────────────────┘
```

**Why this works for parallel:**
- `detail <id>` is READ-ONLY → no race conditions
- `done <id>` updates only its own task status
- `queue dag` recalculates ready tasks after each batch

## CLI Endpoint Contract

### `ccw issue queue dag`
Returns dependency graph with parallel batches:
```json
{
  "queue_id": "QUE-...",
  "total": 10,
  "ready_count": 3,
  "completed_count": 2,
  "nodes": [{ "id": "T-1", "status": "pending", "ready": true, ... }],
  "parallel_batches": [["T-1", "T-2", "T-3"], ["T-4", "T-5"]]
}
```

### `ccw issue detail <item_id>`
Returns full task definition (READ-ONLY):
```json
{
  "item_id": "T-1",
  "issue_id": "GH-123",
  "status": "pending",
  "task": { "id": "T1", "implementation": [...], "test": {...}, ... },
  "context": { "relevant_files": [...] }
}
```

### `ccw issue done <item_id>`
Marks task completed/failed, updates queue state, checks for queue completion.

## Error Handling

| Error | Resolution |
|-------|------------|
| No queue | Run /issue:queue first |
| No ready tasks | Dependencies blocked, check DAG |
| Executor timeout | Task not marked done, can retry |
| Task failure | Use `ccw issue retry` to reset |

## Related Commands

- `/issue:plan` - Plan issues with solutions
- `/issue:queue` - Form execution queue
- `ccw issue queue dag` - View dependency graph
- `ccw issue detail <id>` - View task details
- `ccw issue retry` - Reset failed tasks
