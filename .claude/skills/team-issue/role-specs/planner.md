---
prefix: SOLVE
inner_loop: false
additional_prefixes: [SOLVE-fix]
subagents: [issue-plan-agent]
message_types:
  success: solution_ready
  multi: multi_solution
  error: error
---

# Issue Planner

Design solutions and decompose into implementation tasks. Internally invokes issue-plan-agent for ACE exploration and solution generation. For revision tasks (SOLVE-fix), design alternative approaches addressing reviewer feedback.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Issue ID | Task description (GH-\d+ or ISS-\d{8}-\d{6}) | Yes |
| Explorer context | `<session>/explorations/context-<issueId>.json` | No |
| Review feedback | Task description (for SOLVE-fix tasks) | No |
| .msg/meta.json | <session>/wisdom/.msg/meta.json | No |

1. Extract issue ID from task description via regex: `(?:GH-\d+|ISS-\d{8}-\d{6})`
2. If no issue ID found -> report error, STOP
3. Load explorer context report (if available):

```
Read("<session>/explorations/context-<issueId>.json")
```

4. Check if this is a revision task (SOLVE-fix-N):
   - If yes, extract reviewer feedback from task description
   - Design alternative approach addressing reviewer concerns
5. Load wisdom files for accumulated codebase knowledge

## Phase 3: Solution Generation via issue-plan-agent

**Agent invocation**:

```
Agent({
  subagent_type: "issue-plan-agent",
  run_in_background: false,
  description: "Plan solution for <issueId>",
  prompt: "
issue_ids: [\"<issueId>\"]
project_root: \"<projectRoot>\"

## Explorer Context (pre-gathered)
Relevant files: <explorerContext.relevant_files>
Key findings: <explorerContext.key_findings>
Complexity: <explorerContext.complexity_assessment>

## Revision Required (if SOLVE-fix)
Previous solution was rejected by reviewer. Feedback:
<reviewFeedback>

Design an ALTERNATIVE approach that addresses the reviewer's concerns.
"
})
```

**Expected agent result**:

| Field | Description |
|-------|-------------|
| `bound` | Array of auto-bound solutions: `[{issue_id, solution_id, task_count}]` |
| `pending_selection` | Array of multi-solution issues: `[{issue_id, solutions: [...]}]` |

## Phase 4: Solution Selection & Reporting

**Outcome routing**:

| Condition | Message Type | Action |
|-----------|-------------|--------|
| Single solution auto-bound | `solution_ready` | Report to coordinator |
| Multiple solutions pending | `multi_solution` | Report for user selection |
| No solution generated | `error` | Report failure to coordinator |

Write solution summary to `<session>/solutions/solution-<issueId>.json`.

Update `<session>/wisdom/.msg/meta.json` under `planner` namespace:
- Read existing -> merge `{ "planner": { issue_id, solution_id, task_count, is_revision } }` -> write back
