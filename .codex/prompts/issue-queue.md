---
description: Form execution queue from bound solutions (orders solutions, detects conflicts, assigns groups)
argument-hint: "[--issue <id>] [--append <id>]"
---

# Issue Queue (Codex Version)

## Goal

Create an ordered execution queue from all bound solutions. Analyze inter-solution file conflicts, calculate semantic priorities, and assign parallel/sequential execution groups.

This workflow is **ordering only** (no execution): it reads bound solutions, detects conflicts, and produces a queue file that `issue-execute.md` can consume.

**Design Principle**: Queue items are **solutions**, not individual tasks. Each executor receives a complete solution with all its tasks.

## Core Guidelines

**⚠️ Data Access Principle**: Issues and queue files can grow very large. To avoid context overflow:

| Operation | Correct | Incorrect |
|-----------|---------|-----------|
| List issues (brief) | `ccw issue list --status planned --brief` | `Read('issues.jsonl')` |
| List queue (brief) | `ccw issue queue --brief` | `Read('queues/*.json')` |
| Read issue details | `ccw issue status <id> --json` | `Read('issues.jsonl')` |
| Get next item | `ccw issue next --json` | `Read('queues/*.json')` |
| Update status | `ccw issue update <id> --status ...` | Direct file edit |
| Sync from queue | `ccw issue update --from-queue` | Direct file edit |

**Output Options**:
- `--brief`: JSON with minimal fields (id, status, counts)
- `--json`: Full JSON (for detailed processing)

**ALWAYS** use CLI commands for CRUD operations. **NEVER** read entire `issues.jsonl` or `queues/*.json` directly.

## Inputs

