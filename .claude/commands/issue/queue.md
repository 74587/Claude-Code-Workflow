---
name: queue
description: Form execution queue from bound solutions using issue-queue-agent
argument-hint: "[--rebuild] [--issue <id>]"
allowed-tools: TodoWrite(*), Task(*), Bash(*), Read(*), Write(*)
---

# Issue Queue Command (/issue:queue)

## Overview

Queue formation command using **issue-queue-agent** that analyzes all bound solutions, resolves conflicts, determines dependencies, and creates an ordered execution queue. The queue is global across all issues.

**Core capabilities:**
- **Agent-driven**: issue-queue-agent handles all ordering logic
- ACE semantic search for relationship discovery
- Dependency DAG construction and cycle detection
- File conflict detection and resolution
- Semantic priority calculation (0.0-1.0)
- Parallel/Sequential group assignment
- Output global queue.json

## Storage Structure (Flat JSONL)

```
.workflow/issues/
├── issues.jsonl              # All issues (one per line)
├── queue.json                # Execution queue (output)
└── solutions/
    ├── {issue-id}.jsonl      # Solutions for issue
    └── ...
```

## Usage

```bash
/issue:queue [FLAGS]

# Examples
/issue:queue                  # Form queue from all bound solutions
/issue:queue --rebuild        # Rebuild queue (clear and regenerate)
/issue:queue --issue GH-123   # Add only specific issue to queue

# Flags
--rebuild         Clear existing queue and regenerate
--issue <id>      Add only specific issue's tasks
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
// Launch issue-queue-agent to handle all ordering logic
const agentPrompt = `
## Tasks to Order

${JSON.stringify(allTasks, null, 2)}

## Project Root
${process.cwd()}

## Requirements
1. Build dependency DAG from depends_on fields
2. Detect circular dependencies (abort if found)
3. Identify file modification conflicts
4. Resolve conflicts using ordering rules:
   - Create before Update/Implement
   - Foundation scopes (config/types) before implementation
   - Core logic before tests
5. Calculate semantic priority (0.0-1.0) for each task
6. Assign execution groups (parallel P* / sequential S*)
7. Output queue JSON
`;

const result = Task(
  subagent_type="issue-queue-agent",
  run_in_background=false,
  description=`Order ${allTasks.length} tasks from ${plannedIssues.length} issues`,
  prompt=agentPrompt
);

// Parse agent output
const agentOutput = JSON.parse(result);

if (!agentOutput.success) {
  console.error(`Queue formation failed: ${agentOutput.error}`);
  if (agentOutput.cycles) {
    console.error('Circular dependencies:', agentOutput.cycles.join(', '));
  }
  return;
}
```

### Phase 5: Queue Output & Summary

```javascript
const queueOutput = agentOutput.output;

// Write queue.json
Write('.workflow/issues/queue.json', JSON.stringify(queueOutput, null, 2));

// Update issue statuses in issues.jsonl
const updatedIssues = allIssues.map(issue => {
  if (plannedIssues.find(p => p.id === issue.id)) {
    return {
      ...issue,
      status: 'queued',
      queued_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
  return issue;
});

Write(issuesPath, updatedIssues.map(i => JSON.stringify(i)).join('\n'));

// Display summary
console.log(`
## Queue Formed

**Total Tasks**: ${queueOutput.queue.length}
**Issues**: ${plannedIssues.length}
**Conflicts**: ${queueOutput.conflicts?.length || 0} (${queueOutput._metadata?.resolved_conflicts || 0} resolved)

### Execution Groups
${(queueOutput.execution_groups || []).map(g => {
  const type = g.type === 'parallel' ? 'Parallel' : 'Sequential';
  return `- ${g.id} (${type}): ${g.task_count} tasks`;
}).join('\n')}

### Next Steps
1. Review queue: \`ccw issue queue list\`
2. Execute: \`/issue:execute\`
`);
```

## Queue Schema

Output `queue.json`:

```json
{
  "queue": [
    {
      "queue_id": "Q-001",
      "issue_id": "GH-123",
      "solution_id": "SOL-001",
      "task_id": "T1",
      "status": "pending",
      "execution_order": 1,
      "execution_group": "P1",
      "depends_on": [],
      "semantic_priority": 0.7,
      "queued_at": "2025-12-26T10:00:00Z"
    }
  ],
  "conflicts": [
    {
      "type": "file_conflict",
      "file": "src/auth.ts",
      "tasks": ["GH-123:T1", "GH-124:T2"],
      "resolution": "sequential",
      "resolution_order": ["GH-123:T1", "GH-124:T2"],
      "rationale": "T1 creates file before T2 updates",
      "resolved": true
    }
  ],
  "execution_groups": [
    { "id": "P1", "type": "parallel", "task_count": 3, "tasks": ["GH-123:T1", "GH-124:T1", "GH-125:T1"] },
    { "id": "S2", "type": "sequential", "task_count": 2, "tasks": ["GH-123:T2", "GH-124:T2"] }
  ],
  "_metadata": {
    "version": "2.0",
    "storage": "jsonl",
    "total_tasks": 5,
    "total_conflicts": 1,
    "resolved_conflicts": 1,
    "parallel_groups": 1,
    "sequential_groups": 1,
    "timestamp": "2025-12-26T10:00:00Z",
    "source": "issue-queue-agent"
  }
}
```

## Semantic Priority Rules

| Factor | Priority Boost |
|--------|---------------|
| Create action | +0.2 |
| Configure action | +0.15 |
| Implement action | +0.1 |
| Config/Types scope | +0.1 |
| Refactor action | -0.05 |
| Test action | -0.1 |
| Delete action | -0.15 |

## Error Handling

| Error | Resolution |
|-------|------------|
| No bound solutions | Display message, suggest /issue:plan |
| Circular dependency | List cycles, abort queue formation |
| Unresolved conflicts | Agent resolves using ordering rules |
| Invalid task reference | Skip and warn |

## Agent Integration

The command uses `issue-queue-agent` which:
1. Builds dependency DAG from task depends_on fields
2. Detects circular dependencies (aborts if found)
3. Identifies file modification conflicts across issues
4. Resolves conflicts using semantic ordering rules
5. Calculates priority (0.0-1.0) for each task
6. Assigns parallel/sequential execution groups
7. Outputs structured queue JSON

See `.claude/agents/issue-queue-agent.md` for agent specification.

## Related Commands

- `/issue:plan` - Plan issues and bind solutions
- `/issue:execute` - Execute queue with codex
- `ccw issue queue list` - View current queue
