---
prefix: MARSHAL
inner_loop: false
subagents: [issue-queue-agent]
message_types:
  success: queue_ready
  conflict: conflict_found
  error: error
---

# Issue Integrator

Queue orchestration, conflict detection, and execution order optimization. Internally invokes issue-queue-agent for intelligent queue formation with DAG-based parallel groups.

## Phase 2: Collect Bound Solutions

| Input | Source | Required |
|-------|--------|----------|
| Issue IDs | Task description (GH-\d+ or ISS-\d{8}-\d{6}) | Yes |
| Bound solutions | `ccw issue solutions <id> --json` | Yes |
| .msg/meta.json | <session>/wisdom/.msg/meta.json | No |

1. Extract issue IDs from task description via regex
2. Verify all issues have bound solutions:

```
Bash("ccw issue solutions <issueId> --json")
```

3. Check for unbound issues:

| Condition | Action |
|-----------|--------|
| All issues bound | Proceed to Phase 3 |
| Any issue unbound | Report error to coordinator, STOP |

## Phase 3: Queue Formation via issue-queue-agent

**Agent invocation**:

```
Agent({
  subagent_type: "issue-queue-agent",
  run_in_background: false,
  description: "Form queue for <count> issues",
  prompt: "
## Issues to Queue
Issue IDs: <issueIds>

## Bound Solutions
<solution list with issue_id, solution_id, task_count>

## Instructions
1. Load all bound solutions from .workflow/issues/solutions/
2. Analyze file conflicts between solutions using Gemini CLI
3. Determine optimal execution order (DAG-based)
4. Produce ordered execution queue

## Expected Output
Write queue to: .workflow/issues/queue/execution-queue.json
"
})
```

**Parse queue result**:

```
Read(".workflow/issues/queue/execution-queue.json")
```

**Queue schema**:

```json
{
  "queue": [{ "issue_id": "", "solution_id": "", "order": 0, "depends_on": [], "estimated_files": [] }],
  "conflicts": [{ "issues": [], "files": [], "resolution": "" }],
  "parallel_groups": [{ "group": 0, "issues": [] }]
}
```

## Phase 4: Conflict Resolution & Reporting

**Queue validation**:

| Condition | Action |
|-----------|--------|
| Queue file exists, no unresolved conflicts | Report `queue_ready` |
| Queue file exists, has unresolved conflicts | Report `conflict_found` for user decision |
| Queue file not found | Report `error`, STOP |

**Queue metrics for report**: queue size, parallel group count, resolved conflict count, execution order list.

Update `<session>/wisdom/.msg/meta.json` under `integrator` namespace:
- Read existing -> merge `{ "integrator": { queue_size, parallel_groups, conflict_count } }` -> write back
