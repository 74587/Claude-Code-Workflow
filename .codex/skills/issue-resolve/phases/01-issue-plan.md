# Phase 1: Explore & Plan

## Overview

Batch plan issue resolution using **issue-plan-agent** that combines exploration and planning into a single closed-loop workflow.

**Behavior:**
- Single solution per issue → auto-bind
- Multiple solutions → return for user selection
- Agent handles file generation

## Prerequisites

- Issue IDs provided (comma-separated) or `--all-pending` flag
- `ccw issue` CLI available
- `.workflow/issues/` directory exists or will be created

## Auto Mode

When `--yes` or `-y`: Auto-bind solutions without confirmation, use recommended settings.

## Core Guidelines

**Data Access Principle**: Issues and solutions files can grow very large. To avoid context overflow:

| Operation | Correct | Incorrect |
|-----------|---------|-----------|
| List issues (brief) | `ccw issue list --status pending --brief` | `Read('issues.jsonl')` |
| Read issue details | `ccw issue status <id> --json` | `Read('issues.jsonl')` |
| Update status | `ccw issue update <id> --status ...` | Direct file edit |
| Bind solution | `ccw issue bind <id> <sol-id>` | Direct file edit |

**Output Options**:
- `--brief`: JSON with minimal fields (id, title, status, priority, tags)
- `--json`: Full JSON (agent use only)

**Orchestration vs Execution**:
- **Command (orchestrator)**: Use `--brief` for minimal context
- **Agent (executor)**: Fetch full details → `ccw issue status <id> --json`

**ALWAYS** use CLI commands for CRUD operations. **NEVER** read entire `issues.jsonl` or `solutions/*.jsonl` directly. 

## Execution Steps

### Step 1.1: Issue Loading (Brief Info Only)

```javascript
const batchSize = flags.batchSize || 3;
let issues = [];  // {id, title, tags} - brief info for grouping only

// Default to --all-pending if no input provided
const useAllPending = flags.allPending || !userInput || userInput.trim() === '';

if (useAllPending) {
  // Get pending issues with brief metadata via CLI
  const result = Bash(`ccw issue list --status pending,registered --json`).trim();
  const parsed = result ? JSON.parse(result) : [];
  issues = parsed.map(i => ({ id: i.id, title: i.title || '', tags: i.tags || [] }));

  if (issues.length === 0) {
    console.log('No pending issues found.');
    return;
  }
  console.log(`Found ${issues.length} pending issues`);
} else {
  // Parse comma-separated issue IDs, fetch brief metadata
  const ids = userInput.includes(',')
    ? userInput.split(',').map(s => s.trim())
    : [userInput.trim()];

  for (const id of ids) {
    Bash(`ccw issue init ${id} --title "Issue ${id}" 2>/dev/null || true`);
    const info = Bash(`ccw issue status ${id} --json`).trim();
    const parsed = info ? JSON.parse(info) : {};
    issues.push({ id, title: parsed.title || '', tags: parsed.tags || [] });
  }
}
// Note: Agent fetches full issue content via `ccw issue status <id> --json`

// Intelligent grouping: Analyze issues by title/tags, group semantically similar ones
// Strategy: Same module/component, related bugs, feature clusters
// Constraint: Max ${batchSize} issues per batch

console.log(`Processing ${issues.length} issues in ${batches.length} batch(es)`);

update_plan({
  explanation: "Issue loading complete, starting batch planning",
  plan: batches.map((_, i) => ({
    step: `Plan batch ${i+1}`,
    status: 'pending'
  }))
});
```

### Step 1.2: Unified Explore + Plan (issue-plan-agent) - PARALLEL

```javascript
Bash(`mkdir -p .workflow/issues/solutions`);
const pendingSelections = [];  // Collect multi-solution issues for user selection
const agentResults = [];       // Collect all agent results for conflict aggregation

// Build prompts for all batches
const agentTasks = batches.map((batch, batchIndex) => {
  const issueList = batch.map(i => `- ${i.id}: ${i.title}${i.tags.length ? ` [${i.tags.join(', ')}]` : ''}`).join('\n');
  const batchIds = batch.map(i => i.id);

  const issuePrompt = `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/issue-plan-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

