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

## Core Capabilities

- **Agent-driven**: issue-queue-agent handles all ordering logic
- **Solution-level granularity**: Queue items are solutions, not tasks
- **Conflict clarification**: High-severity conflicts prompt user decision
- Semantic priority calculation per solution (0.0-1.0)
- Parallel/Sequential group assignment for solutions

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
- `--json`: Full JSON (agent use only)

**Orchestration vs Execution**:
- **Command (orchestrator)**: Use `--brief` for minimal context
- **Agent (executor)**: Fetch full details → `ccw issue status <id> --json`

**ALWAYS** use CLI commands for CRUD operations. **NEVER** read entire `issues.jsonl` or `queues/*.json` directly.



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
   ├─ Load issues.jsonl, filter by status='planned' + bound_solution_id
   ├─ Read solutions/{issue-id}.jsonl, find bound solution
   ├─ Extract files_touched from task modification_points
   └─ Build solution objects array

Phase 2-4: Agent-Driven Queue Formation (issue-queue-agent)
   ├─ Launch issue-queue-agent with solutions array
   ├─ Agent performs:
   │   ├─ Conflict analysis (5 types via Gemini CLI)
   │   ├─ Build dependency DAG from conflicts
   │   ├─ Calculate semantic priority per solution
   │   └─ Assign execution groups (parallel/sequential)
   └─ Agent writes: queue JSON + index update

Phase 5: Conflict Clarification (if needed)
   ├─ Check agent return for `clarifications` array
   ├─ If clarifications exist → AskUserQuestion
   ├─ Pass user decisions back to agent (resume)
   └─ Agent updates queue with resolved conflicts

Phase 6: Status Update & Summary
   ├─ Update issue statuses to 'queued'
   └─ Display queue summary, next step: /issue:execute
```

## Implementation

### Phase 1: Solution Loading

**Data Loading:**
- Load `issues.jsonl` and filter issues with `status === 'planned'` and `bound_solution_id`
- If no planned issues found → display message, suggest `/issue:plan`

**Solution Collection** (for each planned issue):
- Read `solutions/{issue-id}.jsonl`
- Find bound solution by `bound_solution_id`
- If bound solution not found → warn and skip issue
- Extract `files_touched` from all task `modification_points`

**Build Solution Objects:**
```json
{
  "issue_id": "ISS-xxx",
  "solution_id": "SOL-ISS-xxx-1",
  "task_count": 3,
  "files_touched": ["src/auth.ts", "src/utils.ts"],
  "priority": "medium"
}
```

**Output:** Array of solution objects ready for agent processing

### Phase 2-4: Agent-Driven Queue Formation

**Generate Queue ID** (command layer, pass to agent):
```javascript
const queueId = `QUE-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
```

**Agent Prompt**:
```
## Order Solutions into Execution Queue

**Queue ID**: ${queueId}
**Solutions**: ${solutions.length} from ${issues.length} issues
**Project Root**: ${cwd}

### Input
${JSON.stringify(solutions)}

### Workflow

Step 1: Build dependency graph from solutions (nodes=solutions, edges=file conflicts)
Step 2: Use Gemini CLI for conflict analysis (5 types: file, API, data, dependency, architecture)
Step 3: For high-severity conflicts without clear resolution → add to `clarifications`
Step 4: Calculate semantic priority (base from issue priority + task_count boost)
Step 5: Assign execution groups: P* (parallel, no overlaps) / S* (sequential, shared files)
Step 6: Write queue JSON + update index

### Output Requirements

**Write files** (exactly 2):
- `.workflow/issues/queues/${queueId}.json` - Full queue with solutions, conflicts, groups
- `.workflow/issues/queues/index.json` - Update with new queue entry

**Return JSON**:
\`\`\`json
{
  "queue_id": "${queueId}",
  "total_solutions": N,
  "total_tasks": N,
  "execution_groups": [{"id": "P1", "type": "parallel", "count": N}],
  "issues_queued": ["ISS-xxx"],
  "clarifications": [{"conflict_id": "CFT-1", "question": "...", "options": [...]}]
}
\`\`\`

### Rules
- Solution granularity (NOT individual tasks)
- Queue Item ID format: S-1, S-2, S-3, ...
- Use provided Queue ID (do NOT generate new)
- `clarifications` only present if high-severity unresolved conflicts exist

### Done Criteria
- [ ] Queue JSON written with all solutions ordered
- [ ] Index updated with active_queue_id
- [ ] No circular dependencies
- [ ] Parallel groups have no file overlaps
- [ ] Return JSON matches required shape
```

