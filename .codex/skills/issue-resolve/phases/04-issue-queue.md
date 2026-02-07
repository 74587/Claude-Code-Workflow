# Phase 4: Form Execution Queue

## Overview

Queue formation command using **issue-queue-agent** that analyzes all bound solutions, resolves **inter-solution** conflicts, and creates an ordered execution queue at **solution level**.

**Design Principle**: Queue items are **solutions**, not individual tasks. Each executor receives a complete solution with all its tasks.

## Prerequisites

- Issues with `status: planned` and `bound_solution_id` exist
- Solutions written in `.workflow/issues/solutions/{issue-id}.jsonl`
- `ccw issue` CLI available

## Auto Mode

When `--yes` or `-y`: Auto-confirm queue formation, use recommended conflict resolutions.

## Core Capabilities

- **Agent-driven**: issue-queue-agent handles all ordering logic
- **Solution-level granularity**: Queue items are solutions, not tasks
- **Conflict clarification**: High-severity conflicts prompt user decision
- Semantic priority calculation per solution (0.0-1.0)
- Parallel/Sequential group assignment for solutions

## Core Guidelines

**Data Access Principle**: Issues and queue files can grow very large. To avoid context overflow:

| Operation | Correct | Incorrect |
|-----------|---------|-----------|
| List issues (brief) | `ccw issue list --status planned --brief` | `Read('issues.jsonl')` |
| **Batch solutions (NEW)** | `ccw issue solutions --status planned --brief` | Loop `ccw issue solution <id>` |
| List queue (brief) | `ccw issue queue --brief` | `Read('queues/*.json')` |
| Read issue details | `ccw issue status <id> --json` | `Read('issues.jsonl')` |
| Get next item | `ccw issue next --json` | `Read('queues/*.json')` |
| Update status | `ccw issue update <id> --status ...` | Direct file edit |
| Sync from queue | `ccw issue update --from-queue` | Direct file edit |
| Read solution (single) | `ccw issue solution <id> --brief` | `Read('solutions/*.jsonl')` |

**Output Options**:
- `--brief`: JSON with minimal fields (id, status, counts)
- `--json`: Full JSON (agent use only)

**Orchestration vs Execution**:
- **Command (orchestrator)**: Use `--brief` for minimal context
- **Agent (executor)**: Fetch full details → `ccw issue status <id> --json`

**ALWAYS** use CLI commands for CRUD operations. **NEVER** read entire `issues.jsonl` or `queues/*.json` directly.

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--queues <n>` | Number of parallel queues | 1 |
| `--issue <id>` | Form queue for specific issue only | All planned |
| `--append <id>` | Append issue to active queue (don't create new) | - |
| `--force` | Skip active queue check, always create new queue | false |

## CLI Subcommands Reference

```bash
ccw issue queue list                  List all queues with status
ccw issue queue add <issue-id>        Add issue to queue (interactive if active queue exists)
ccw issue queue add <issue-id> -f     Add to new queue without prompt (force)
ccw issue queue merge <src> --queue <target>  Merge source queue into target queue
ccw issue queue switch <queue-id>     Switch active queue
ccw issue queue archive               Archive current queue
ccw issue queue delete <queue-id>     Delete queue from history
```

## Execution Steps

### Step 4.1: Solution Loading & Distribution

**Data Loading:**
- Use `ccw issue solutions --status planned --brief` to get all planned issues with solutions in **one call**
- Returns: Array of `{ issue_id, solution_id, is_bound, task_count, files_touched[], priority }`
- If no bound solutions found → display message, suggest running plan/convert/brainstorm first

**Build Solution Objects:**
```javascript
// Single CLI call replaces N individual queries
const result = Bash(`ccw issue solutions --status planned --brief`).trim();
const solutions = result ? JSON.parse(result) : [];

if (solutions.length === 0) {
  console.log('No bound solutions found. Run /issue:plan first.');
  return;
}

