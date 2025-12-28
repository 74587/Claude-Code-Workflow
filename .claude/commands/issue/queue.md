---
name: queue
description: Form execution queue from bound solutions using issue-queue-agent (solution-level)
argument-hint: "[--rebuild] [--issue <id>]"
allowed-tools: TodoWrite(*), Task(*), Bash(*), Read(*), Write(*)
---

# Issue Queue Command (/issue:queue)

## Overview

Queue formation command using **issue-queue-agent** that analyzes all bound solutions, resolves **inter-solution** conflicts, and creates an ordered execution queue at **solution level**.

**Design Principle**: Queue items are **solutions**, not individual tasks. Each executor receives a complete solution with all its tasks.

## Output Requirements

**Generate Files:**
1. `.workflow/issues/queues/{queue-id}.json` - Full queue with solutions, conflicts, groups
2. `.workflow/issues/queues/index.json` - Update with new queue entry

**Return Summary:**
```json
{
  "queue_id": "QUE-20251227-143000",
  "total_solutions": N,
  "total_tasks": N,
  "execution_groups": [{ "id": "P1", "type": "parallel", "count": N }],
  "conflicts_resolved": N,
  "issues_queued": ["ISS-xxx", "ISS-yyy"]
}
```

**Completion Criteria:**
- [ ] Queue JSON generated with valid DAG (no cycles between solutions)
- [ ] All inter-solution file conflicts resolved with rationale
- [ ] Semantic priority calculated for each solution
- [ ] Execution groups assigned (parallel P* / sequential S*)
- [ ] Issue statuses updated to `queued` via `ccw issue update`

## Core Capabilities

- **Agent-driven**: issue-queue-agent handles all ordering logic
- **Solution-level granularity**: Queue items are solutions, not tasks
- Inter-solution dependency DAG (based on file conflicts)
- File conflict detection between solutions
- Semantic priority calculation per solution (0.0-1.0)
- Parallel/Sequential group assignment for solutions

## Storage Structure (Queue History)

```
.workflow/issues/
├── issues.jsonl              # All issues (one per line)
├── queues/                   # Queue history directory
│   ├── index.json            # Queue index (active + history)
│   ├── {queue-id}.json       # Individual queue files
│   └── ...
└── solutions/
    ├── {issue-id}.jsonl      # Solutions for issue
    └── ...
```

### Queue Index Schema

```json
{
  "active_queue_id": "QUE-20251227-143000",
  "queues": [
    {
      "id": "QUE-20251227-143000",
      "status": "active",
      "issue_ids": ["ISS-xxx", "ISS-yyy"],
      "total_solutions": 3,
      "completed_solutions": 1,
      "created_at": "2025-12-27T14:30:00Z"
    }
  ]
}
```

### Queue File Schema (Solution-Level)

```json
{
  "id": "QUE-20251227-143000",
  "status": "active",
  "solutions": [
    {
      "item_id": "S-1",
      "issue_id": "ISS-20251227-003",
      "solution_id": "SOL-20251227-003",
      "status": "pending",
      "execution_order": 1,
      "execution_group": "P1",
      "depends_on": [],
      "semantic_priority": 0.8,
      "assigned_executor": "codex",
      "files_touched": ["src/auth.ts", "src/utils.ts"],
      "task_count": 3
    },
    {
      "item_id": "S-2",
      "issue_id": "ISS-20251227-001",
      "solution_id": "SOL-20251227-001",
      "status": "pending",
      "execution_order": 2,
      "execution_group": "P1",
      "depends_on": [],
      "semantic_priority": 0.7,
      "assigned_executor": "codex",
      "files_touched": ["src/api.ts"],
      "task_count": 2
    },
    {
      "item_id": "S-3",
      "issue_id": "ISS-20251227-002",
      "solution_id": "SOL-20251227-002",
      "status": "pending",
      "execution_order": 3,
      "execution_group": "S2",
      "depends_on": ["S-1"],
      "semantic_priority": 0.5,
      "assigned_executor": "codex",
      "files_touched": ["src/auth.ts"],
      "task_count": 4
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
    { "id": "P1", "type": "parallel", "solutions": ["S-1", "S-2"] },
    { "id": "S2", "type": "sequential", "solutions": ["S-3"] }
  ]
}
```

