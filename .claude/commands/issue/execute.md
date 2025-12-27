---
name: execute
description: Execute queue with codex using endpoint-driven task fetching (single task per codex instance)
argument-hint: "[--parallel <n>] [--executor codex|gemini]"
allowed-tools: TodoWrite(*), Bash(*), Read(*), AskUserQuestion(*)
---

# Issue Execute Command (/issue:execute)

## Overview

Execution orchestrator that coordinates codex instances. Each task is executed by an independent codex instance that fetches its task via CLI endpoint. **Codex does NOT read task files** - it calls `ccw issue next` to get task data dynamically.

**Core design:**
- Single task per codex instance (not loop mode)
- Endpoint-driven: `ccw issue next` → execute → `ccw issue complete`
- No file reading in codex
- Orchestrator manages parallelism

## Storage Structure (Queue History)

```
.workflow/issues/
├── issues.jsonl              # All issues (one per line)
├── queues/                   # Queue history directory
│   ├── index.json            # Queue index (active + history)
│   └── {queue-id}.json       # Individual queue files
└── solutions/
    ├── {issue-id}.jsonl      # Solutions for issue
    └── ...
```

## Usage

```bash
/issue:execute [FLAGS]

# Examples
/issue:execute                    # Execute all ready tasks
/issue:execute --parallel 3       # Execute up to 3 tasks in parallel
/issue:execute --executor codex   # Force codex executor

# Flags
--parallel <n>        Max parallel codex instances (default: 1)
--executor <type>     Force executor: codex|gemini|agent
--dry-run             Show what would execute without running
```

## Execution Process

```
Phase 1: Queue Loading
   ├─ Load queue.json
   ├─ Count pending/ready tasks
   └─ Initialize TodoWrite tracking

Phase 2: Ready Task Detection
   ├─ Find tasks with satisfied dependencies
   ├─ Group by execution_group (parallel batches)
   └─ Determine execution order

Phase 3: Codex Coordination
   ├─ For each ready task:
   │   ├─ Launch independent codex instance
   │   ├─ Codex calls: ccw issue next
   │   ├─ Codex receives task data (NOT file)
   │   ├─ Codex executes task
   │   ├─ Codex calls: ccw issue complete <queue-id>
   │   └─ Update TodoWrite
   └─ Parallel execution based on --parallel flag

Phase 4: Completion
   ├─ Generate execution summary
   ├─ Update issue statuses in issues.jsonl
   └─ Display results
```

## Implementation

### Phase 1: Queue Loading

```javascript
// Load active queue via CLI endpoint
const queueJson = Bash(`ccw issue status --json 2>/dev/null || echo '{}'`);
const queue = JSON.parse(queueJson);

if (!queue.id || queue.tasks?.length === 0) {
  console.log('No active queue found. Run /issue:queue first.');
  return;
}

// Count by status
const pending = queue.tasks.filter(q => q.status === 'pending');
const executing = queue.tasks.filter(q => q.status === 'executing');
const completed = queue.tasks.filter(q => q.status === 'completed');

console.log(`
## Execution Queue Status

- Pending: ${pending.length}
- Executing: ${executing.length}
- Completed: ${completed.length}
- Total: ${queue.tasks.length}
`);

if (pending.length === 0 && executing.length === 0) {
  console.log('All tasks completed!');
  return;
}
```

### Phase 2: Ready Task Detection

```javascript
// Find ready tasks (dependencies satisfied)
function getReadyTasks() {
  const completedIds = new Set(
    queue.tasks.filter(q => q.status === 'completed').map(q => q.item_id)
  );

  return queue.tasks.filter(item => {
    if (item.status !== 'pending') return false;
    return item.depends_on.every(depId => completedIds.has(depId));
  });
}

const readyTasks = getReadyTasks();

if (readyTasks.length === 0) {
  if (executing.length > 0) {
    console.log('Tasks are currently executing. Wait for completion.');
  } else {
    console.log('No ready tasks. Check for blocked dependencies.');
  }
  return;
}

console.log(`Found ${readyTasks.length} ready tasks`);

// Sort by execution order
readyTasks.sort((a, b) => a.execution_order - b.execution_order);

// Initialize TodoWrite
TodoWrite({
  todos: readyTasks.slice(0, parallelLimit).map(t => ({
    content: `[${t.item_id}] ${t.issue_id}:${t.task_id}`,
    status: 'pending',
    activeForm: `Executing ${t.item_id}`
  }))
});
```

### Phase 3: Codex Coordination (Single Task Mode - Full Lifecycle)

