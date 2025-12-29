---
name: plan
description: Batch plan issue resolution using issue-plan-agent (explore + plan closed-loop)
argument-hint: "--all-pending <issue-id>[,<issue-id>,...] [--batch-size 3] "
allowed-tools: TodoWrite(*), Task(*), SlashCommand(*), AskUserQuestion(*), Bash(*), Read(*), Write(*)
---

# Issue Plan Command (/issue:plan)

## Overview

Unified planning command using **issue-plan-agent** that combines exploration and planning into a single closed-loop workflow.

## Command Output

```json
{
  "bound": [{ "issue_id": "...", "solution_id": "...", "task_count": N }],
  "pending_selection": [{ "issue_id": "...", "solutions": [...] }],
  "conflicts": [{ "type": "...", "summary": "..." }]
}
```

**Behavior:**
- Single solution per issue → auto-bind
- Multiple solutions → return for user selection
- Agent handles file generation (see `issue-plan-agent.md`)

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

// Semantic grouping via Gemini CLI (max 6 issues per group)
async function groupBySimilarityGemini(issues) {
  const issueSummaries = issues.map(i => ({
    id: i.id, title: i.title, tags: i.tags
  }));

  const prompt = `
PURPOSE: Group similar issues by semantic similarity for batch processing; maximize within-group coherence; max 6 issues per group
TASK: • Analyze issue titles/tags semantically • Identify functional/architectural clusters • Assign each issue to one group
MODE: analysis
CONTEXT: Issue metadata only
EXPECTED: JSON with groups array, each containing max 6 issue_ids, theme, rationale
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) | Each issue in exactly one group | Max 6 issues per group | Balance group sizes

INPUT:
${JSON.stringify(issueSummaries, null, 2)}

OUTPUT FORMAT:
{"groups":[{"group_id":1,"theme":"...","issue_ids":["..."],"rationale":"..."}],"ungrouped":[]}
`;

  const taskId = Bash({
    command: `ccw cli -p "${prompt}" --tool gemini --mode analysis`,
    run_in_background: true, timeout: 600000
  });
  const output = TaskOutput({ task_id: taskId, block: true });

  // Extract JSON from potential markdown code blocks
  function extractJsonFromMarkdown(text) {
    const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/) ||
                      text.match(/```\s*\n([\s\S]*?)\n```/);
    return jsonMatch ? jsonMatch[1] : text;
  }

  const result = JSON.parse(extractJsonFromMarkdown(output));
  return result.groups.map(g => g.issue_ids.map(id => issues.find(i => i.id === id)));
}

const batches = await groupBySimilarityGemini(issues);
console.log(`Processing ${issues.length} issues in ${batches.length} batch(es) (Gemini semantic grouping, max 6 issues/agent)`);

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
const agentResults = [];       // Collect all agent results for conflict aggregation

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
3. **If extended_context exists**: Use extended_context (location, suggested_fix, notes) as planning hints
4. Explore (ACE) → Plan solution (respecting guidelines)
5. Register & bind: \`ccw issue bind <id> --solution <file>\`

### Generate Files
\`.workflow/issues/solutions/{issue-id}.jsonl\` - Solution with tasks (schema: cat .claude/workflows/cli-templates/schemas/solution-schema.json)

**Solution ID Format**: \`SOL-{issue-id}-{seq}\` (e.g., \`SOL-GH-123-1\`, \`SOL-ISS-20251229-1\`)

### Binding Rules
- **Single solution**: Auto-bind via \`ccw issue bind <id> --solution <file>\`
- **Multiple solutions**: Register only, return for user selection

### Return Summary
\`\`\`json
{
  "bound": [{ "issue_id": "...", "solution_id": "...", "task_count": N }],
  "pending_selection": [{ "issue_id": "...", "solutions": [{ "id": "...", "description": "...", "task_count": N }] }],
  "conflicts": [{
    "type": "file_conflict|api_conflict|data_conflict|dependency_conflict|architecture_conflict",
    "severity": "high|medium|low",
    "summary": "brief description",
    "recommended_resolution": "auto-resolution for low/medium",
    "resolution_options": [{ "strategy": "...", "rationale": "..." }]
  }]
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

    // Extract JSON from potential markdown code blocks (agent may wrap in ```json...```)
    const jsonText = extractJsonFromMarkdown(result);
    let summary;
    try {
      summary = JSON.parse(jsonText);
    } catch (e) {
      console.log(`⚠ Batch ${batchIndex + 1}: Failed to parse agent result, skipping`);
      updateTodo(`Plan batch ${batchIndex + 1}`, 'completed');
      continue;
    }
    agentResults.push(summary);  // Store for Phase 3 conflict aggregation

    for (const item of summary.bound || []) {
      console.log(`✓ ${item.issue_id}: ${item.solution_id} (${item.task_count} tasks)`);
    }
    // Collect and notify pending selections
    for (const pending of summary.pending_selection || []) {
      console.log(`⏳ ${pending.issue_id}: ${pending.solutions.length} solutions → awaiting selection`);
      pendingSelections.push(pending);
    }
    if (summary.conflicts?.length > 0) {
      console.log(`⚠ Conflicts: ${summary.conflicts.length} detected (will resolve in Phase 3)`);
    }
    updateTodo(`Plan batch ${batchIndex + 1}`, 'completed');
  }
}
```