// solutions already in correct format:
// { issue_id, solution_id, is_bound, task_count, files_touched[], priority }
```

**Multi-Queue Distribution** (if `--queues > 1`):
- Use `files_touched` from brief output for partitioning
- Group solutions with overlapping files into same queue

**Output:** Array of solution objects (or N arrays if multi-queue)

### Step 4.2: Agent-Driven Queue Formation

**Generate Queue IDs** (command layer, pass to agent):
```javascript
const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const numQueues = args.queues || 1;
const queueIds = numQueues === 1
  ? [`QUE-${timestamp}`]
  : Array.from({length: numQueues}, (_, i) => `QUE-${timestamp}-${i + 1}`);
```

**Agent Prompt** (same for each queue, with assigned solutions):
```
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/issue-queue-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

## Order Solutions into Execution Queue

**Queue ID**: ${queueId}
**Solutions**: ${solutions.length} from ${issues.length} issues
**Project Root**: ${cwd}
**Queue Index**: ${queueIndex} of ${numQueues}

### Input
${JSON.stringify(solutions)}
// Each object: { issue_id, solution_id, task_count, files_touched[], priority }

### Workflow

Step 1: Build dependency graph from solutions (nodes=solutions, edges=file conflicts via files_touched)
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
- Use `files_touched` from input (already extracted by orchestrator)

### Done Criteria
- [ ] Queue JSON written with all solutions ordered
- [ ] Index updated with active_queue_id
- [ ] No circular dependencies
- [ ] Parallel groups have no file overlaps
- [ ] Return JSON matches required shape
```

**Launch Agents** (parallel if multi-queue):
```javascript
const numQueues = args.queues || 1;