```javascript
// Execute tasks - single codex instance per task with full lifecycle
async function executeTask(queueItem) {
  const codexPrompt = `
## Single Task Execution - CLOSED-LOOP LIFECYCLE

You are executing ONE task from the issue queue. Each task has 5 phases that MUST ALL complete successfully.

### Step 1: Fetch Task
Run this command to get your task:
\`\`\`bash
ccw issue next
\`\`\`

This returns JSON with full lifecycle definition:
- task.implementation: Implementation steps
- task.test: Test requirements and commands
- task.regression: Regression check commands
- task.acceptance: Acceptance criteria and verification
- task.commit: Commit specification

### Step 2: Execute Full Lifecycle

**Phase 1: IMPLEMENT**
1. Follow task.implementation steps in order
2. Modify files specified in modification_points
3. Use context.relevant_files for reference
4. Use context.patterns for code style

**Phase 2: TEST**
1. Run test commands from task.test.commands
2. Ensure all unit tests pass (task.test.unit)
3. Run integration tests if specified (task.test.integration)
4. Verify coverage meets task.test.coverage_target if specified
5. If tests fail → fix code and re-run, do NOT proceed until tests pass

**Phase 3: REGRESSION**
1. Run all commands in task.regression
2. Ensure no existing tests are broken
3. If regression fails → fix and re-run

**Phase 4: ACCEPTANCE**
1. Verify each criterion in task.acceptance.criteria
2. Execute verification steps in task.acceptance.verification
3. Complete any manual_checks if specified
4. All criteria MUST pass before proceeding

**Phase 5: COMMIT**
1. Stage all modified files
2. Use task.commit.message_template as commit message
3. Commit with: git commit -m "$(cat <<'EOF'\n<message>\nEOF\n)"
4. If commit_strategy is 'per-task', commit now
5. If commit_strategy is 'atomic' or 'squash', stage but don't commit

### Step 3: Report Completion
When ALL phases complete successfully:
\`\`\`bash
ccw issue complete <item_id> --result '{
  "files_modified": ["path1", "path2"],
  "tests_passed": true,
  "regression_passed": true,
  "acceptance_passed": true,
  "committed": true,
  "commit_hash": "<hash>",
  "summary": "What was done"
}'
\`\`\`

If any phase fails and cannot be fixed:
\`\`\`bash
ccw issue fail <item_id> --reason "Phase X failed: <details>"
\`\`\`

### Rules
- NEVER skip any lifecycle phase
- Tests MUST pass before proceeding to acceptance
- Regression MUST pass before commit
- ALL acceptance criteria MUST be verified
- Report accurate lifecycle status in result

### Start Now
Begin by running: ccw issue next
`;

  // Execute codex
  const executor = queueItem.assigned_executor || flags.executor || 'codex';

  if (executor === 'codex') {
    Bash(
      `ccw cli -p "${escapePrompt(codexPrompt)}" --tool codex --mode write --id exec-${queueItem.item_id}`,
      timeout=3600000  // 1 hour timeout
    );
  } else if (executor === 'gemini') {
    Bash(
      `ccw cli -p "${escapePrompt(codexPrompt)}" --tool gemini --mode write --id exec-${queueItem.item_id}`,
      timeout=1800000  // 30 min timeout
    );
  } else {
    // Agent execution
    Task(
      subagent_type="code-developer",
      run_in_background=false,
      description=`Execute ${queueItem.item_id}`,
      prompt=codexPrompt
    );
  }
}

// Execute with parallelism
const parallelLimit = flags.parallel || 1;

