---
name: plan
description: Batch plan issue resolution using issue-plan-agent (explore + plan closed-loop)
argument-hint: "--all-pending <issue-id>[,<issue-id>,...] [--batch-size 3] "
allowed-tools: TodoWrite(*), Task(*), SlashCommand(*), AskUserQuestion(*), Bash(*), Read(*), Write(*)
---

# Issue Plan Command (/issue:plan)

## Overview

Unified planning command using **issue-plan-agent** that combines exploration and planning into a single closed-loop workflow.

## Output Requirements

**Generate Files:**
1. `.workflow/issues/solutions/{issue-id}.jsonl` - Solution with tasks for each issue

**Return Summary:**
```json
{
  "bound": [{ "issue_id": "...", "solution_id": "...", "task_count": N }],
  "pending_selection": [{ "issue_id": "...", "solutions": [...] }],
  "conflicts": [{ "file": "...", "issues": [...] }]
}
```

**Completion Criteria:**
- [ ] Solution file generated for each issue
- [ ] Single solution → auto-bound via `ccw issue bind`
- [ ] Multiple solutions → returned for user selection
- [ ] Tasks conform to schema: `cat .claude/workflows/cli-templates/schemas/solution-schema.json`
- [ ] Each task has quantified `acceptance.criteria`

## Core Capabilities

- **Closed-loop agent**: issue-plan-agent combines explore + plan
- Batch processing: 1 agent processes 1-3 issues
- ACE semantic search integrated into planning
- Solution with executable tasks and delivery criteria
- Automatic solution registration and binding

## Storage Structure (Flat JSONL)

```
.workflow/issues/
├── issues.jsonl              # All issues (one per line)
├── queue.json                # Execution queue
└── solutions/
    ├── {issue-id}.jsonl      # Solutions for issue (one per line)
    └── ...
```

## Usage

```bash
/issue:plan <issue-id>[,<issue-id>,...] [FLAGS]

# Examples
/issue:plan GH-123                    # Single issue
/issue:plan GH-123,GH-124,GH-125      # Batch (up to 3)
/issue:plan --all-pending             # All pending issues

# Flags
--batch-size <n>      Max issues per agent batch (default: 3)
```

## Execution Process

```
Phase 1: Issue Loading
   ├─ Parse input (single, comma-separated, or --all-pending)
   ├─ Fetch issue metadata (ID, title, tags)
   ├─ Validate issues exist (create if needed)
   └─ Group by similarity (shared tags or title keywords, max 3 per batch)

Phase 2: Unified Explore + Plan (issue-plan-agent)
   ├─ Launch issue-plan-agent per batch
   ├─ Agent performs:
   │   ├─ ACE semantic search for each issue
   │   ├─ Codebase exploration (files, patterns, dependencies)
   │   ├─ Solution generation with task breakdown
   │   └─ Conflict detection across issues
   └─ Output: solution JSON per issue

Phase 3: Solution Registration & Binding
   ├─ Append solutions to solutions/{issue-id}.jsonl
   ├─ Single solution per issue → auto-bind
   ├─ Multiple candidates → AskUserQuestion to select
   └─ Update issues.jsonl with bound_solution_id

Phase 4: Summary
   ├─ Display bound solutions
   ├─ Show task counts per issue
   └─ Display next steps (/issue:queue)
```

## Implementation

### Phase 1: Issue Loading (ID + Title + Tags)

```javascript
const batchSize = flags.batchSize || 3;
let issues = [];  // {id, title, tags}

if (flags.allPending) {
  // Get pending issues with metadata via CLI (JSON output)
  const result = Bash(`ccw issue list --status pending,registered --json`).trim();
  const parsed = result ? JSON.parse(result) : [];
  issues = parsed.map(i => ({ id: i.id, title: i.title || '', tags: i.tags || [] }));

  if (issues.length === 0) {
    console.log('No pending issues found.');
    return;
  }
  console.log(`Found ${issues.length} pending issues`);
} else {
  // Parse comma-separated issue IDs, fetch metadata
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

// Intelligent grouping by similarity (tags → title keywords)
function groupBySimilarity(issues, maxSize) {
  const batches = [];
  const used = new Set();

  for (const issue of issues) {
    if (used.has(issue.id)) continue;

    const batch = [issue];
    used.add(issue.id);
    const issueTags = new Set(issue.tags);
    const issueWords = new Set(issue.title.toLowerCase().split(/\s+/));

    // Find similar issues
    for (const other of issues) {
      if (used.has(other.id) || batch.length >= maxSize) continue;

      // Similarity: shared tags or shared title keywords
      const sharedTags = other.tags.filter(t => issueTags.has(t)).length;
      const otherWords = other.title.toLowerCase().split(/\s+/);
      const sharedWords = otherWords.filter(w => issueWords.has(w) && w.length > 3).length;

      if (sharedTags > 0 || sharedWords >= 2) {
        batch.push(other);
        used.add(other.id);
      }
    }
    batches.push(batch);
  }
  return batches;
}

const batches = groupBySimilarity(issues, batchSize);
console.log(`Processing ${issues.length} issues in ${batches.length} batch(es) (grouped by similarity)`);

TodoWrite({
  todos: batches.map((_, i) => ({
    content: `Plan batch ${i+1}`,
    status: 'pending',
    activeForm: `Planning batch ${i+1}`
  }))
});
```