## Plan Issues

**Issues** (grouped by similarity):
${issueList}

**Project Root**: ${process.cwd()}

### Project Context (MANDATORY)
1. Read: .workflow/project-tech.json (technology stack, architecture)
2. Read: .workflow/project-guidelines.json (constraints and conventions)

### Workflow
1. Fetch issue details: ccw issue status <id> --json
2. **Analyze failure history** (if issue.feedback exists):
   - Extract failure details from issue.feedback (type='failure', stage='execute')
   - Parse error_type, message, task_id, solution_id from content JSON
   - Identify failure patterns: repeated errors, root causes, blockers
   - **Constraint**: Avoid repeating failed approaches
3. Load project context files
4. Explore codebase (ACE semantic search)
5. Plan solution with tasks (schema: solution-schema.json)
   - **If previous solution failed**: Reference failure analysis in solution.approach
   -  Add explicit verification steps to prevent same failure mode
6. **If github_url exists**: Add final task to comment on GitHub issue
7. Write solution to: .workflow/issues/solutions/{issue-id}.jsonl
8. **CRITICAL - Binding Decision**:
   - Single solution → **MUST execute**: ccw issue bind <issue-id> <solution-id>
   - Multiple solutions → Return pending_selection only (no bind)

### Failure-Aware Planning Rules
- **Extract failure patterns**: Parse issue.feedback where type='failure' and stage='execute'
- **Identify root causes**: Analyze error_type (test_failure, compilation, timeout, etc.)
- **Design alternative approach**: Create solution that addresses root cause
- **Add prevention steps**: Include explicit verification to catch same error earlier
- **Document lessons**: Reference previous failures in solution.approach

### Rules
- Solution ID format: SOL-{issue-id}-{uid} (uid: 4 random alphanumeric chars, e.g., a7x9)
- Single solution per issue → auto-bind via ccw issue bind
- Multiple solutions → register only, return pending_selection
- Tasks must have quantified acceptance.criteria

### Return Summary
{"bound":[{"issue_id":"...","solution_id":"...","task_count":N}],"pending_selection":[{"issue_id":"...","solutions":[{"id":"...","description":"...","task_count":N}]}]}
`;

  return { batchIndex, batchIds, issuePrompt, batch };
});

// Launch agents in parallel (max 10 concurrent)
const MAX_PARALLEL = 10;
for (let i = 0; i < agentTasks.length; i += MAX_PARALLEL) {
  const chunk = agentTasks.slice(i, i + MAX_PARALLEL);
  const agentIds = [];

  // Step 1: Spawn agents in parallel
  for (const { batchIndex, batchIds, issuePrompt, batch } of chunk) {
    updatePlanStep(`Plan batch ${batchIndex + 1}`, 'in_progress');
    const agentId = spawn_agent({
      message: issuePrompt
    });
    agentIds.push({ agentId, batchIndex });
  }

  console.log(`Launched ${agentIds.length} agents (chunk ${Math.floor(i/MAX_PARALLEL) + 1}/${Math.ceil(agentTasks.length/MAX_PARALLEL)})...`);

  // Step 2: Batch wait for all agents in this chunk
  const allIds = agentIds.map(a => a.agentId);
  const waitResult = wait({
    ids: allIds,
    timeout_ms: 600000  // 10 minutes
  });

  if (waitResult.timed_out) {
    console.log('Some agents timed out, continuing with completed results');
  }

  // Step 3: Collect results from completed agents
  for (const { agentId, batchIndex } of agentIds) {
    const agentStatus = waitResult.status[agentId];
    if (!agentStatus || !agentStatus.completed) {
      console.log(`Batch ${batchIndex + 1}: Agent did not complete, skipping`);
      updatePlanStep(`Plan batch ${batchIndex + 1}`, 'completed');
      continue;
    }

    const result = agentStatus.completed;

    // Extract JSON from potential markdown code blocks (agent may wrap in ```json...```)
    const jsonText = extractJsonFromMarkdown(result);
    let summary;
    try {
      summary = JSON.parse(jsonText);
    } catch (e) {
      console.log(`Batch ${batchIndex + 1}: Failed to parse agent result, skipping`);
      updatePlanStep(`Plan batch ${batchIndex + 1}`, 'completed');
      continue;
    }
    agentResults.push(summary);  // Store for conflict aggregation

    // Verify binding for bound issues (agent should have executed bind)
    for (const item of summary.bound || []) {
      const status = JSON.parse(Bash(`ccw issue status ${item.issue_id} --json`).trim());
      if (status.bound_solution_id === item.solution_id) {
        console.log(`${item.issue_id}: ${item.solution_id} (${item.task_count} tasks)`);
      } else {
        // Fallback: agent failed to bind, execute here
        Bash(`ccw issue bind ${item.issue_id} ${item.solution_id}`);
        console.log(`${item.issue_id}: ${item.solution_id} (${item.task_count} tasks) [recovered]`);
      }
    }
    // Collect pending selections
    for (const pending of summary.pending_selection || []) {
      pendingSelections.push(pending);
    }
    updatePlanStep(`Plan batch ${batchIndex + 1}`, 'completed');
  }

  // Step 4: Batch cleanup - close all agents in this chunk
  allIds.forEach(id => close_agent({ id }));
}
```