## Usage

```bash
/issue:queue [FLAGS]

# Examples
/issue:queue                      # Form NEW queue from all bound solutions
/issue:queue --issue GH-123       # Form queue for specific issue only
/issue:queue --append GH-124      # Append to active queue
/issue:queue --list               # List all queues (history)
/issue:queue --switch QUE-xxx     # Switch active queue
/issue:queue --archive            # Archive completed active queue

# Flags
--issue <id>          Form queue for specific issue only
--append <id>         Append issue to active queue (don't create new)

# CLI subcommands (ccw issue queue ...)
ccw issue queue list                  List all queues with status
ccw issue queue switch <queue-id>     Switch active queue
ccw issue queue archive               Archive current queue
ccw issue queue delete <queue-id>     Delete queue from history
```

## Execution Process

```
Phase 1: Solution Loading
   ├─ Load issues.jsonl
   ├─ Filter issues with bound_solution_id
   ├─ Read solutions/{issue-id}.jsonl for each issue
   ├─ Find bound solution by ID
   ├─ Collect files_touched from all tasks in solution
   └─ Build solution objects (NOT individual tasks)

Phase 2-4: Agent-Driven Queue Formation (issue-queue-agent)
   ├─ Launch issue-queue-agent with all solutions
   ├─ Agent performs:
   │   ├─ Detect file overlaps between solutions
   │   ├─ Build dependency DAG from file conflicts
   │   ├─ Detect circular dependencies
   │   ├─ Resolve conflicts using priority rules
   │   ├─ Calculate semantic priority per solution
   │   └─ Assign execution groups (parallel/sequential)
   └─ Output: queue JSON with ordered solutions (S-1, S-2, ...)

Phase 5: Queue Output
   ├─ Write queue.json with solutions array
   ├─ Update issue statuses in issues.jsonl
   └─ Display queue summary
```

## Implementation

### Phase 1: Solution Loading

**NOTE**: Execute code directly. DO NOT pre-read solution files - Bash cat handles all reading.

```javascript
// Load issues.jsonl
const issuesPath = '.workflow/issues/issues.jsonl';
const allIssues = Bash(`cat "${issuesPath}" 2>/dev/null || echo ''`)
  .split('\n')
  .filter(line => line.trim())
  .map(line => JSON.parse(line));

// Filter issues with bound solutions
const plannedIssues = allIssues.filter(i =>
  i.status === 'planned' && i.bound_solution_id
);

if (plannedIssues.length === 0) {
  console.log('No issues with bound solutions found.');
  console.log('Run /issue:plan first to create and bind solutions.');
  return;
}

// Load bound solutions (not individual tasks)
const allSolutions = [];
for (const issue of plannedIssues) {
  const solPath = `.workflow/issues/solutions/${issue.id}.jsonl`;
  const solutions = Bash(`cat "${solPath}" 2>/dev/null || echo ''`)
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));

  // Find bound solution
  const boundSol = solutions.find(s => s.id === issue.bound_solution_id);

  if (!boundSol) {
    console.log(`⚠ Bound solution ${issue.bound_solution_id} not found for ${issue.id}`);
    continue;
  }

  // Collect all files touched by this solution
  const filesTouched = new Set();
  for (const task of boundSol.tasks || []) {
    for (const mp of task.modification_points || []) {
      filesTouched.add(mp.file);
    }
  }

  allSolutions.push({
    issue_id: issue.id,
    solution_id: issue.bound_solution_id,
    task_count: boundSol.tasks?.length || 0,
    files_touched: Array.from(filesTouched),
    priority: issue.priority || 'medium'
  });
}

console.log(`Loaded ${allSolutions.length} solutions from ${plannedIssues.length} issues`);
```