- **All planned**: Default behavior → queue all issues with `planned` status and bound solutions
- **Specific issue**: `--issue <id>` → queue only that issue's solution
- **Append mode**: `--append <id>` → append issue to active queue (don't create new)

## Output Requirements

**Generate Files (EXACTLY 2):**
1. `.workflow/issues/queues/{queue-id}.json` - Full queue with solutions, conflicts, groups
2. `.workflow/issues/queues/index.json` - Update with new queue entry

**Return Summary:**
```json
{
  "queue_id": "QUE-YYYYMMDD-HHMMSS",
  "total_solutions": 3,
  "total_tasks": 12,
  "execution_groups": [{ "id": "P1", "type": "parallel", "count": 2 }],
  "conflicts_resolved": 1,
  "issues_queued": ["ISS-xxx", "ISS-yyy"]
}
```

## Workflow

### Step 1: Generate Queue ID

Generate queue ID ONCE at start, reuse throughout:

```bash
# Format: QUE-YYYYMMDD-HHMMSS (UTC)
QUEUE_ID="QUE-$(date -u +%Y%m%d-%H%M%S)"
```

### Step 2: Load Planned Issues

Get all issues with bound solutions:

```bash
ccw issue list --status planned --json
```

For each issue in the result:
- Extract `id`, `bound_solution_id`, `priority`
- Read solution from `.workflow/issues/solutions/{issue-id}.jsonl`
- Find the bound solution by matching `solution.id === bound_solution_id`
- Collect `files_touched` from all tasks' `modification_points.file`

Build solution list:
```json
[
  {
    "issue_id": "ISS-xxx",
    "solution_id": "SOL-xxx",
    "task_count": 3,
    "files_touched": ["src/auth.ts", "src/utils.ts"],
    "priority": "medium"
  }
]
```

### Step 3: Detect File Conflicts

Build a file → solutions mapping:

```javascript
fileModifications = {
  "src/auth.ts": ["SOL-ISS-001-1", "SOL-ISS-003-1"],
  "src/api.ts": ["SOL-ISS-002-1"]
}
```

Conflicts exist when a file has multiple solutions. For each conflict:
- Record the file and involved solutions
- Will be resolved in Step 4

### Step 4: Resolve Conflicts & Build DAG

**Resolution Rules (in priority order):**
1. Higher issue priority first: `critical > high > medium > low`
2. Foundation solutions first: fewer dependencies
3. More tasks = higher priority: larger impact

For each file conflict:
- Apply resolution rules to determine order
- Add dependency edge: later solution `depends_on` earlier solution
- Record rationale

**Semantic Priority Formula:**
```
Base: critical=0.9, high=0.7, medium=0.5, low=0.3
Boost: task_count>=5 → +0.1, task_count>=3 → +0.05
Final: clamp(base + boost, 0.0, 1.0)
```

### Step 5: Assign Execution Groups

- **Parallel (P1, P2, ...)**: Solutions with NO file overlaps between them
- **Sequential (S1, S2, ...)**: Solutions that share files must run in order

Group assignment:
1. Start with all solutions in potential parallel group
2. For each file conflict, move later solution to sequential group
3. Assign group IDs: P1 for first parallel batch, S2 for first sequential, etc.

### Step 6: Generate Queue Files

**Queue file structure** (`.workflow/issues/queues/{QUEUE_ID}.json`):

```json
{
  "id": "QUE-20251228-120000",
  "status": "active",
  "issue_ids": ["ISS-001", "ISS-002"],
  "solutions": [
    {
      "item_id": "S-1",
      "issue_id": "ISS-001",
      "solution_id": "SOL-ISS-001-1",
      "status": "pending",
      "execution_order": 1,
      "execution_group": "P1",
      "depends_on": [],
      "semantic_priority": 0.8,
      "files_touched": ["src/auth.ts"],
      "task_count": 3
    }
  ],
  "conflicts": [
    {
      "type": "file_conflict",
      "file": "src/auth.ts",
      "solutions": ["S-1", "S-3"],
      "resolution": "sequential",
      "resolution_order": ["S-1", "S-3"],
      "rationale": "S-1 creates auth module, S-3 extends it"
    }
  ],
  "execution_groups": [
    { "id": "P1", "type": "parallel", "solutions": ["S-1", "S-2"], "solution_count": 2 },
    { "id": "S2", "type": "sequential", "solutions": ["S-3"], "solution_count": 1 }
  ]
}
```

**Update index** (`.workflow/issues/queues/index.json`):

```json
{
  "active_queue_id": "QUE-20251228-120000",
  "active_queue_ids": ["QUE-20251228-120000"],
  "queues": [
    {
      "id": "QUE-20251228-120000",
      "status": "active",
      "priority": 1,
      "issue_ids": ["ISS-001", "ISS-002"],
      "total_solutions": 3,
      "completed_solutions": 0,
      "created_at": "2025-12-28T12:00:00Z"
    }
  ]
}
```

## Multi-Queue Management

Multiple queues can be active simultaneously. The system executes queues in priority order (lower = higher priority).

**Activate multiple queues:**
```bash
ccw issue queue activate QUE-001,QUE-002,QUE-003
```

**Set queue priority:**
```bash
ccw issue queue priority QUE-001 --priority 1
ccw issue queue priority QUE-002 --priority 2
```

**Execution behavior with multi-queue:**
- `ccw issue next` automatically selects from active queues in priority order
- Complete all items in Q1 before moving to Q2 (serialized execution)
- Use `--queue QUE-xxx` to target a specific queue

### Step 7: Update Issue Statuses

**MUST use CLI command** (NOT direct file operations):

```bash
# Option 1: Batch update from queue (recommended)
ccw issue update --from-queue              # Use active queue
ccw issue update --from-queue QUE-xxx      # Use specific queue

# Option 2: Individual issue update
ccw issue update <issue-id> --status queued
```

**⚠️ IMPORTANT**: Do NOT directly modify `issues.jsonl`. Always use CLI command to ensure proper validation and history tracking.

## Queue Item ID Format

- Solution items: `S-1`, `S-2`, `S-3`, ...
- Sequential numbering starting from 1

## Quality Checklist

Before completing, verify:

- [ ] Exactly 2 files generated: queue JSON + index update
- [ ] Queue has valid DAG (no circular dependencies)
- [ ] All file conflicts resolved with rationale
- [ ] Semantic priority calculated for each solution (0.0-1.0)
- [ ] Execution groups assigned (P* for parallel, S* for sequential)
- [ ] Issue statuses updated to `queued`
- [ ] Summary JSON returned with correct shape

## Validation Rules

1. **No cycles**: If resolution creates a cycle, abort and report
2. **Parallel safety**: Solutions in same P* group must have NO file overlaps
3. **Sequential order**: Solutions in S* group must be in correct dependency order
4. **Single queue ID**: Use the same queue ID throughout (generated in Step 1)

## Error Handling

| Situation | Action |
|-----------|--------|
| No planned issues | Return empty queue summary |
| Circular dependency detected | Abort, report cycle details |
| Missing solution file | Skip issue, log warning |
| Index file missing | Create new index |
| Index not updated | Auto-fix: Set active_queue_id to new queue |

## Done Criteria

- [ ] All planned issues with `bound_solution_id` are included
- [ ] Queue JSON written to `queues/{queue-id}.json`
- [ ] Index updated in `queues/index.json` with `active_queue_id`
- [ ] No circular dependencies in solution DAG
- [ ] Parallel groups have no file overlaps
- [ ] Issue statuses updated to `queued`

## Start Execution

Begin by listing planned issues:

```bash
ccw issue list --status planned --json
```

Then follow the workflow to generate the queue.