**Launch Agent**:
```javascript
const result = Task(
  subagent_type="issue-queue-agent",
  prompt=agentPrompt,
  description=`Order ${solutions.length} solutions`
);
```

### Phase 5: Conflict Clarification

**Check Agent Return:**
- Parse agent result JSON
- If `clarifications` array exists and non-empty → user decision required

**Clarification Flow:**
```javascript
if (result.clarifications?.length > 0) {
  for (const clarification of result.clarifications) {
    // Present to user via AskUserQuestion
    const answer = AskUserQuestion({
      questions: [{
        question: clarification.question,
        header: clarification.conflict_id,
        options: clarification.options,
        multiSelect: false
      }]
    });

    // Resume agent with user decision
    Task(
      subagent_type="issue-queue-agent",
      resume=agentId,
      prompt=`Conflict ${clarification.conflict_id} resolved: ${answer.selected}`
    );
  }
}
```

### Phase 6: Status Update & Summary

**Status Update** (MUST use CLI command, NOT direct file operations):

```bash
# Option 1: Batch update from queue (recommended)
ccw issue update --from-queue [queue-id] --json
ccw issue update --from-queue --json              # Use active queue
ccw issue update --from-queue QUE-xxx --json      # Use specific queue

# Option 2: Individual issue update
ccw issue update <issue-id> --status queued
```

**⚠️ IMPORTANT**: Do NOT directly modify `issues.jsonl`. Always use CLI command to ensure proper validation and history tracking.

**Output** (JSON):
```json
{
  "success": true,
  "queue_id": "QUE-xxx",
  "queued": ["ISS-001", "ISS-002"],
  "queued_count": 2,
  "unplanned": ["ISS-003"],
  "unplanned_count": 1
}
```

**Behavior:**
- Updates issues in queue to `status: 'queued'` (skips already queued/executing/completed)
- Identifies planned issues with `bound_solution_id` NOT in queue → `unplanned` array
- Optional `queue-id`: defaults to active queue if omitted

**Summary Output:**
- Display queue ID, solution count, task count
- Show unplanned issues (planned but NOT in queue)
- Show next step: `/issue:execute`


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

**Note**: Queue file schema is produced by `issue-queue-agent`. See agent documentation for details.
## Error Handling

| Error | Resolution |
|-------|------------|
| No bound solutions | Display message, suggest /issue:plan |
| Circular dependency | List cycles, abort queue formation |
| High-severity conflict | Return `clarifications`, prompt user decision |
| User cancels clarification | Abort queue formation |
| **index.json not updated** | Auto-fix: Set active_queue_id to new queue |
| **Queue file missing solutions** | Abort with error, agent must regenerate |

## Quality Checklist

Before completing, verify:

- [ ] All planned issues with `bound_solution_id` are included
- [ ] Queue JSON written to `queues/{queue-id}.json`
- [ ] Index updated in `queues/index.json` with `active_queue_id`
- [ ] No circular dependencies in solution DAG
- [ ] All conflicts resolved (auto or via user clarification)
- [ ] Parallel groups have no file overlaps
- [ ] Issue statuses updated to `queued`

## Related Commands

- `/issue:plan` - Plan issues and bind solutions
- `/issue:execute` - Execute queue with codex
- `ccw issue queue list` - View current queue
- `ccw issue update --from-queue [queue-id]` - Sync issue statuses from queue
