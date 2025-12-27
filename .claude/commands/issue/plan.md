---
name: plan
description: Batch plan issue resolution using issue-plan-agent (explore + plan closed-loop)
argument-hint: "<issue-id>[,<issue-id>,...] [--batch-size 3]"
allowed-tools: TodoWrite(*), Task(*), SlashCommand(*), AskUserQuestion(*), Bash(*), Read(*), Write(*)
---

# Issue Plan Command (/issue:plan)

## Overview

Unified planning command using **issue-plan-agent** that combines exploration and planning into a single closed-loop workflow. The agent handles ACE semantic search, solution generation, and task breakdown.

**Core capabilities:**
- **Closed-loop agent**: issue-plan-agent combines explore + plan
- Batch processing: 1 agent processes 1-3 issues
- ACE semantic search integrated into planning
- Solution with executable tasks and acceptance criteria
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
   ├─ Load issues from .workflow/issues/issues.jsonl
   ├─ Validate issues exist (create if needed)
   └─ Group into batches (max 3 per batch)

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

### Phase 1: Issue Loading

```javascript
// Parse input
const issueIds = userInput.includes(',')
  ? userInput.split(',').map(s => s.trim())
  : [userInput.trim()];

// Read issues.jsonl
const issuesPath = '.workflow/issues/issues.jsonl';
const allIssues = Bash(`cat "${issuesPath}" 2>/dev/null || echo ''`)
  .split('\n')
  .filter(line => line.trim())
  .map(line => JSON.parse(line));

// Load and validate issues
const issues = [];
for (const id of issueIds) {
  let issue = allIssues.find(i => i.id === id);

  if (!issue) {
    console.log(`Issue ${id} not found. Creating...`);
    issue = {
      id,
      title: `Issue ${id}`,
      status: 'registered',
      priority: 3,
      context: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    // Append to issues.jsonl
    Bash(`echo '${JSON.stringify(issue)}' >> "${issuesPath}"`);
  }

  issues.push(issue);
}

// Group into batches
const batchSize = flags.batchSize || 3;
const batches = [];
for (let i = 0; i < issues.length; i += batchSize) {
  batches.push(issues.slice(i, i + batchSize));
}

TodoWrite({
  todos: batches.flatMap((batch, i) => [
    { content: `Plan batch ${i+1}`, status: 'pending', activeForm: `Planning batch ${i+1}` }
  ])
});
```

### Phase 2: Unified Explore + Plan (issue-plan-agent)

```javascript
for (const [batchIndex, batch] of batches.entries()) {
  updateTodo(`Plan batch ${batchIndex + 1}`, 'in_progress');

  // Build issue prompt for agent
  const issuePrompt = `
## Issues to Plan

${batch.map((issue, i) => `
### Issue ${i + 1}: ${issue.id}
**Title**: ${issue.title}
**Context**: ${issue.context || 'No context provided'}
`).join('\n')}

## Project Root
${process.cwd()}

## Requirements
1. Use ACE semantic search (mcp__ace-tool__search_context) for exploration
2. Generate complete solution with task breakdown
3. Each task must have:
   - implementation steps (2-7 steps)
   - acceptance criteria (1-4 testable criteria)
   - modification_points (exact file locations)
   - depends_on (task dependencies)
4. Detect file conflicts if multiple issues
`;

  // Launch issue-plan-agent (combines explore + plan)
  const result = Task(
    subagent_type="issue-plan-agent",
    run_in_background=false,
    description=`Explore & plan ${batch.length} issues`,
    prompt=issuePrompt
  );

  // Parse agent output
  const agentOutput = JSON.parse(result);

  // Register solutions for each issue (append to solutions/{issue-id}.jsonl)
  for (const item of agentOutput.solutions) {
    const solutionPath = `.workflow/issues/solutions/${item.issue_id}.jsonl`;

    // Ensure solutions directory exists
    Bash(`mkdir -p .workflow/issues/solutions`);

    // Append solution as new line
    Bash(`echo '${JSON.stringify(item.solution)}' >> "${solutionPath}"`);
  }

  // Handle conflicts if any
  if (agentOutput.conflicts?.length > 0) {
    console.log(`\n⚠ File conflicts detected:`);
    agentOutput.conflicts.forEach(c => {
      console.log(`  ${c.file}: ${c.issues.join(', ')} → suggested: ${c.suggested_order.join(' → ')}`);
    });
  }

  updateTodo(`Plan batch ${batchIndex + 1}`, 'completed');
}
```

### Phase 3: Solution Binding