for (let i = 0; i < readyTasks.length; i += parallelLimit) {
  const batch = readyTasks.slice(i, i + parallelLimit);

  console.log(`\n### Executing Batch ${Math.floor(i / parallelLimit) + 1}`);
  console.log(batch.map(t => `- ${t.item_id}: ${t.issue_id}:${t.task_id}`).join('\n'));

  if (parallelLimit === 1) {
    // Sequential execution
    for (const task of batch) {
      updateTodo(task.item_id, 'in_progress');
      await executeTask(task);
      updateTodo(task.item_id, 'completed');
    }
  } else {
    // Parallel execution - launch all at once
    const executions = batch.map(task => {
      updateTodo(task.item_id, 'in_progress');
      return executeTask(task);
    });
    await Promise.all(executions);
    batch.forEach(task => updateTodo(task.item_id, 'completed'));
  }

  // Refresh ready tasks after batch
  const newReady = getReadyTasks();
  if (newReady.length > 0) {
    console.log(`${newReady.length} more tasks now ready`);
  }
}
```

### Codex Task Fetch Response

When codex calls `ccw issue next`, it receives:

```json
{
  "item_id": "T-1",
  "issue_id": "GH-123",
  "solution_id": "SOL-001",
  "task": {
    "id": "T1",
    "title": "Create auth middleware",
    "scope": "src/middleware/",
    "action": "Create",
    "description": "Create JWT validation middleware",
    "modification_points": [
      { "file": "src/middleware/auth.ts", "target": "new file", "change": "Create middleware" }
    ],
    "implementation": [
      "Create auth.ts file in src/middleware/",
      "Implement JWT token validation using jsonwebtoken",
      "Add error handling for invalid/expired tokens",
      "Export middleware function"
    ],
    "acceptance": [
      "Middleware validates JWT tokens successfully",
      "Returns 401 for invalid or missing tokens",
      "Passes token payload to request context"
    ]
  },
  "context": {
    "relevant_files": ["src/config/auth.ts", "src/types/auth.d.ts"],
    "patterns": "Follow existing middleware pattern in src/middleware/logger.ts"
  },
  "execution_hints": {
    "executor": "codex",
    "estimated_minutes": 30
  }
}
```

### Phase 4: Completion Summary

```javascript
// Reload queue for final status via CLI
const finalQueueJson = Bash(`ccw issue status --json 2>/dev/null || echo '{}'`);
const finalQueue = JSON.parse(finalQueueJson);

// Use queue._metadata for summary (already calculated by CLI)
const summary = finalQueue._metadata || {
  completed_count: 0,
  failed_count: 0,
  pending_count: 0,
  total_tasks: 0
};

console.log(`
## Execution Complete

**Completed**: ${summary.completed_count}/${summary.total_tasks}
**Failed**: ${summary.failed_count}
**Pending**: ${summary.pending_count}

### Task Results
${(finalQueue.tasks || []).map(q => {
  const icon = q.status === 'completed' ? '✓' :
               q.status === 'failed' ? '✗' :
               q.status === 'executing' ? '⟳' : '○';
  return `${icon} ${q.item_id} [${q.issue_id}:${q.task_id}] - ${q.status}`;
}).join('\n')}
`);

// Issue status updates are handled by ccw issue complete/fail endpoints
// No need to manually update issues.jsonl here

if (summary.pending_count > 0) {
  console.log(`
### Continue Execution
Run \`/issue:execute\` again to execute remaining tasks.
`);
}
```

## Dry Run Mode

```javascript
if (flags.dryRun) {
  console.log(`
## Dry Run - Would Execute

${readyTasks.map((t, i) => `
${i + 1}. ${t.item_id}
   Issue: ${t.issue_id}
   Task: ${t.task_id}
   Executor: ${t.assigned_executor}
   Group: ${t.execution_group}
`).join('')}

No changes made. Remove --dry-run to execute.
`);
  return;
}
```

## Error Handling

| Error | Resolution |
|-------|------------|
| Queue not found | Display message, suggest /issue:queue |
| No ready tasks | Check dependencies, show blocked tasks |
| Codex timeout | Mark as failed, allow retry |
| ccw issue next empty | All tasks done or blocked |
| Task execution failure | Marked via ccw issue fail, use `ccw issue retry` to reset |

## Troubleshooting

### Interrupted Tasks

If execution was interrupted (crashed/stopped), `ccw issue next` will automatically resume:

```bash
# Automatically returns the executing task for resumption
ccw issue next
```

Tasks in `executing` status are prioritized and returned first, no manual reset needed.

### Failed Tasks

If a task failed and you want to retry:

```bash
# Reset all failed tasks to pending
ccw issue retry

# Reset failed tasks for specific issue
ccw issue retry <issue-id>
```

## Endpoint Contract

### `ccw issue next`
- Returns next ready task as JSON
- Marks task as 'executing'
- Returns `{ status: 'empty' }` when no tasks

### `ccw issue complete <item-id>`
- Marks task as 'completed'
- Updates queue.json
- Checks if issue is fully complete

### `ccw issue fail <item-id>`
- Marks task as 'failed'
- Records failure reason
- Allows retry via /issue:execute

### `ccw issue retry [issue-id]`
- Resets failed tasks to 'pending'
- Allows re-execution via `ccw issue next`

## Related Commands

- `/issue:plan` - Plan issues with solutions
- `/issue:queue` - Form execution queue
- `ccw issue queue list` - View queue status
- `ccw issue retry` - Retry failed tasks
