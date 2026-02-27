---
name: csv-batch-execute
description: CSV-based batch task execution with shared context propagation. Decomposes requirement into CSV tasks, executes via spawn_agents_on_csv with context sharing between agents.
argument-hint: "[-y|--yes] [-c|--concurrency N] \"requirement description\""
allowed-tools: spawn_agents_on_csv, Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

## Auto Mode

When `--yes` or `-y`: Auto-confirm task decomposition, skip interactive validation.

# CSV Batch Execute Skill

## Usage

```bash
$csv-batch-execute "Implement user authentication with OAuth, JWT, and 2FA"
$csv-batch-execute -c 4 "Refactor payment module with Stripe and PayPal"
$csv-batch-execute -y "Build notification system with email and SMS"
$csv-batch-execute --continue "auth-20260227"
```

**Flags**:
- `-y, --yes`: Skip all confirmations (auto mode)
- `-c, --concurrency N`: Max concurrent agents (default: 4)
- `--continue`: Resume existing session

**Context Source**: Requirement decomposition + shared execution context
**Output Directory**: `.workflow/.csv-batch/{session-id}/`
**Core Output**: `tasks.csv` (task definitions) + `results.csv` (execution results) + `context.md` (shared exploration)

---

## Overview

Batch task execution using CSV-based agent spawning with **context propagation**. Each agent reads previous agents' exploration and execution records from updated CSV.