### Phase 2-4: Agent-Driven Queue Formation

```javascript
// Build minimal prompt - agent orders SOLUTIONS, not tasks
const agentPrompt = `
## Order Solutions

**Solutions**: ${allSolutions.length} from ${plannedIssues.length} issues
**Project Root**: ${process.cwd()}

### Input (Solution-Level)
\`\`\`json
${JSON.stringify(allSolutions, null, 2)}
\`\`\`

### Steps
1. Parse solutions: Extract solution IDs, files_touched, task_count, priority
2. Detect conflicts: Find file overlaps between solutions (files_touched intersection)
3. Build DAG: Create dependency edges where solutions share files
4. Detect cycles: Verify no circular dependencies (abort if found)
5. Resolve conflicts: Apply ordering rules based on action types
6. Calculate priority: Compute semantic priority (0.0-1.0) per solution
7. Assign groups: Parallel (P*) for no-conflict, Sequential (S*) for conflicts
8. Generate queue: Write queue JSON with ordered solutions
9. Update index: Update queues/index.json with new queue entry

### Rules
- **Solution Granularity**: Queue items are solutions, NOT individual tasks
- **DAG Validity**: Output must be valid DAG with no circular dependencies
- **Conflict Detection**: Two solutions conflict if files_touched intersect
- **Ordering Priority**:
  1. Higher issue priority first (critical > high > medium > low)
  2. Fewer dependencies first (foundation solutions)
  3. More tasks = higher priority (larger impact)
- **Parallel Safety**: Solutions in same parallel group must have NO file overlaps
- **Queue Item ID Format**: \`S-N\` (S-1, S-2, S-3, ...)
- **Queue ID Format**: \`QUE-YYYYMMDD-HHMMSS\` (UTC timestamp)

### Generate Files
1. \`.workflow/issues/queues/\${queueId}.json\` - Full queue with solutions array
2. \`.workflow/issues/queues/index.json\` - Update with new entry

### Return Summary
\`\`\`json
{
  "queue_id": "QUE-YYYYMMDD-HHMMSS",
  "total_solutions": N,
  "total_tasks": N,
  "execution_groups": [{ "id": "P1", "type": "parallel", "count": N }],
  "conflicts_resolved": N,
  "issues_queued": ["ISS-xxx"]
}
\`\`\`
`;

const result = Task(
  subagent_type="issue-queue-agent",
  run_in_background=false,
  description=`Order ${allSolutions.length} solutions`,
  prompt=agentPrompt
);

const summary = JSON.parse(result);
```

### Phase 5: Summary & Status Update

```javascript
// Agent already generated queue files, use summary
console.log(`
## Queue Formed: ${summary.queue_id}

**Solutions**: ${summary.total_solutions}
**Tasks**: ${summary.total_tasks}
**Issues**: ${summary.issues_queued.join(', ')}
**Groups**: ${summary.execution_groups.map(g => `${g.id}(${g.count})`).join(', ')}
**Conflicts Resolved**: ${summary.conflicts_resolved}

Next: \`/issue:execute\`
`);

// Update issue statuses via CLI (use `update` for pure field changes)
// Note: `queue add` has its own logic; here we only need status update
for (const issueId of summary.issues_queued) {
  Bash(`ccw issue update ${issueId} --status queued`);
}
```

## Error Handling

| Error | Resolution |
|-------|------------|
| No bound solutions | Display message, suggest /issue:plan |
| Circular dependency | List cycles, abort queue formation |
| Unresolved conflicts | Agent resolves using ordering rules |
| Invalid task reference | Skip and warn |

## Related Commands

- `/issue:plan` - Plan issues and bind solutions
- `/issue:execute` - Execute queue with codex
- `ccw issue queue list` - View current queue
