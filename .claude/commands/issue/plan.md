---
name: plan
description: Plan issue resolution with JSONL task generation, delivery/pause criteria, and dependency graph
argument-hint: "\"issue description\"|github-url|file.md"
allowed-tools: TodoWrite(*), Task(*), SlashCommand(*), AskUserQuestion(*), Bash(*), Read(*), Write(*)
---

# Issue Plan Command (/issue:plan)

## Overview

Generate a JSONL-based task plan from a GitHub issue or description. Each task includes delivery criteria, pause criteria, and dependency relationships. The plan is designed for progressive execution with the `/issue:execute` command.

**Core capabilities:**
- Parse issue from URL, text description, or markdown file
- Analyze codebase context for accurate task breakdown
- Generate JSONL task file with DAG (Directed Acyclic Graph) dependencies
- Define clear delivery criteria (what marks a task complete)
- Define pause criteria (conditions to halt execution)
- Interactive confirmation before finalizing

## Usage

```bash
/issue:plan [FLAGS] <INPUT>

# Input Formats
<issue-url>           GitHub issue URL (e.g., https://github.com/owner/repo/issues/123)
<description>         Text description of the issue
<file.md>             Markdown file with issue details

# Flags
-e, --explore         Force code exploration phase
--executor <type>     Default executor: agent|codex|gemini|auto (default: auto)
```

## Execution Process

```
Phase 1: Input Parsing & Context
   ├─ Parse input (URL → fetch issue, text → use directly, file → read content)
   ├─ Extract: title, description, labels, acceptance criteria
   └─ Store as issueContext

Phase 2: Exploration (if needed)
   ├─ Complexity assessment (Low/Medium/High)
   ├─ Launch cli-explore-agent for codebase understanding
   └─ Identify: relevant files, patterns, integration points

Phase 3: Task Breakdown
   ├─ Agent generates JSONL task list
   ├─ Each task includes:
   │   ├─ delivery_criteria (completion checklist)
   │   ├─ pause_criteria (halt conditions)
   │   └─ depends_on (dependency graph)
   └─ Validate DAG (no circular dependencies)

Phase 4: User Confirmation
   ├─ Display task summary table
   ├─ Show dependency graph
   └─ AskUserQuestion: Approve / Refine / Cancel

Phase 5: Persistence
   ├─ Write tasks.jsonl to .workflow/issues/{issue-id}/
   ├─ Initialize state.json for status tracking
   └─ Return summary and next steps
```

## Implementation

### Phase 1: Input Parsing

```javascript
// Helper: Get UTC+8 ISO string
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

// Parse input type
function parseInput(input) {
  if (input.startsWith('https://github.com/')) {
    const match = input.match(/github\.com\/(.+?)\/(.+?)\/issues\/(\d+)/)
    if (match) {
      return { type: 'github', owner: match[1], repo: match[2], number: match[3] }
    }
  }
  if (input.endsWith('.md') && fileExists(input)) {
    return { type: 'file', path: input }
  }
  return { type: 'text', content: input }
}

// Generate issue ID
const inputType = parseInput(userInput)
let issueId, issueTitle, issueContent

if (inputType.type === 'github') {
  // Fetch via gh CLI
  const issueData = Bash(`gh issue view ${inputType.number} --repo ${inputType.owner}/${inputType.repo} --json title,body,labels`)
  const parsed = JSON.parse(issueData)
  issueId = `GH-${inputType.number}`
  issueTitle = parsed.title
  issueContent = parsed.body
} else if (inputType.type === 'file') {
  issueContent = Read(inputType.path)
  issueId = `FILE-${Date.now()}`
  issueTitle = extractTitle(issueContent) // First # heading
} else {
  issueContent = inputType.content
  issueId = `TEXT-${Date.now()}`
  issueTitle = issueContent.substring(0, 50)
}

// Create issue directory
const issueDir = `.workflow/issues/${issueId}`
Bash(`mkdir -p ${issueDir}`)

// Save issue context
Write(`${issueDir}/context.md`, `# ${issueTitle}\n\n${issueContent}`)
```

### Phase 2: Exploration

```javascript
// Complexity assessment
const complexity = analyzeComplexity(issueContent)
// Low: Single file change, isolated
// Medium: Multiple files, some dependencies
// High: Cross-module, architectural

const needsExploration = (
  flags.includes('--explore') ||
  complexity !== 'Low' ||
  issueContent.mentions_specific_files
)

if (needsExploration) {
  Task(
    subagent_type="cli-explore-agent",
    run_in_background=false,
    description="Explore codebase for issue context",
    prompt=`
## Task Objective
Analyze codebase to understand context for issue resolution.

## Issue Context
Title: ${issueTitle}
Content: ${issueContent}

## Required Analysis
1. Identify files that need modification
2. Find relevant patterns and conventions
3. Map dependencies and integration points
4. Identify potential risks or blockers

## Output
Write exploration results to: ${issueDir}/exploration.json
`
  )
}
```

### Phase 3: Task Breakdown

```javascript
// Load schema reference
const schema = Read('~/.claude/workflows/cli-templates/schemas/issue-task-jsonl-schema.json')

