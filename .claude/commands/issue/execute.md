---
name: execute
description: Execute queue with codex using DAG-based parallel orchestration (delegates task lookup to executors)
argument-hint: "[--parallel <n>] [--executor codex|gemini|agent]"
allowed-tools: TodoWrite(*), Bash(*), Read(*), AskUserQuestion(*)
---

# Issue Execute Command (/issue:execute)

## Overview

Minimal orchestrator that dispatches task IDs to executors. **Does NOT read task details** - delegates all task lookup to the executor via `ccw issue next <item_id>`.

**Design Principles:**
- **DAG-driven**: Uses `ccw issue queue dag` to get parallel execution plan
- **ID-only dispatch**: Only passes `item_id` to executors
- **Executor responsibility**: Codex/Agent fetches task details via `ccw issue next <item_id>`
- **Parallel execution**: Launches multiple executors concurrently based on DAG batches

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
   └─ ccw issue queue dag → { parallel_batches, nodes, ready_count }

Phase 2: Dispatch Batches
   ├─ For each batch in parallel_batches:
   │   ├─ Launch N executors (up to --parallel limit)
   │   ├─ Each executor receives: item_id only
   │   ├─ Executor calls: ccw issue next <item_id>
   │   ├─ Executor gets full task definition
   │   ├─ Executor implements + tests + commits
   │   └─ Executor calls: ccw issue done <item_id>
   └─ Wait for batch completion before next batch

Phase 3: Summary
   └─ ccw issue queue dag → updated status
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
- Batches: ${dag.parallel_batches.length}
- Max parallel: ${dag._summary.can_parallel}
`);

// Dry run mode
if (flags.dryRun) {
  console.log('### Parallel Batches (would execute):\n');
  dag.parallel_batches.forEach((batch, i) => {
    console.log(`Batch ${i + 1}: ${batch.join(', ')}`);
  });
  return;
}
```

### Phase 2: Dispatch Batches

```javascript
const parallelLimit = flags.parallel || 3;
const executor = flags.executor || 'codex';

// Initialize TodoWrite for tracking
const allTasks = dag.parallel_batches.flat();
TodoWrite({
  todos: allTasks.map(id => ({
    content: `Execute ${id}`,
    status: 'pending',
    activeForm: `Executing ${id}`
  }))
});

// Process each batch
for (const [batchIndex, batch] of dag.parallel_batches.entries()) {
  console.log(`\n### Batch ${batchIndex + 1}/${dag.parallel_batches.length}`);
  console.log(`Tasks: ${batch.join(', ')}`);

  // Dispatch batch with parallelism limit
  const chunks = [];
  for (let i = 0; i < batch.length; i += parallelLimit) {
    chunks.push(batch.slice(i, i + parallelLimit));
  }

  for (const chunk of chunks) {
    // Launch executors in parallel
    const executions = chunk.map(itemId => {
      updateTodo(itemId, 'in_progress');
      return dispatchExecutor(itemId, executor);
    });

    await Promise.all(executions);
    chunk.forEach(id => updateTodo(id, 'completed'));
  }

  // Refresh DAG for next batch (dependencies may now be satisfied)
  const refreshedDag = JSON.parse(Bash(`ccw issue queue dag`).trim());
  if (refreshedDag.ready_count === 0) break;
}
```

### Executor Dispatch (Minimal Prompt)

```javascript
function dispatchExecutor(itemId, executorType) {
  // Minimal prompt - executor fetches its own task
  const prompt = `
## Execute Task ${itemId}

### Step 1: Fetch Task
\`\`\`bash
ccw issue next ${itemId}
\`\`\`

### Step 2: Execute
Follow the task definition returned by the command above.
The JSON includes: implementation steps, test commands, acceptance criteria, commit spec.

### Step 3: Report
When done:
\`\`\`bash
ccw issue done ${itemId} --result '{"summary": "..."}'
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

### Phase 3: Summary

```javascript
// Get final status
const finalDag = JSON.parse(Bash(`ccw issue queue dag`).trim());

console.log(`
## Execution Complete

- Completed: ${finalDag.completed_count}/${finalDag.total}
- Remaining: ${finalDag.ready_count}

### Task Status
${finalDag.nodes.map(n => {
  const icon = n.status === 'completed' ? '✓' :
               n.status === 'failed' ? '✗' :
               n.status === 'executing' ? '⟳' : '○';
  return `${icon} ${n.id} [${n.issue_id}:${n.task_id}] - ${n.status}`;
}).join('\n')}
`);

if (finalDag.ready_count > 0) {
  console.log('\nRun `/issue:execute` again for remaining tasks.');
}
```

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
  "edges": [{ "from": "T-1", "to": "T-2" }],
  "parallel_batches": [["T-1", "T-3"], ["T-2"]],
  "_summary": { "can_parallel": 2, "batches_needed": 2 }
}
```

### `ccw issue next <item_id>`
Returns full task definition for the specified item:
```json
{
  "item_id": "T-1",
  "issue_id": "GH-123",
  "task": { "id": "T1", "title": "...", "implementation": [...], ... },
  "context": { "relevant_files": [...] }
}
```

### `ccw issue done <item_id>`
Marks task completed/failed and updates queue state.

## Error Handling

| Error | Resolution |
|-------|------------|
| No queue | Run /issue:queue first |
| No ready tasks | Dependencies blocked, check DAG |
| Executor timeout | Marked as executing, can resume |
| Task failure | Use `ccw issue retry` to reset |

## Troubleshooting

### Check DAG Status
```bash
ccw issue queue dag | jq '.parallel_batches'
```

### Resume Interrupted Execution
Executors in `executing` status will be resumed automatically when calling `ccw issue next <item_id>`.

### Retry Failed Tasks
```bash
ccw issue retry        # Reset all failed to pending
/issue:execute         # Re-execute
```

## Related Commands

- `/issue:plan` - Plan issues with solutions
- `/issue:queue` - Form execution queue
- `ccw issue queue dag` - View dependency graph
- `ccw issue retry` - Reset failed tasks