### Step 1.3: Solution Selection (if pending)

```javascript
// Handle multi-solution issues
for (const pending of pendingSelections) {
  if (pending.solutions.length === 0) continue;

  const options = pending.solutions.slice(0, 4).map(sol => ({
    label: `${sol.id} (${sol.task_count} tasks)`,
    description: sol.description || sol.approach || 'No description'
  }));

  const answer = ASK_USER([{
    id: pending.issue_id,
    type: "select",
    prompt: `Issue ${pending.issue_id}: which solution to bind?`,
    options: options
  }]);  // BLOCKS (wait for user response)

  const selected = answer[Object.keys(answer)[0]];
  if (!selected || selected === 'Other') continue;

  const solId = selected.split(' ')[0];
  Bash(`ccw issue bind ${pending.issue_id} ${solId}`);
  console.log(`${pending.issue_id}: ${solId} bound`);
}
```

### Step 1.4: Summary

```javascript
// Count planned issues via CLI
const planned = JSON.parse(Bash(`ccw issue list --status planned --brief`) || '[]');
const plannedCount = planned.length;

console.log(`
## Done: ${issues.length} issues → ${plannedCount} planned

Next: \`/issue:queue\` → \`/issue:execute\`
`);
```

## Error Handling

| Error | Resolution |
|-------|------------|
| Issue not found | Auto-create in issues.jsonl |
| ACE search fails | Agent falls back to ripgrep |
| No solutions generated | Display error, suggest manual planning |
| User cancels selection | Skip issue, continue with others |
| File conflicts | Agent detects and suggests resolution order |

## Bash Compatibility

**Avoid**: `$(cmd)`, `$var`, `for` loops — will be escaped incorrectly

**Use**: Simple commands + `&&` chains, quote comma params `"pending,registered"`

## Quality Checklist

Before completing, verify:

- [ ] All input issues have solutions in `solutions/{issue-id}.jsonl`
- [ ] Single solution issues are auto-bound (`bound_solution_id` set)
- [ ] Multi-solution issues returned in `pending_selection` for user choice
- [ ] Each solution has executable tasks with `modification_points`
- [ ] Task acceptance criteria are quantified (not vague)
- [ ] Conflicts detected and reported (if multiple issues touch same files)
- [ ] Issue status updated to `planned` after binding
- [ ] All spawned agents are properly closed via close_agent

## Post-Phase Update

After plan completion:
- All processed issues should have `status: planned` and `bound_solution_id` set
- Report: total issues processed, solutions bound, pending selections resolved
- Recommend next step: Form execution queue via Phase 4
