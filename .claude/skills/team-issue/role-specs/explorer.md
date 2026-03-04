---
prefix: EXPLORE
inner_loop: false
subagents: [cli-explore-agent]
message_types:
  success: context_ready
  error: error
---

# Issue Explorer

Analyze issue context, explore codebase for relevant files, map dependencies and impact scope. Produce a shared context report for planner, reviewer, and implementer.

## Phase 2: Issue Loading & Context Setup

| Input | Source | Required |
|-------|--------|----------|
| Issue ID | Task description (GH-\d+ or ISS-\d{8}-\d{6}) | Yes |
| Issue details | `ccw issue status <id> --json` | Yes |
| Session path | Extracted from task description | Yes |
| .msg/meta.json | <session>/wisdom/.msg/meta.json | No |

1. Extract issue ID from task description via regex: `(?:GH-\d+|ISS-\d{8}-\d{6})`
2. If no issue ID found -> report error, STOP
3. Load issue details:

```
Bash("ccw issue status <issueId> --json")
```

4. Parse JSON response for issue metadata (title, context, priority, labels, feedback)
5. Load wisdom files from `<session>/wisdom/` if available

## Phase 3: Codebase Exploration & Impact Analysis

**Complexity assessment determines exploration depth**:

| Signal | Weight | Keywords |
|--------|--------|----------|
| Structural change | +2 | refactor, architect, restructure, module, system |
| Cross-cutting | +2 | multiple, across, cross |
| Integration | +1 | integrate, api, database |
| High priority | +1 | priority >= 4 |

| Score | Complexity | Strategy |
|-------|------------|----------|
| >= 4 | High | Deep exploration via cli-explore-agent |
| 2-3 | Medium | Hybrid: ACE search + selective agent |
| 0-1 | Low | Direct ACE search only |

**Exploration execution**:

| Complexity | Execution |
|------------|-----------|
| Low | Direct ACE search: `mcp__ace-tool__search_context(project_root_path, query)` |
| Medium/High | Spawn cli-explore-agent: `Agent({ subagent_type: "cli-explore-agent", run_in_background: false })` |

**cli-explore-agent prompt template**:

```
## Issue Context
ID: <issueId>
Title: <issue.title>
Description: <issue.context>
Priority: <issue.priority>

## MANDATORY FIRST STEPS
1. Run: ccw tool exec get_modules_by_depth '{}'
2. Execute ACE searches based on issue keywords
3. Run: ccw spec load --category exploration

## Exploration Focus
- Identify files directly related to this issue
- Map dependencies and integration points
- Assess impact scope (how many modules/files affected)
- Find existing patterns relevant to the fix
- Check for previous related changes (git log)

## Output
Write findings to: <session>/explorations/context-<issueId>.json
```

**Report schema**:

```json
{
  "issue_id": "string",
  "issue": { "id": "", "title": "", "priority": 0, "status": "", "labels": [], "feedback": "" },
  "relevant_files": [{ "path": "", "relevance": "" }],
  "dependencies": [],
  "impact_scope": "low | medium | high",
  "existing_patterns": [],
  "related_changes": [],
  "key_findings": [],
  "complexity_assessment": "Low | Medium | High"
}
```

## Phase 4: Context Report & Wisdom Contribution

1. Write context report to `<session>/explorations/context-<issueId>.json`
2. If file not found from agent, build minimal report from ACE results
3. Update `<session>/wisdom/.msg/meta.json` under `explorer` namespace:
   - Read existing -> merge `{ "explorer": { issue_id, complexity, impact_scope, file_count } }` -> write back
4. Contribute discoveries to `<session>/wisdom/learnings.md` if new patterns found
