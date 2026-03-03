---
prefix: EXPLORE
inner_loop: false
subagents: [cli-explore-agent]
message_types:
  success: exploration_ready
  error: error
---

# Codebase Explorer

Explore codebase structure through cli-explore-agent, collecting structured context (files, patterns, findings) for downstream analysis. One explorer per analysis perspective.

## Phase 2: Context & Scope Assessment

| Input | Source | Required |
|-------|--------|----------|
| Task description | From task subject/description | Yes |
| Session path | Extracted from task description | Yes |

1. Extract session path, topic, perspective, dimensions from task description:

| Field | Pattern | Default |
|-------|---------|---------|
| sessionFolder | `session:\s*(.+)` | required |
| topic | `topic:\s*(.+)` | required |
| perspective | `perspective:\s*(.+)` | "general" |
| dimensions | `dimensions:\s*(.+)` | "general" |

2. Determine exploration number from task subject (EXPLORE-N)
3. Build exploration strategy by perspective:

| Perspective | Focus | Search Depth |
|-------------|-------|-------------|
| general | Overall codebase structure and patterns | broad |
| technical | Implementation details, code patterns, feasibility | medium |
| architectural | System design, module boundaries, interactions | broad |
| business | Business logic, domain models, value flows | medium |
| domain_expert | Domain patterns, standards, best practices | deep |

## Phase 3: Codebase Exploration

Spawn `cli-explore-agent` subagent for actual exploration:

```
Task({
  subagent_type: "cli-explore-agent",
  run_in_background: false,
  description: "Explore codebase: <topic> (<perspective>)",
  prompt: `
## Analysis Context
Topic: <topic>
Perspective: <perspective> -- <strategy.focus>
Dimensions: <dimensions>
Session: <session-folder>

## MANDATORY FIRST STEPS
1. Run: ccw tool exec get_modules_by_depth '{}'
2. Execute searches based on topic + perspective keywords
3. Run: ccw spec load --category exploration

## Exploration Focus (<perspective> angle)
<dimension-specific exploration instructions>

## Output
Write findings to: <session>/explorations/exploration-<num>.json
Schema: { perspective, relevant_files: [{path, relevance, summary}], patterns: [string],
  key_findings: [string], module_map: {module: [files]}, questions_for_analysis: [string],
  _metadata: {agent, perspective, search_queries, timestamp} }
`
})
```

**ACE fallback** (when cli-explore-agent produces no output):
```
mcp__ace-tool__search_context({ project_root_path: ".", query: "<topic> <perspective>" })
```

## Phase 4: Result Validation

| Check | Method | Action on Failure |
|-------|--------|-------------------|
| Output file exists | Read output path | Create empty result, run ACE fallback |
| Has relevant_files | Array length > 0 | Trigger ACE supplementary search |
| Has key_findings | Array length > 0 | Note partial results, proceed |

Write validated exploration to `<session>/explorations/exploration-<num>.json`.

Update `<session>/wisdom/.msg/meta.json` under `explorer` namespace:
- Read existing -> merge `{ "explorer": { perspective, file_count, finding_count } }` -> write back
