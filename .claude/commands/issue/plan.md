---
name: plan
description: Batch plan issue resolution using issue-plan-agent (explore + plan closed-loop)
argument-hint: "<issue-id>[,<issue-id>,...] [--batch-size 3] --all-pending"
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

### Phase 1: Issue Loading (IDs Only)

```javascript
const batchSize = flags.batchSize || 3;
let issueIds = [];

if (flags.allPending) {
  // Get pending issue IDs directly via CLI
  const ids = Bash(`ccw issue list --status pending,registered --ids`).trim();
  issueIds = ids ? ids.split('\n').filter(Boolean) : [];

  if (issueIds.length === 0) {
    console.log('No pending issues found.');
    return;
  }
  console.log(`Found ${issueIds.length} pending issues`);
} else {
  // Parse comma-separated issue IDs
  issueIds = userInput.includes(',')
    ? userInput.split(',').map(s => s.trim())
    : [userInput.trim()];

  // Create if not exists
  for (const id of issueIds) {
    Bash(`ccw issue init ${id} --title "Issue ${id}" 2>/dev/null || true`);
  }
}

// Group into batches
const batches = [];
for (let i = 0; i < issueIds.length; i += batchSize) {
  batches.push(issueIds.slice(i, i + batchSize));
}

console.log(`Processing ${issueIds.length} issues in ${batches.length} batch(es)`);

TodoWrite({
  todos: batches.map((_, i) => ({
    content: `Plan batch ${i+1}`,
    status: 'pending',
    activeForm: `Planning batch ${i+1}`
  }))
});
```

### Phase 2: Unified Explore + Plan (issue-plan-agent)

```javascript
// Ensure solutions directory exists
Bash(`mkdir -p .workflow/issues/solutions`);

for (const [batchIndex, batch] of batches.entries()) {
  updateTodo(`Plan batch ${batchIndex + 1}`, 'in_progress');

  // Build issue prompt for agent - pass IDs only, agent fetches details
  const issuePrompt = `
## Issues to Plan (Closed-Loop Tasks Required)

**Issue IDs**: ${batch.join(', ')}

### Step 1: Fetch Issue Details
For each issue ID, use CLI to get full details:
\`\`\`bash
ccw issue status <issue-id> --json
\`\`\`

Returns:
\`\`\`json
{
  "issue": { "id", "title", "context", "affected_components", "lifecycle_requirements", ... },
  "solutions": [...],
  "bound": null
}
\`\`\`

## Project Root
${process.cwd()}

## Output Requirements

**IMPORTANT**: Register solutions via CLI, do NOT write files directly.

### 1. Register Solutions via CLI
For each issue, save solution to temp file and register via CLI:
\`\`\`bash
# Write solution JSON to temp file
echo '<solution-json>' > /tmp/sol-{issue-id}.json

# Register solution via CLI (generates SOL-xxx ID automatically)
ccw issue bind {issue-id} --solution /tmp/sol-{issue-id}.json
\`\`\`
- Solution must include all closed-loop task fields (see Solution Format below)

### 2. Return Summary Only
After registering solutions, return ONLY a brief JSON summary:
\`\`\`json
{
  "planned": [
    { "issue_id": "XXX", "solution_id": "SOL-xxx", "task_count": 3, "description": "Brief description" }
  ],
  "conflicts": [
    { "file": "path/to/file", "issues": ["ID1", "ID2"], "suggested_order": ["ID1", "ID2"] }
  ]
}
\`\`\`

## Closed-Loop Task Requirements

Each task MUST include ALL lifecycle phases:

### 1. Implementation
- implementation: string[] (2-7 concrete steps)
- modification_points: { file, target, change }[]

### 2. Test
- test.unit: string[] (unit test requirements)
- test.integration: string[] (integration test requirements if needed)
- test.commands: string[] (actual test commands to run)
- test.coverage_target: number (minimum coverage %)

### 3. Regression
- regression: string[] (commands to run for regression check)

### 4. Acceptance
- acceptance.criteria: string[] (testable acceptance criteria)
- acceptance.verification: string[] (how to verify each criterion)

### 5. Commit
- commit.type: feat|fix|refactor|test|docs|chore
- commit.scope: string (module name)
- commit.message_template: string (full commit message)
- commit.breaking: boolean

## Additional Requirements
1. Use ACE semantic search (mcp__ace-tool__search_context) for exploration
2. Detect file conflicts if multiple issues
3. Generate executable test commands based on project's test framework
4. Infer commit scope from affected files
`;

  // Launch issue-plan-agent - agent writes solutions directly
  const result = Task(
    subagent_type="issue-plan-agent",
    run_in_background=false,
    description=`Explore & plan ${batch.length} issues`,
    prompt=issuePrompt
  );

  // Parse brief summary from agent
  const summary = JSON.parse(result);

  // Display planning results
  for (const item of summary.planned || []) {
    console.log(`✓ ${item.issue_id}: ${item.solution_id} (${item.task_count} tasks) - ${item.description}`);
  }

  // Handle conflicts if any
  if (summary.conflicts?.length > 0) {
    console.log(`\n⚠ File conflicts detected:`);
    summary.conflicts.forEach(c => {
      console.log(`  ${c.file}: ${c.issues.join(', ')} → suggested: ${c.suggested_order.join(' → ')}`);
    });
  }

  updateTodo(`Plan batch ${batchIndex + 1}`, 'completed');
}
```

### Phase 3: Solution Binding

```javascript
// Collect issues needing user selection (multiple solutions)
const needSelection = [];

