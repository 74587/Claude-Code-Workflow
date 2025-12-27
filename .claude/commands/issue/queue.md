---
name: queue
description: Form execution queue from bound solutions using issue-queue-agent
argument-hint: "[--rebuild] [--issue <id>]"
allowed-tools: TodoWrite(*), Task(*), Bash(*), Read(*), Write(*)
---

# Issue Queue Command (/issue:queue)

## Overview

Queue formation command using **issue-queue-agent** that analyzes all bound solutions, resolves conflicts, and creates an ordered execution queue.

## Output Requirements

**Generate Files:**
1. `.workflow/issues/queues/{queue-id}.json` - Full queue with tasks, conflicts, groups
2. `.workflow/issues/queues/index.json` - Update with new queue entry

**Return Summary:**
```json
{
  "queue_id": "QUE-20251227-143000",
  "total_tasks": N,
  "execution_groups": [{ "id": "P1", "type": "parallel", "count": N }],
  "conflicts_resolved": N,
  "issues_queued": ["GH-123", "GH-124"]
}
```

**Completion Criteria:**
- [ ] Queue JSON generated with valid DAG (no cycles)
- [ ] All file conflicts resolved with rationale
- [ ] Semantic priority calculated for all tasks
- [ ] Execution groups assigned (parallel P* / sequential S*)
- [ ] Issue statuses updated to `queued` via `ccw issue update`

## Core Capabilities

- **Agent-driven**: issue-queue-agent handles all ordering logic
- Dependency DAG construction and cycle detection
- File conflict detection and resolution
- Semantic priority calculation (0.0-1.0)
- Parallel/Sequential group assignment

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
      "issue_ids": ["GH-123", "GH-124"],
      "total_tasks": 8,
      "completed_tasks": 3,
      "created_at": "2025-12-27T14:30:00Z"
    },
    {
      "id": "QUE-20251226-100000",
      "status": "completed",
      "issue_ids": ["GH-120"],
      "total_tasks": 5,
      "completed_tasks": 5,
      "created_at": "2025-12-26T10:00:00Z",
      "completed_at": "2025-12-26T12:30:00Z"
    }
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
   └─ Extract tasks from bound solutions

Phase 2-4: Agent-Driven Queue Formation (issue-queue-agent)
   ├─ Launch issue-queue-agent with all tasks
   ├─ Agent performs:
   │   ├─ Build dependency DAG from depends_on
   │   ├─ Detect circular dependencies
   │   ├─ Identify file modification conflicts
   │   ├─ Resolve conflicts using ordering rules
   │   ├─ Calculate semantic priority (0.0-1.0)
   │   └─ Assign execution groups (parallel/sequential)
   └─ Output: queue JSON with ordered tasks

Phase 5: Queue Output
   ├─ Write queue.json
   ├─ Update issue statuses in issues.jsonl
   └─ Display queue summary
```

## Implementation

### Phase 1: Solution Loading

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

// Load all tasks from bound solutions
const allTasks = [];
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

  for (const task of boundSol.tasks || []) {
    allTasks.push({
      issue_id: issue.id,
      solution_id: issue.bound_solution_id,
      task,
      exploration_context: boundSol.exploration_context
    });
  }
}

console.log(`Loaded ${allTasks.length} tasks from ${plannedIssues.length} issues`);
```

### Phase 2-4: Agent-Driven Queue Formation

```javascript
// Build minimal prompt - agent reads schema and handles ordering
const agentPrompt = `
## Order Tasks

**Tasks**: ${allTasks.length} from ${plannedIssues.length} issues
**Project Root**: ${process.cwd()}

### Input
\`\`\`json
${JSON.stringify(allTasks.map(t => ({
  key: \`\${t.issue_id}:\${t.task.id}\`,
  type: t.task.type,
  file_context: t.task.file_context,
  depends_on: t.task.depends_on
})), null, 2)}
\`\`\`

### Steps
1. Parse tasks: Extract task keys, types, file contexts, dependencies
2. Build DAG: Construct dependency graph from depends_on references
3. Detect cycles: Verify no circular dependencies exist (abort if found)
4. Detect conflicts: Identify file modification conflicts across issues
5. Resolve conflicts: Apply ordering rules (Create→Update→Delete, config→src→tests)
6. Calculate priority: Compute semantic priority (0.0-1.0) for each task
7. Assign groups: Assign parallel (P*) or sequential (S*) execution groups
8. Generate queue: Write queue JSON with ordered tasks
9. Update index: Update queues/index.json with new queue entry

### Rules
- **DAG Validity**: Output must be valid DAG with no circular dependencies
- **Conflict Resolution**: All file conflicts must be resolved with rationale
- **Ordering Priority**:
  1. Create before Update (files must exist before modification)
  2. Foundation before integration (config/ → src/)
  3. Types before implementation (types/ → components/)
  4. Core before tests (src/ → __tests__/)
  5. Delete last (preserve dependencies until no longer needed)
- **Parallel Safety**: Tasks in same parallel group must have no file conflicts
- **Queue ID Format**: \`QUE-YYYYMMDD-HHMMSS\` (UTC timestamp)

### Generate Files
1. \`.workflow/issues/queues/\${queueId}.json\` - Full queue (schema: cat .claude/workflows/cli-templates/schemas/queue-schema.json)
2. \`.workflow/issues/queues/index.json\` - Update with new entry

### Return Summary
\`\`\`json
{
  "queue_id": "QUE-YYYYMMDD-HHMMSS",
  "total_tasks": N,
  "execution_groups": [{ "id": "P1", "type": "parallel", "count": N }],
  "conflicts_resolved": N,
  "issues_queued": ["GH-123"]
}
\`\`\`
`;

const result = Task(
  subagent_type="issue-queue-agent",
  run_in_background=false,
  description=`Order ${allTasks.length} tasks`,
  prompt=agentPrompt
);

const summary = JSON.parse(result);
```

### Phase 5: Summary & Status Update

```javascript
// Agent already generated queue files, use summary
console.log(`
## Queue Formed: ${summary.queue_id}

**Tasks**: ${summary.total_tasks}
**Issues**: ${summary.issues_queued.join(', ')}
**Groups**: ${summary.execution_groups.map(g => `${g.id}(${g.count})`).join(', ')}
**Conflicts Resolved**: ${summary.conflicts_resolved}

Next: \`/issue:execute\`
`);

// Update issue statuses via CLI
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