// Generate tasks via CLI
Task(
  subagent_type="cli-lite-planning-agent",
  run_in_background=false,
  description="Generate JSONL task breakdown",
  prompt=`
## Objective
Break down the issue into executable tasks in JSONL format.

## Issue Context
ID: ${issueId}
Title: ${issueTitle}
Content: ${issueContent}

## Exploration Results
${explorationResults || 'No exploration performed'}

## Task Schema
${schema}

## Requirements
1. Generate 2-10 tasks depending on complexity
2. Each task MUST include:
   - delivery_criteria: Specific, verifiable conditions for completion (2-5 items)
   - pause_criteria: Conditions that should halt execution (0-3 items)
   - depends_on: Task IDs that must complete first (ensure DAG)
3. Task execution phases: analyze → implement → test → optimize → commit
4. Assign executor based on task nature (analysis=gemini, implementation=codex)

## Delivery Criteria Examples
Good: "User login endpoint returns JWT token with 24h expiry"
Bad: "Authentication works" (too vague)

## Pause Criteria Examples
- "API spec for external service unclear"
- "Database schema migration required"
- "Security review needed before implementation"

## Output Format
Write JSONL file (one JSON object per line):
${issueDir}/tasks.jsonl

## Validation
- Ensure no circular dependencies
- Ensure all depends_on references exist
- Ensure at least one task has empty depends_on (entry point)
`
)

// Validate DAG
const tasks = readJsonl(`${issueDir}/tasks.jsonl`)
validateDAG(tasks) // Throws if circular dependency detected
```

### Phase 4: User Confirmation

```javascript
// Display task summary
const tasks = readJsonl(`${issueDir}/tasks.jsonl`)

console.log(`
## Issue Plan: ${issueId}

**Title**: ${issueTitle}
**Tasks**: ${tasks.length}
**Complexity**: ${complexity}

### Task Breakdown

| ID | Title | Type | Dependencies | Delivery Criteria |
|----|-------|------|--------------|-------------------|
${tasks.map(t => `| ${t.id} | ${t.title} | ${t.type} | ${t.depends_on.join(', ') || '-'} | ${t.delivery_criteria.length} items |`).join('\n')}

### Dependency Graph
${generateDependencyGraph(tasks)}
`)

// User confirmation
AskUserQuestion({
  questions: [
    {
      question: `Approve issue plan? (${tasks.length} tasks)`,
      header: "Confirm",
      multiSelect: false,
      options: [
        { label: "Approve", description: "Proceed with this plan" },
        { label: "Refine", description: "Modify tasks before proceeding" },
        { label: "Cancel", description: "Discard plan" }
      ]
    }
  ]
})

if (answer === "Refine") {
  // Allow editing specific tasks
  AskUserQuestion({
    questions: [
      {
        question: "What would you like to refine?",
        header: "Refine",
        multiSelect: true,
        options: [
          { label: "Add Task", description: "Add a new task" },
          { label: "Remove Task", description: "Remove an existing task" },
          { label: "Modify Dependencies", description: "Change task dependencies" },
          { label: "Regenerate", description: "Regenerate entire plan" }
        ]
      }
    ]
  })
}
```

### Phase 5: Persistence

```javascript
// Initialize state.json for status tracking
const state = {
  issue_id: issueId,
  title: issueTitle,
  status: 'planned',
  created_at: getUtc8ISOString(),
  updated_at: getUtc8ISOString(),
  task_count: tasks.length,
  completed_count: 0,
  current_task: null,
  executor_default: flags.executor || 'auto'
}

Write(`${issueDir}/state.json`, JSON.stringify(state, null, 2))

console.log(`
## Plan Created

**Issue**: ${issueId}
**Location**: ${issueDir}/
**Tasks**: ${tasks.length}

### Files Created
- tasks.jsonl (task definitions)
- state.json (execution state)
- context.md (issue context)
${explorationResults ? '- exploration.json (codebase analysis)' : ''}

### Next Steps
1. Review: \`ccw issue list ${issueId}\`
2. Execute: \`/issue:execute ${issueId}\`
3. Monitor: \`ccw issue status ${issueId}\`
`)
```

## JSONL Task Format

Each line in `tasks.jsonl` is a complete JSON object:

```json
{"id":"TASK-001","title":"Setup auth middleware","type":"feature","description":"Implement JWT verification middleware","file_context":["src/middleware/","src/config/auth.ts"],"depends_on":[],"delivery_criteria":["Middleware validates JWT tokens","Returns 401 for invalid tokens","Passes existing auth tests"],"pause_criteria":["JWT secret configuration unclear"],"status":"pending","current_phase":"analyze","executor":"auto","priority":1,"created_at":"2025-12-26T10:00:00Z","updated_at":"2025-12-26T10:00:00Z"}
{"id":"TASK-002","title":"Protect API routes","type":"feature","description":"Apply auth middleware to /api/v1/* routes","file_context":["src/routes/api/"],"depends_on":["TASK-001"],"delivery_criteria":["All /api/v1/* routes require auth","Public routes excluded","Integration tests pass"],"pause_criteria":[],"status":"pending","current_phase":"analyze","executor":"auto","priority":2,"created_at":"2025-12-26T10:00:00Z","updated_at":"2025-12-26T10:00:00Z"}
```

## Progressive Loading Algorithm

For large task lists, only load tasks with satisfied dependencies:

```javascript
function getReadyTasks(tasks, completedIds) {
  return tasks.filter(task =>
    task.status === 'pending' &&
    task.depends_on.every(dep => completedIds.has(dep))
  )
}

// Stream JSONL line-by-line for memory efficiency
function* streamJsonl(filePath) {
  const lines = readLines(filePath)
  for (const line of lines) {
    if (line.trim()) yield JSON.parse(line)
  }
}
```

## Error Handling

| Error | Resolution |
|-------|------------|
| Invalid GitHub URL | Display correct format, ask for valid URL |
| Circular dependency | List cycle, ask user to resolve |
| No tasks generated | Suggest simpler breakdown or manual entry |
| Exploration timeout | Proceed without exploration, warn user |

## Related Commands

- `/issue:execute` - Execute planned tasks with closed-loop methodology
- `ccw issue list` - List all issues and their status
- `ccw issue status` - Show detailed issue status