for (const issueId of issueIds) {
  // Get solutions via CLI
  const statusJson = Bash(`ccw issue status ${issueId} --json 2>/dev/null || echo '{}'`).trim();
  const status = JSON.parse(statusJson);
  const solutions = status.solutions || [];

  if (solutions.length === 0) continue; // No solutions - skip silently (agent already reported)

  if (solutions.length === 1) {
    // Auto-bind single solution
    bindSolution(issueId, solutions[0].id);
  } else {
    // Multiple solutions - collect for batch selection
    const options = solutions.map(s => ({
      id: s.id,
      description: s.description,
      task_count: (s.tasks || []).length
    }));
    needSelection.push({ issueId, options });
  }
}

// Batch ask user for multiple-solution issues
if (needSelection.length > 0) {
  const answer = AskUserQuestion({
    questions: needSelection.map(({ issueId, options }) => ({
      question: `Select solution for ${issueId}:`,
      header: issueId,
      multiSelect: false,
      options: options.map(s => ({
        label: `${s.id} (${s.task_count} tasks)`,
        description: s.description || 'Solution'
      }))
    }))
  });

  // Bind selected solutions
  for (const { issueId } of needSelection) {
    const selectedSolId = extractSelectedSolutionId(answer, issueId);
    if (selectedSolId) bindSolution(issueId, selectedSolId);
  }
}

// Helper: bind solution to issue (using CLI for safety)
function bindSolution(issueId, solutionId) {
  Bash(`ccw issue bind ${issueId} ${solutionId}`);
}
```

### Phase 4: Summary

```javascript
// Count planned issues via CLI
const plannedIds = Bash(`ccw issue list --status planned --ids`).trim();
const plannedCount = plannedIds ? plannedIds.split('\n').length : 0;

console.log(`
## Done: ${issueIds.length} issues → ${plannedCount} planned

Next: \`/issue:queue\` → \`/issue:execute\`
`);
```

## Solution Format (Closed-Loop Tasks)

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
        "Create auth.ts file in src/middleware/",
        "Implement JWT token validation using jsonwebtoken",
        "Add error handling for invalid/expired tokens",
        "Export middleware function"
      ],

      "test": {
        "unit": [
          "Test valid token passes through",
          "Test invalid token returns 401",
          "Test expired token returns 401",
          "Test missing token returns 401"
        ],
        "commands": [
          "npm test -- --grep 'auth middleware'",
          "npm run test:coverage -- src/middleware/auth.ts"
        ],
        "coverage_target": 80
      },

      "regression": [
        "npm test -- --grep 'protected routes'",
        "npm run test:integration -- auth"
      ],

      "acceptance": {
        "criteria": [
          "Middleware validates JWT tokens successfully",
          "Returns 401 for invalid or missing tokens",
          "Passes decoded token to request context"
        ],
        "verification": [
          "curl -H 'Authorization: Bearer valid_token' /api/protected → 200",
          "curl /api/protected → 401",
          "curl -H 'Authorization: Bearer invalid' /api/protected → 401"
        ]
      },

      "commit": {
        "type": "feat",
        "scope": "auth",
        "message_template": "feat(auth): add JWT validation middleware\n\n- Implement token validation\n- Add error handling for invalid tokens\n- Export for route protection",
        "breaking": false
      },

      "depends_on": [],
      "estimated_minutes": 30,
      "executor": "codex"
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