if (numQueues === 1) {
  // Single queue: single agent call
  const agentId = spawn_agent({
    message: buildPrompt(queueIds[0], solutions)
  });

  // Wait for completion
  const result = wait({
    ids: [agentId],
    timeout_ms: 600000  // 10 minutes
  });

  // Close agent
  close_agent({ id: agentId });
} else {
  // Multi-queue: parallel agent calls
  const agentIds = [];

  // Step 1: Spawn all agents
  solutionGroups.forEach((group, i) => {
    const agentId = spawn_agent({
      message: buildPrompt(queueIds[i], group, i + 1, numQueues)
    });
    agentIds.push(agentId);
  });

  // Step 2: Batch wait for all agents
  const results = wait({
    ids: agentIds,
    timeout_ms: 600000  // 10 minutes
  });

  if (results.timed_out) {
    console.log('Some queue agents timed out, continuing with completed results');
  }

  // Step 3: Collect results (see Step 4.3 for clarification handling)

  // Step 4: Batch cleanup - close all agents
  agentIds.forEach(id => close_agent({ id }));
}
```

**Multi-Queue Index Update:**
- First queue sets `active_queue_id`
- All queues added to `queues` array with `queue_group` field linking them

### Step 4.3: Conflict Clarification

**Collect Agent Results** (multi-queue):
```javascript
// Collect clarifications from all agents
const allClarifications = [];
agentIds.forEach((agentId, i) => {
  const agentStatus = results.status[agentId];
  if (agentStatus && agentStatus.completed) {
    const parsed = JSON.parse(agentStatus.completed);
    for (const c of parsed.clarifications || []) {
      allClarifications.push({ ...c, queue_id: queueIds[i], agent_id: agentId });
    }
  }
});
```

**Check Agent Return:**
- Parse agent result JSON (or all results if multi-queue)
- If any `clarifications` array exists and non-empty → user decision required

**Clarification Flow:**
```javascript
if (allClarifications.length > 0) {
  for (const clarification of allClarifications) {
    // Present to user via AskUserQuestion
    const answer = AskUserQuestion({
      questions: [{
        question: `[${clarification.queue_id}] ${clarification.question}`,
        header: clarification.conflict_id,
        options: clarification.options,
        multiSelect: false
      }]
    });

    // Re-spawn agent with user decision (original agent already closed)
    // Create new agent with previous context + resolution
    const resolveAgentId = spawn_agent({
      message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/issue-queue-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

## Conflict Resolution Update

**Queue ID**: ${clarification.queue_id}
**Conflict**: ${clarification.conflict_id} resolved: ${answer.selected}

### Instructions
1. Read existing queue file: .workflow/issues/queues/${clarification.queue_id}.json
2. Update conflict resolution with user decision
3. Re-order affected solutions if needed
4. Write updated queue file
`
    });

    const resolveResult = wait({
      ids: [resolveAgentId],
      timeout_ms: 300000  // 5 minutes
    });

    close_agent({ id: resolveAgentId });
  }
}
```

### Step 4.4: Status Update & Summary

**Status Update** (MUST use CLI command, NOT direct file operations):

```bash
# Option 1: Batch update from queue (recommended)
ccw issue update --from-queue [queue-id] --json
ccw issue update --from-queue --json              # Use active queue
ccw issue update --from-queue QUE-xxx --json      # Use specific queue

# Option 2: Individual issue update
ccw issue update <issue-id> --status queued
```

**IMPORTANT**: Do NOT directly modify `issues.jsonl`. Always use CLI command to ensure proper validation and history tracking.

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

### Step 4.5: Active Queue Check & Decision

**After agent completes, check for active queue:**

```bash
ccw issue queue list --brief
```

**Decision:**
- If `active_queue_id` is null → `ccw issue queue switch <new-queue-id>` (activate new queue)
- If active queue exists → Use **AskUserQuestion** to prompt user

**AskUserQuestion:**
```javascript
AskUserQuestion({
  questions: [{
    question: "Active queue exists. How would you like to proceed?",
    header: "Queue Action",
    options: [
      { label: "Merge into existing queue", description: "Add new items to active queue, delete new queue" },
      { label: "Use new queue", description: "Switch to new queue, keep existing in history" },
      { label: "Cancel", description: "Delete new queue, keep existing active" }
    ],
    multiSelect: false
  }]
})
```

**Action Commands:**

| User Choice | Commands |
|-------------|----------|
| **Merge into existing** | `ccw issue queue merge <new-queue-id> --queue <active-queue-id>` then `ccw issue queue delete <new-queue-id>` |
| **Use new queue** | `ccw issue queue switch <new-queue-id>` |
| **Cancel** | `ccw issue queue delete <new-queue-id>` |

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
  "active_queue_group": "QGR-20251227-143000",
  "queues": [
    {
      "id": "QUE-20251227-143000-1",
      "queue_group": "QGR-20251227-143000",
      "queue_index": 1,
      "total_queues": 3,
      "status": "active",
      "issue_ids": ["ISS-xxx", "ISS-yyy"],
      "total_solutions": 3,
      "completed_solutions": 1,
      "created_at": "2025-12-27T14:30:00Z"
    }
  ]
}
```

**Multi-Queue Fields:**
- `queue_group`: Links queues created in same batch (format: `QGR-{timestamp}`)
- `queue_index`: Position in group (1-based)
- `total_queues`: Total queues in group
- `active_queue_group`: Current active group (for multi-queue execution)

**Note**: Queue file schema is produced by `issue-queue-agent`. See agent documentation for details.

## Error Handling

| Error | Resolution |
|-------|------------|
| No bound solutions | Display message, suggest phases 1-3 (plan/convert/brainstorm) |
| Circular dependency | List cycles, abort queue formation |
| High-severity conflict | Return `clarifications`, prompt user decision |
| User cancels clarification | Abort queue formation |
| **index.json not updated** | Auto-fix: Set active_queue_id to new queue |
| **Queue file missing solutions** | Abort with error, agent must regenerate |
| **User cancels queue add** | Display message, return without changes |
| **Merge with empty source** | Skip merge, display warning |
| **All items duplicate** | Skip merge, display "All items already exist" |

## Quality Checklist

Before completing, verify:

- [ ] All planned issues with `bound_solution_id` are included
- [ ] Queue JSON written to `queues/{queue-id}.json` (N files if multi-queue)
- [ ] Index updated in `queues/index.json` with `active_queue_id`
- [ ] Multi-queue: All queues share same `queue_group`
- [ ] No circular dependencies in solution DAG
- [ ] All conflicts resolved (auto or via user clarification)
- [ ] Parallel groups have no file overlaps
- [ ] Cross-queue: No file overlaps between queues
- [ ] Issue statuses updated to `queued`
- [ ] All spawned agents are properly closed via close_agent

## Post-Phase Update

After queue formation:
- All planned issues updated to `status: queued`
- Queue files written and index updated
- Report: queue ID(s), solution count, task count, execution groups
- Recommend next step: `/issue:execute` to begin execution