### Phase 3: Conflict Resolution & Solution Selection

```javascript
// Helper: Extract selected solution ID from AskUserQuestion answer
function extractSelectedSolutionId(answer, issueId) {
  // answer format: { [header]: selectedLabel } or { answers: { [question]: label } }
  const key = Object.keys(answer).find(k => k.includes(issueId));
  if (!key) return null;
  const selected = answer[key];
  // Label format: "SOL-xxx (N tasks)" - extract solution ID
  const match = selected.match(/^(SOL-[^\s]+)/);
  return match ? match[1] : null;
}

// Phase 3a: Aggregate and resolve conflicts from all agents
const allConflicts = [];
for (const result of agentResults) {
  if (result.conflicts?.length > 0) {
    allConflicts.push(...result.conflicts);
  }
}

if (allConflicts.length > 0) {
  console.log(`\n## Resolving ${allConflicts.length} conflict(s) detected by agents\n`);

  // ALWAYS confirm high-severity conflicts (per user preference)
  const highSeverity = allConflicts.filter(c => c.severity === 'high');
  const lowMedium = allConflicts.filter(c => c.severity !== 'high');

  // Auto-resolve low/medium severity
  for (const conflict of lowMedium) {
    console.log(`  Auto-resolved: ${conflict.summary} → ${conflict.recommended_resolution}`);
  }

  // ALWAYS require user confirmation for high severity
  if (highSeverity.length > 0) {
    const conflictAnswer = AskUserQuestion({
      questions: highSeverity.slice(0, 4).map(conflict => ({
        question: `${conflict.type}: ${conflict.summary}. How to resolve?`,
        header: conflict.type.replace('_conflict', ''),
        multiSelect: false,
        options: conflict.resolution_options.map(opt => ({
          label: opt.strategy,
          description: opt.rationale
        }))
      }))
    });
    // Apply user-selected resolutions
    console.log('Applied user-selected conflict resolutions');
  }
}

// Phase 3b: Multi-Solution Selection (MANDATORY when pendingSelections > 0)
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

  // Bind user-selected solutions (with file validation)
  for (const { issue_id, solutions } of pendingSelections) {
    const selectedId = extractSelectedSolutionId(answer, issue_id);
    if (selectedId) {
      // Verify solution file exists and contains the selected ID
      const solPath = `.workflow/issues/solutions/${issue_id}.jsonl`;
      const fileExists = Bash(`test -f "${solPath}" && echo "yes" || echo "no"`).trim() === 'yes';

      if (!fileExists) {
        console.log(`⚠ ${issue_id}: Solution file missing, attempting recovery...`);
        // Recovery: write solution from pending_selection payload
        const selectedSol = solutions.find(s => s.id === selectedId);
        if (selectedSol) {
          Bash(`mkdir -p .workflow/issues/solutions`);
          const solJson = JSON.stringify({ id: selectedId, ...selectedSol, is_bound: false, created_at: new Date().toISOString() });
          Bash(`echo '${solJson}' >> "${solPath}"`);
          console.log(`  Recovered ${selectedId} to ${solPath}`);
        }
      }

      // Now bind
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