### Phase 2: Unified Explore + Plan (issue-plan-agent) - PARALLEL

```javascript
Bash(`mkdir -p .workflow/issues/solutions`);
const pendingSelections = [];  // Collect multi-solution issues for user selection

// Build prompts for all batches
const agentTasks = batches.map((batch, batchIndex) => {
  const issueList = batch.map(i => `- ${i.id}: ${i.title}${i.tags.length ? ` [${i.tags.join(', ')}]` : ''}`).join('\n');
  const batchIds = batch.map(i => i.id);

  const issuePrompt = `
## Plan Issues

**Issues** (grouped by similarity):
${issueList}

**Project Root**: ${process.cwd()}

### Project Context (MANDATORY - Read Both Files First)
1. Read: .workflow/project-tech.json (technology stack, architecture, key components)
2. Read: .workflow/project-guidelines.json (user-defined constraints and conventions)

**CRITICAL**: All solution tasks MUST comply with constraints in project-guidelines.json

### Steps
1. Fetch: \`ccw issue status <id> --json\`
2. Load project context (project-tech.json + project-guidelines.json)
3. **If source=discovery**: Use discovery_context (file, line, snippet, suggested_fix) as planning hints
4. Explore (ACE) → Plan solution (respecting guidelines)
5. Register & bind: \`ccw issue bind <id> --solution <file>\`

### Generate Files
\`.workflow/issues/solutions/{issue-id}.jsonl\` - Solution with tasks (schema: cat .claude/workflows/cli-templates/schemas/solution-schema.json)

### Binding Rules
- **Single solution**: Auto-bind via \`ccw issue bind <id> --solution <file>\`
- **Multiple solutions**: Register only, return for user selection

### Return Summary
\`\`\`json
{
  "bound": [{ "issue_id": "...", "solution_id": "...", "task_count": N }],
  "pending_selection": [{ "issue_id": "...", "solutions": [{ "id": "...", "description": "...", "task_count": N }] }],
  "conflicts": [{ "file": "...", "issues": [...] }]
}
\`\`\`
`;

  return { batchIndex, batchIds, issuePrompt, batch };
});

// Launch agents in parallel (max 10 concurrent)
const MAX_PARALLEL = 10;
for (let i = 0; i < agentTasks.length; i += MAX_PARALLEL) {
  const chunk = agentTasks.slice(i, i + MAX_PARALLEL);
  const taskIds = [];

  // Launch chunk in parallel
  for (const { batchIndex, batchIds, issuePrompt, batch } of chunk) {
    updateTodo(`Plan batch ${batchIndex + 1}`, 'in_progress');
    const taskId = Task(
      subagent_type="issue-plan-agent",
      run_in_background=true,
      description=`Explore & plan ${batch.length} issues: ${batchIds.join(', ')}`,
      prompt=issuePrompt
    );
    taskIds.push({ taskId, batchIndex });
  }

  console.log(`Launched ${taskIds.length} agents (batch ${i/MAX_PARALLEL + 1}/${Math.ceil(agentTasks.length/MAX_PARALLEL)})...`);

  // Collect results from this chunk
  for (const { taskId, batchIndex } of taskIds) {
    const result = TaskOutput(task_id=taskId, block=true);
    const summary = JSON.parse(result);

    for (const item of summary.bound || []) {
      console.log(`✓ ${item.issue_id}: ${item.solution_id} (${item.task_count} tasks)`);
    }
    // Collect and notify pending selections
    for (const pending of summary.pending_selection || []) {
      console.log(`⏳ ${pending.issue_id}: ${pending.solutions.length} solutions → awaiting selection`);
      pendingSelections.push(pending);
    }
    if (summary.conflicts?.length > 0) {
      console.log(`⚠ Conflicts: ${summary.conflicts.map(c => c.file).join(', ')}`);
    }
    updateTodo(`Plan batch ${batchIndex + 1}`, 'completed');
  }
}
```

### Phase 3: Multi-Solution Selection (MANDATORY when pendingSelections > 0)

```javascript
// MUST trigger user selection when multiple solutions exist
if (pendingSelections.length > 0) {
  console.log(`\n## User Selection Required: ${pendingSelections.length} issue(s) have multiple solutions\n`);

  const answer = AskUserQuestion({
    questions: pendingSelections.map(({ issue_id, solutions }) => ({
      question: `Select solution for ${issue_id}:`,
      header: issue_id,
      multiSelect: false,
      options: solutions.map(s => ({
        label: `${s.id} (${s.task_count} tasks)`,
        description: s.description
      }))
    }))
  });

  // Bind user-selected solutions
  for (const { issue_id } of pendingSelections) {
    const selectedId = extractSelectedSolutionId(answer, issue_id);
    if (selectedId) {
      Bash(`ccw issue bind ${issue_id} ${selectedId}`);
      console.log(`✓ ${issue_id}: ${selectedId} bound`);
    }
  }
}
```

### Phase 4: Summary

```javascript
// Count planned issues via CLI
const plannedIds = Bash(`ccw issue list --status planned --ids`).trim();
const plannedCount = plannedIds ? plannedIds.split('\n').length : 0;

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

## Related Commands

- `/issue:queue` - Form execution queue from bound solutions
- `/issue:execute` - Execute queue with codex
- `ccw issue list` - List all issues
- `ccw issue status` - View issue and solution details