```javascript
// Re-read issues.jsonl
let allIssuesUpdated = Bash(`cat "${issuesPath}"`)
  .split('\n')
  .filter(line => line.trim())
  .map(line => JSON.parse(line));

for (const issue of issues) {
  const solPath = `.workflow/issues/solutions/${issue.id}.jsonl`;
  const solutions = Bash(`cat "${solPath}" 2>/dev/null || echo ''`)
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));

  if (solutions.length === 0) {
    console.log(`⚠ No solutions for ${issue.id}`);
    continue;
  }

  let selectedSolId;

  if (solutions.length === 1) {
    // Auto-bind single solution
    selectedSolId = solutions[0].id;
    console.log(`✓ Auto-bound ${selectedSolId} to ${issue.id} (${solutions[0].tasks?.length || 0} tasks)`);
  } else {
    // Multiple solutions - ask user
    const answer = AskUserQuestion({
      questions: [{
        question: `Select solution for ${issue.id}:`,
        header: issue.id,
        multiSelect: false,
        options: solutions.map(s => ({
          label: `${s.id}: ${s.description || 'Solution'}`,
          description: `${s.tasks?.length || 0} tasks`
        }))
      }]
    });

    selectedSolId = extractSelectedSolutionId(answer);
    console.log(`✓ Bound ${selectedSolId} to ${issue.id}`);
  }

  // Update issue in allIssuesUpdated
  const issueIndex = allIssuesUpdated.findIndex(i => i.id === issue.id);
  if (issueIndex !== -1) {
    allIssuesUpdated[issueIndex].bound_solution_id = selectedSolId;
    allIssuesUpdated[issueIndex].status = 'planned';
    allIssuesUpdated[issueIndex].planned_at = new Date().toISOString();
    allIssuesUpdated[issueIndex].updated_at = new Date().toISOString();
  }

  // Mark solution as bound in solutions file
  const updatedSolutions = solutions.map(s => ({
    ...s,
    is_bound: s.id === selectedSolId,
    bound_at: s.id === selectedSolId ? new Date().toISOString() : s.bound_at
  }));
  Write(solPath, updatedSolutions.map(s => JSON.stringify(s)).join('\n'));
}

// Write updated issues.jsonl
Write(issuesPath, allIssuesUpdated.map(i => JSON.stringify(i)).join('\n'));
```

### Phase 4: Summary

```javascript
console.log(`
## Planning Complete

**Issues Planned**: ${issues.length}

### Bound Solutions
${issues.map(i => {
  const issue = allIssuesUpdated.find(a => a.id === i.id);
  return issue?.bound_solution_id
    ? `✓ ${i.id}: ${issue.bound_solution_id}`
    : `○ ${i.id}: No solution bound`;
}).join('\n')}

### Next Steps
1. Review: \`ccw issue status <issue-id>\`
2. Form queue: \`/issue:queue\`
3. Execute: \`/issue:execute\`
`);
```

## Solution Format

Each solution line in `solutions/{issue-id}.jsonl`:

```json
{
  "id": "SOL-20251226-001",
  "description": "Direct Implementation",
  "tasks": [
    {
      "id": "T1",
      "title": "Create auth middleware",
      "scope": "src/middleware/",
      "action": "Create",
      "description": "Create JWT validation middleware",
      "modification_points": [
        { "file": "src/middleware/auth.ts", "target": "new file", "change": "Create middleware" }
      ],
      "implementation": [
        "Create auth.ts file",
        "Implement JWT validation",
        "Add error handling",
        "Export middleware"
      ],
      "acceptance": [
        "Middleware validates JWT tokens",
        "Returns 401 for invalid tokens"
      ],
      "depends_on": [],
      "estimated_minutes": 30
    }
  ],
  "exploration_context": {
    "relevant_files": ["src/config/auth.ts"],
    "patterns": "Follow existing middleware pattern"
  },
  "is_bound": true,
  "created_at": "2025-12-26T10:00:00Z",
  "bound_at": "2025-12-26T10:05:00Z"
}
```

## Error Handling

| Error | Resolution |
|-------|------------|
| Issue not found | Auto-create in issues.jsonl |
| ACE search fails | Agent falls back to ripgrep |
| No solutions generated | Display error, suggest manual planning |
| User cancels selection | Skip issue, continue with others |
| File conflicts | Agent detects and suggests resolution order |

## Agent Integration

The command uses `issue-plan-agent` which:
1. Performs ACE semantic search per issue
2. Identifies modification points and patterns
3. Generates task breakdown with dependencies
4. Detects cross-issue file conflicts
5. Outputs solution JSON for registration

See `.claude/agents/issue-plan-agent.md` for agent specification.

## Related Commands

- `/issue:queue` - Form execution queue from bound solutions
- `/issue:execute` - Execute queue with codex
- `ccw issue list` - List all issues
- `ccw issue status` - View issue and solution details