**Core workflow**: Decompose → Generate CSV → Execute Batch → Aggregate Results

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CSV BATCH EXECUTION WORKFLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Phase 1: Requirement Decomposition                                      │
│     ├─ Parse requirement into subtasks                                   │
│     ├─ Identify dependencies and execution order                         │
│     ├─ Generate tasks.csv with columns: id, title, description, deps    │
│     └─ User validates task breakdown (skip if -y)                        │
│                                                                          │
│  Phase 2: CSV Batch Execution                                            │
│     ├─ Call spawn_agents_on_csv with tasks.csv                           │
│     ├─ Each agent:                                                       │
│     │   ├─ Reads current CSV (includes previous agents' results)         │
│     │   ├─ Executes assigned task                                        │
│     │   ├─ Updates CSV with: status, findings, files_modified            │
│     │   └─ Returns JSON result via report_agent_job_result               │
│     ├─ Context propagation: Agent N sees Agent N-1's updates             │
│     └─ Export to results.csv when all complete                           │
│                                                                          │
│  Phase 3: Results Aggregation                                            │
│     ├─ Read results.csv                                                  │
│     ├─ Generate context.md with all findings                             │
│     ├─ Display summary: completed/failed/total                           │
│     └─ Offer: view results | retry failed | done                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## CSV Schema

### tasks.csv (Input)

```csv
id,title,description,deps,context_from
1,Setup auth module,Create auth directory structure and base files,,
2,Implement OAuth,Add OAuth provider integration with Google and GitHub,1,1
3,Add JWT tokens,Implement JWT generation and validation,1,1
4,Setup 2FA,Add TOTP-based 2FA with QR code generation,2;3,1;2;3
```

**Columns**:
- `id`: Unique task identifier (string)
- `title`: Short task title
- `description`: Detailed task description
- `deps`: Semicolon-separated dependency IDs (empty if no deps)
- `context_from`: Semicolon-separated task IDs to read context from (empty if none)

### results.csv (Output)

```csv
id,title,status,findings,files_modified,execution_time,error
1,Setup auth module,completed,Created auth/ with index.ts and types.ts,auth/index.ts;auth/types.ts,45s,
2,Implement OAuth,completed,Integrated Google OAuth with passport.js,auth/oauth.ts;auth/providers/google.ts,120s,
3,Add JWT tokens,failed,Missing jsonwebtoken dependency,,30s,Module not found: jsonwebtoken
4,Setup 2FA,pending,Waiting for task 3 completion,,,
```

**Columns**:
- `id`: Task ID (from input)
- `title`: Task title (from input)
- `status`: `completed` | `failed` | `pending`
- `findings`: Key discoveries or implementation notes
- `files_modified`: Semicolon-separated file paths
- `execution_time`: Duration in seconds
- `error`: Error message if failed (empty if success)

---

## Implementation

### Session Initialization

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

// Parse flags
const AUTO_YES = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')
const continueMode = $ARGUMENTS.includes('--continue') || $ARGUMENTS.includes('-c')
const concurrencyMatch = $ARGUMENTS.match(/(?:--concurrency|-c)\s+(\d+)/)
const maxConcurrency = concurrencyMatch ? parseInt(concurrencyMatch[1]) : 4

// Clean requirement text
const requirement = $ARGUMENTS
  .replace(/--yes|-y|--continue|--concurrency\s+\d+|-c\s+\d+/g, '')
  .trim()

const slug = requirement.toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
  .substring(0, 40)
const dateStr = getUtc8ISOString().substring(0, 10).replace(/-/g, '')
const sessionId = `csv-${slug}-${dateStr}`
const sessionFolder = `.workflow/.csv-batch/${sessionId}`

// Check for existing session
if (continueMode) {
  const existingSessions = Bash(`ls -t .workflow/.csv-batch/ | grep "^csv-" | head -1`).trim()
  if (existingSessions) {
    sessionId = existingSessions
    sessionFolder = `.workflow/.csv-batch/${sessionId}`
  }
}

Bash(`mkdir -p ${sessionFolder}`)
```

---

### Phase 1: Requirement Decomposition

**Objective**: Break requirement into CSV tasks with dependencies.

**Steps**:

1. **Analyze Requirement**
   ```javascript
   // Use CLI tool for decomposition
   const decompositionPrompt = `
PURPOSE: Decompose requirement into sequential tasks for CSV batch execution
TASK:
  • Parse requirement into 3-10 subtasks
  • Identify task dependencies (which tasks must complete before others)
  • Determine context sharing (which tasks need previous tasks' findings)
  • Estimate execution order based on dependencies
MODE: analysis
CONTEXT: @**/* | Memory: CSV batch execution, each task is independent agent
EXPECTED: JSON with tasks array, each task has: id, title, description, deps[], context_from[]
CONSTRAINTS: Tasks must be atomic and executable by single agent | Max 10 tasks
`

   Bash({
     command: `ccw cli -p '${decompositionPrompt.replace(/'/g, "'\\''")}' --tool gemini --mode analysis --rule planning-breakdown-task-steps`,
     run_in_background: true
   })

   // Wait for CLI completion (hook callback)
   // ... extract JSON from CLI output ...
   ```

2. **Generate tasks.csv**
   ```javascript
   const tasksData = [
     ['id', 'title', 'description', 'deps', 'context_from'],
     ...decomposedTasks.map(task => [
       task.id,
       task.title,
       task.description,
       task.deps.join(';'),
       task.context_from.join(';')
     ])
   ]

   const csvContent = tasksData.map(row =>
     row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
   ).join('\n')

   Write(`${sessionFolder}/tasks.csv`, csvContent)
   ```

3. **User Validation** (skip if AUTO_YES)
   ```javascript
   if (!AUTO_YES) {
     console.log(`\n## Task Breakdown\n`)
     console.log(`Total tasks: ${decomposedTasks.length}`)
     console.log(`\n${csvContent}\n`)

     const answer = AskUserQuestion({
       questions: [{
         question: "Approve task breakdown?",
         header: "Validation",
         multiSelect: false,
         options: [
           { label: "Approve", description: "Proceed with execution" },
           { label: "Modify", description: "Edit tasks.csv manually" },
           { label: "Cancel", description: "Abort execution" }
         ]
       }]
     })

     if (answer.answersDict.Validation === "Modify") {
       console.log(`Edit ${sessionFolder}/tasks.csv and re-run with --continue`)
       return
     } else if (answer.answersDict.Validation === "Cancel") {
       return
     }
   }
   ```

**Success Criteria**:
- tasks.csv created with valid schema
- Dependencies are acyclic
- User approved (or AUTO_YES)

---

### Phase 2: CSV Batch Execution

**Objective**: Execute all tasks via `spawn_agents_on_csv` with context propagation.

**Steps**:

1. **Prepare Instruction Template**
   ```javascript
   const instructionTemplate = `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS
1. Read: ${sessionFolder}/tasks.csv (current state with previous agents' results)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

## Your Task

**Task ID**: {id}
**Title**: {title}
**Description**: {description}

### Dependencies
{deps}

### Context from Previous Tasks
{context_from}

---

## Context Propagation Protocol

1. **Read CSV**: Load ${sessionFolder}/tasks.csv to see previous agents' results
2. **Extract Context**: For each ID in context_from column:
   - Read that row's findings column
   - Read that row's files_modified column
   - Use this context to inform your implementation
3. **Execute Task**: Implement according to description
4. **Update CSV**: After completion, update your row with:
   - status: "completed" or "failed"
   - findings: Key discoveries (max 200 chars)
   - files_modified: Semicolon-separated paths
   - execution_time: Duration
   - error: Error message if failed

---

## Output Requirements

Return JSON with this exact schema:
{
  "id": "{id}",
  "status": "completed" | "failed",
  "findings": "string (max 200 chars)",
  "files_modified": ["path1", "path2"],
  "execution_time": "45s",
  "error": "string or empty"
}

Use report_agent_job_result to submit this JSON.
`
   ```

2. **Define Output Schema**
   ```javascript
   const outputSchema = {
     type: "object",
     properties: {
       id: { type: "string" },
       status: { type: "string", enum: ["completed", "failed", "pending"] },
       findings: { type: "string", maxLength: 200 },
       files_modified: { type: "array", items: { type: "string" } },
       execution_time: { type: "string" },
       error: { type: "string" }
     },
     required: ["id", "status", "findings", "files_modified", "execution_time"]
   }
   ```

3. **Execute Batch**
   ```javascript
   console.log(`\n## Starting Batch Execution\n`)
   console.log(`Tasks: ${decomposedTasks.length}`)
   console.log(`Concurrency: ${maxConcurrency}`)
   console.log(`Session: ${sessionFolder}\n`)

   const batchResult = spawn_agents_on_csv({
     csv_path: `${sessionFolder}/tasks.csv`,
     id_column: "id",
     instruction: instructionTemplate,
     max_concurrency: maxConcurrency,
     max_workers: decomposedTasks.length,
     max_runtime_seconds: 600,  // 10 minutes per task
     output_schema: outputSchema,
     output_csv_path: `${sessionFolder}/results.csv`
   })

   // This call blocks until all agents complete
   console.log(`\n## Batch Execution Complete\n`)
   ```

**Success Criteria**:
- All agents completed or failed
- results.csv generated
- CSV updated with all agent results

---

### Phase 3: Results Aggregation

**Objective**: Aggregate results, generate context.md, display summary.

**Steps**:

1. **Parse Results**
   ```javascript
   const resultsContent = Read(`${sessionFolder}/results.csv`)
   const resultsLines = resultsContent.split('\n').slice(1)  // Skip header

   const results = resultsLines.map(line => {
     const [id, title, status, findings, files_modified, execution_time, error] =
       line.split(',').map(cell => cell.replace(/^"|"$/g, '').replace(/""/g, '"'))

     return { id, title, status, findings, files_modified: files_modified.split(';'), execution_time, error }
   })

   const completed = results.filter(r => r.status === 'completed')
   const failed = results.filter(r => r.status === 'failed')
   const pending = results.filter(r => r.status === 'pending')
   ```

2. **Generate context.md**
   ```javascript
   const contextContent = `# Batch Execution Context

**Session**: ${sessionId}
**Requirement**: ${requirement}
**Completed**: ${getUtc8ISOString()}

---

## Summary

- **Total Tasks**: ${results.length}
- **Completed**: ${completed.length}
- **Failed**: ${failed.length}
- **Pending**: ${pending.length}

---

## Task Results

${results.map(r => `
### ${r.id}: ${r.title}

**Status**: ${r.status}
**Execution Time**: ${r.execution_time}
${r.error ? `**Error**: ${r.error}` : ''}

**Findings**: ${r.findings}

**Files Modified**:
${r.files_modified.filter(f => f).map(f => `- ${f}`).join('\n')}
`).join('\n---\n')}

---

## All Modified Files

${[...new Set(results.flatMap(r => r.files_modified).filter(f => f))].map(f => `- ${f}`).join('\n')}
`

   Write(`${sessionFolder}/context.md`, contextContent)
   ```

3. **Display Summary**
   ```javascript
   console.log(`
## Execution Summary

- **Session**: ${sessionId}
- **Total Tasks**: ${results.length}
- **Completed**: ${completed.length} ✓
- **Failed**: ${failed.length} ✗
- **Pending**: ${pending.length} ⏸

**Results**: ${sessionFolder}/results.csv
**Context**: ${sessionFolder}/context.md

${failed.length > 0 ? `
### Failed Tasks
${failed.map(f => `- ${f.id}: ${f.title}\n  Error: ${f.error}`).join('\n')}
` : ''}
`)
   ```

4. **Offer Next Steps** (skip if AUTO_YES)
   ```javascript
   if (!AUTO_YES && failed.length > 0) {
     const answer = AskUserQuestion({
       questions: [{
         question: "Next action?",
         header: "Options",
         multiSelect: false,
         options: [
           { label: "View Results", description: "Open context.md" },
           { label: "Retry Failed", description: `Retry ${failed.length} failed tasks` },
           { label: "Done", description: "Complete session" }
         ]
       }]
     })

     switch (answer.answersDict.Options) {
       case "View Results":
         Bash(`cat ${sessionFolder}/context.md`)
         break

       case "Retry Failed":
         // Create new tasks.csv with only failed tasks
         const retryTasks = failed.map(f => {
           const original = decomposedTasks.find(t => t.id === f.id)
           return [f.id, f.title, original.description, original.deps.join(';'), original.context_from.join(';')]
         })

         const retryCsv = [
           ['id', 'title', 'description', 'deps', 'context_from'],
           ...retryTasks
         ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

         Write(`${sessionFolder}/retry-tasks.csv`, retryCsv)

         // Re-execute with retry CSV
         // ... spawn_agents_on_csv with retry-tasks.csv ...
         break

       case "Done":
         break
     }
   }
   ```

**Success Criteria**:
- context.md generated
- Summary displayed
- User action completed (or AUTO_YES)

---

## Error Handling

| Error | Resolution |
|-------|------------|
| CSV parse error | Validate CSV format, show line number |
| Circular dependencies | Detect cycles, prompt user to fix |
| Agent timeout | Mark as failed, continue with remaining |
| All agents failed | Generate error report, offer manual intervention |
| Invalid output schema | Log validation error, mark task as failed |

---

## Core Rules

1. **CSV is Source of Truth**: All task state in CSV, agents read/write CSV
2. **Context Propagation**: Agent N reads Agent N-1's results from CSV
3. **Atomic Tasks**: Each task must be executable by single agent
4. **Blocking Execution**: spawn_agents_on_csv blocks until all complete
5. **Schema Validation**: All agent outputs must match output_schema
6. **DO NOT STOP**: Continuous workflow until all tasks complete or fail

---

## Best Practices

1. **Task Granularity**: 3-10 tasks optimal, too many = overhead, too few = no parallelism
2. **Dependency Management**: Minimize dependencies for better parallelism
3. **Context Sharing**: Use context_from to pass findings between tasks
4. **Concurrency Tuning**: Start with 4, increase if tasks are I/O bound
5. **Error Recovery**: Use retry mechanism for transient failures

---

## Usage Recommendations

**When to Use CSV Batch vs Other Skills:**

| Scenario | Recommended Skill |
|----------|------------------|
| Parallel independent tasks | `$csv-batch-execute` |
| Sequential dependent tasks | `$roadmap-with-file` |
| Interactive planning | `$collaborative-plan-with-file` |
| Single complex task | `$lite-execute` |
| Full lifecycle (spec/impl/test) | `$team-lifecycle-v4` |
