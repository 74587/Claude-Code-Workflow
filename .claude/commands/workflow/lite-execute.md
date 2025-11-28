---
name: lite-execute
description: Execute tasks based on in-memory plan, prompt description, or file content
argument-hint: "[--in-memory] [\"task description\"|file-path]"
allowed-tools: TodoWrite(*), Task(*), Bash(*)
---

# Workflow Lite-Execute Command (/workflow:lite-execute)

## Overview

Flexible task execution command supporting three input modes: in-memory plan (from lite-plan), direct prompt description, or file content. Handles execution orchestration, progress tracking, and optional code review.

**Core capabilities:**
- Multi-mode input (in-memory plan, prompt description, or file path)
- Execution orchestration (Agent or Codex) with full context
- Live progress tracking via TodoWrite at execution call level
- Optional code review with selected tool (Gemini, Agent, or custom)
- Context continuity across multiple executions
- Intelligent format detection (Enhanced Task JSON vs plain text)

## Usage

### Command Syntax
```bash
/workflow:lite-execute [FLAGS] <INPUT>

# Flags
--in-memory                Use plan from memory (called by lite-plan)

# Arguments
<input>                    Task description string, or path to file (required)
```

## Input Modes

### Mode 1: In-Memory Plan

**Trigger**: Called by lite-plan after Phase 4 approval with `--in-memory` flag

**Input Source**: `executionContext` global variable set by lite-plan

**Content**: Complete execution context (see Data Structures section)

**Behavior**:
- Skip execution method selection (already set by lite-plan)
- Directly proceed to execution with full context
- All planning artifacts available (exploration, clarifications, plan)

### Mode 2: Prompt Description

**Trigger**: User calls with task description string

**Input**: Simple task description (e.g., "Add unit tests for auth module")

**Behavior**:
- Store prompt as `originalUserInput`
- Create simple execution plan from prompt
- AskUserQuestion: Select execution method (Agent/Codex/Auto)
- AskUserQuestion: Select code review tool (Skip/Gemini/Agent/Other)
- Proceed to execution with `originalUserInput` included

**User Interaction**:
```javascript
AskUserQuestion({
  questions: [
    {
      question: "Select execution method:",
      header: "Execution",
      multiSelect: false,
      options: [
        { label: "Agent", description: "@code-developer agent" },
        { label: "Codex", description: "codex CLI tool" },
        { label: "Auto", description: "Auto-select based on complexity" }
      ]
    },
    {
      question: "Enable code review after execution?",
      header: "Code Review",
      multiSelect: false,
      options: [
        { label: "Skip", description: "No review" },
        { label: "Gemini Review", description: "Gemini CLI tool" },
        { label: "Agent Review", description: "Current agent review" }
      ]
    }
  ]
})
```

### Mode 3: File Content

**Trigger**: User calls with file path

**Input**: Path to file containing task description or plan.json

**Step 1: Read and Detect Format**

```javascript
fileContent = Read(filePath)

// Attempt JSON parsing
try {
  jsonData = JSON.parse(fileContent)

  // Check if plan.json from lite-plan session
  if (jsonData.summary && jsonData.approach && jsonData.tasks) {
    planObject = jsonData
    originalUserInput = jsonData.summary
    isPlanJson = true
  } else {
    // Valid JSON but not plan.json - treat as plain text
    originalUserInput = fileContent
    isPlanJson = false
  }
} catch {
  // Not valid JSON - treat as plain text prompt
  originalUserInput = fileContent
  isPlanJson = false
}
```

**Step 2: Create Execution Plan**

If `isPlanJson === true`:
- Use `planObject` directly
- User selects execution method and code review

If `isPlanJson === false`:
- Treat file content as prompt (same behavior as Mode 2)
- Create simple execution plan from content

**Step 3: User Interaction**

- AskUserQuestion: Select execution method (Agent/Codex/Auto)
- AskUserQuestion: Select code review tool
- Proceed to execution with full context

## Execution Process

```
Input Parsing:
   └─ Decision (mode detection):
      ├─ --in-memory flag → Mode 1: Load executionContext → Skip user selection
      ├─ Ends with .md/.json/.txt → Mode 3: Read file → Detect format
      │   ├─ Valid plan.json → Use planObject → User selects method + review
      │   └─ Not plan.json → Treat as prompt → User selects method + review
      └─ Other → Mode 2: Prompt description → User selects method + review

Execution:
   ├─ Step 1: Initialize result tracking (previousExecutionResults = [])
   ├─ Step 2: Task grouping & batch creation (cost-aware)
   │   ├─ Build hybrid dependencies (explicit depends_on + file conflicts via modification_points)
   │   ├─ Phase 1: Group by execution_group (explicit parallel groups)
   │   ├─ Phase 2: Cost-aware batching (MAX_BATCH_COST=8, Low=1/Medium=2/High=4)
   │   └─ Create TodoWrite list for batches
   ├─ Step 3: Launch execution
   │   ├─ Parallel batches: ⚡ concurrent via multiple tool calls
   │   └─ Sequential batches: → one by one
   ├─ Step 4: Track progress (TodoWrite updates per batch)
   └─ Step 5: Code review (if codeReviewTool ≠ "Skip")

Output:
   └─ Execution complete with results in previousExecutionResults[]
```

## Detailed Execution Steps

### Step 1: Initialize Execution Tracking

**Operations**:
- Initialize result tracking for multi-execution scenarios
- Set up `previousExecutionResults` array for context continuity

```javascript
// Initialize result tracking
previousExecutionResults = []
```

### Step 2: Task Grouping & Batch Creation

**Dependency Analysis & Grouping Algorithm**:
```javascript
const MAX_BATCH_COST = 8  // Workload limit per batch (tunable)

// Task cost based on complexity (Low=1, Medium=2, High=4)
function calculateTaskCost(task) {
  const costs = { Low: 1, Medium: 2, High: 4 }
  return costs[task.complexity] || 1
}

// Build hybrid dependencies: explicit depends_on + implicit file conflicts
function buildDependencies(tasks) {
  const taskIdToIndex = {}
  tasks.forEach((t, i) => { taskIdToIndex[t.id] = i })
  const fileOwner = {}  // Track which task last modified each file

  return tasks.map((task, i) => {
    const deps = new Set()

    // 1. Explicit depends_on
    ;(task.depends_on || []).forEach(depId => {
      const idx = taskIdToIndex[depId]
      if (idx !== undefined && idx < i) deps.add(idx)
    })

    // 2. Implicit file conflicts via modification_points
    ;(task.modification_points || []).forEach(mp => {
      if (fileOwner[mp.file] !== undefined && fileOwner[mp.file] !== i) {
        deps.add(fileOwner[mp.file])
      }
      fileOwner[mp.file] = i
    })

    return { ...task, taskIndex: i, dependencies: [...deps], cost: calculateTaskCost(task) }
  })
}

// Group into cost-aware batches with execution_group priority
function createExecutionCalls(tasks, executionMethod) {
  const tasksWithDeps = buildDependencies(tasks)
  const processed = new Set()
  const calls = []
  let parallelIdx = 1, sequentialIdx = 1

  // Phase 1: Group by execution_group (explicit parallel groups)
  const groups = {}
  tasksWithDeps.forEach(t => {
    if (t.execution_group) {
      groups[t.execution_group] = groups[t.execution_group] || []
      groups[t.execution_group].push(t)
    }
  })
  Object.entries(groups).forEach(([groupId, groupTasks]) => {
    groupTasks.forEach(t => processed.add(t.taskIndex))
    calls.push({
      method: executionMethod,
      executionType: "parallel",
      groupId: `P${parallelIdx++}`,
      taskSummary: groupTasks.map(t => t.title).join(' | '),
      tasks: groupTasks
    })
  })

  // Phase 2: Process remaining by dependency order with cost-aware batching
  let remaining = tasksWithDeps.filter(t => !processed.has(t.taskIndex))

  while (remaining.length > 0) {
    const ready = remaining.filter(t => t.dependencies.every(d => processed.has(d)))
    if (ready.length === 0) { ready.push(...remaining) }  // Break circular deps

    // Cost-aware batch creation
    let batch = [], batchCost = 0
    const stillReady = [...ready]
    while (stillReady.length > 0) {
      const idx = stillReady.findIndex(t => batchCost + t.cost <= MAX_BATCH_COST)
      if (idx === -1) break
      const task = stillReady.splice(idx, 1)[0]
      batch.push(task)
      batchCost += task.cost
    }
    if (batch.length === 0) batch = [ready[0]]  // At least one task

    batch.forEach(t => processed.add(t.taskIndex))
    calls.push({
      method: executionMethod,
      executionType: batch.length > 1 ? "parallel" : "sequential",
      groupId: batch.length > 1 ? `P${parallelIdx++}` : `S${sequentialIdx++}`,
      taskSummary: batch.map(t => t.title).join(batch.length > 1 ? ' | ' : ' → '),
      tasks: batch
    })
    remaining = remaining.filter(t => !processed.has(t.taskIndex))
  }
  return calls
}

executionCalls = createExecutionCalls(planObject.tasks, executionMethod).map(c => ({ ...c, id: `[${c.groupId}]` }))

TodoWrite({
  todos: executionCalls.map(c => ({
    content: `${c.executionType === "parallel" ? "⚡" : "→"} ${c.id} (${c.tasks.length} tasks)`,
    status: "pending",
    activeForm: `Executing ${c.id}`
  }))
})
```

### Step 3: Launch Execution

**Execution Flow**: Parallel batches concurrently (multiple agents) → Sequential batches in order

**Unified executeBatch dispatcher**:
```javascript
// Dispatch batch to appropriate executor (Agent or Codex)
function executeBatch(batch) {
  if (batch.method === "Agent") {
    return executeBatchAgent(batch)  // See Option A below
  } else {
    return executeBatchCodex(batch)  // See Option B below
  }
}
```

**Execution orchestration**:
```javascript
const parallel = executionCalls.filter(c => c.executionType === "parallel")
const sequential = executionCalls.filter(c => c.executionType === "sequential")

// Phase 1: Launch all parallel batches (MULTIPLE CONCURRENT AGENTS)
// Each batch → separate agent instance → true parallelism
if (parallel.length > 0) {
  TodoWrite({ todos: executionCalls.map(c => ({ status: c.executionType === "parallel" ? "in_progress" : "pending" })) })
  // Promise.all dispatches each batch to its own agent concurrently
  parallelResults = await Promise.all(parallel.map(c => executeBatch(c)))
  previousExecutionResults.push(...parallelResults)
  TodoWrite({ todos: executionCalls.map(c => ({ status: parallel.includes(c) ? "completed" : "pending" })) })
}

// Phase 2: Execute sequential batches one by one
for (const call of sequential) {
  TodoWrite({ todos: executionCalls.map(c => ({ status: c === call ? "in_progress" : "..." })) })
  result = await executeBatch(call)
  previousExecutionResults.push(result)
  TodoWrite({ todos: executionCalls.map(c => ({ status: "completed" or "pending" })) })
}
```

**Option A: Agent Execution**

When to use:
- `executionMethod = "Agent"`
- `executionMethod = "Auto" AND complexity = "Low"`

Agent call format:
```javascript
function formatTaskForAgent(task, index) {
  return `
### Task ${index + 1}: ${task.title}
**File**: ${task.file}
**Action**: ${task.action}
**Description**: ${task.description}

**Implementation Steps**:
${task.implementation.map((step, i) => `${i + 1}. ${step}`).join('\n')}

**Reference**:
- Pattern: ${task.reference.pattern}
- Example Files: ${task.reference.files.join(', ')}
- Guidance: ${task.reference.examples}

**Acceptance Criteria**:
${task.acceptance.map((criterion, i) => `${i + 1}. ${criterion}`).join('\n')}
`
}

// executeBatch(batch) - called for each parallel/sequential batch
function executeBatchAgent(batch) {
  return Task(
    subagent_type="code-developer",
    description=`Implement batch ${batch.groupId}: ${batch.taskSummary}`,
    prompt=`
  ${originalUserInput ? `## Original User Request\n${originalUserInput}\n\n` : ''}

  ## Implementation Plan

  **Summary**: ${planObject.summary}
  **Approach**: ${planObject.approach}

  ## Batch ${batch.groupId}: Task Breakdown (${batch.tasks.length} tasks)
  ${batch.tasks.map((task, i) => formatTaskForAgent(task, i)).join('\n')}

  ${previousExecutionResults.length > 0 ? `\n## Previous Execution Results\n${previousExecutionResults.map(result => `
[${result.executionId}] ${result.status}
Tasks: ${result.tasksSummary}
Completion: ${result.completionSummary}
Outputs: ${result.keyOutputs || 'See git diff'}
${result.notes ? `Notes: ${result.notes}` : ''}
  `).join('\n---\n')}` : ''}

  ## Multi-Angle Code Context

  ${explorationsContext && Object.keys(explorationsContext).length > 0 ?
    explorationAngles.map(angle => {
      const exp = explorationsContext[angle]
      return `### Exploration Angle: ${angle}

**Project Structure**: ${exp.project_structure || 'N/A'}
**Relevant Files**: ${exp.relevant_files?.join(', ') || 'None'}
**Patterns**: ${exp.patterns || 'N/A'}
**Dependencies**: ${exp.dependencies || 'N/A'}
**Integration Points**: ${exp.integration_points || 'N/A'}
**Constraints**: ${exp.constraints || 'N/A'}`
    }).join('\n\n---\n\n')
    : "No exploration performed"
  }

  ${clarificationContext ? `\n## Clarifications\n${JSON.stringify(clarificationContext, null, 2)}` : ''}

  ${executionContext?.session?.artifacts ? `\n## Exploration Artifact Files

  Detailed exploration context available in:
  ${executionContext.session.artifacts.explorations?.map(exp =>
    `- Angle: ${exp.angle} → ${exp.path}`
  ).join('\n') || ''}
  ${executionContext.session.artifacts.explorations_manifest ? `- Manifest: ${executionContext.session.artifacts.explorations_manifest}` : ''}
  - Plan: ${executionContext.session.artifacts.plan}

  Read exploration files for comprehensive context from multiple angles.` : ''}

  ## Requirements
  MUST complete ALL ${batch.tasks.length} tasks in batch ${batch.groupId}.
  Return only after all tasks in this batch are fully implemented and tested.
  `
  )
}
```

**Result Collection**: After completion, collect result following `executionResult` structure (see Data Structures section)

**Option B: CLI Execution (Codex)**

When to use:
- `executionMethod = "Codex"`
- `executionMethod = "Auto" AND complexity = "Medium" or "High"`

**Artifact Path Delegation**:
- Include artifact file paths in CLI prompt for enhanced context
- Codex can read artifact files for detailed planning information
- Example: Reference exploration.json for architecture patterns

Command format:
```bash
function formatTaskForCodex(task, index) {
  return `
${index + 1}. ${task.title} (${task.file})
   Action: ${task.action}
   What: ${task.description}
   How:
${task.implementation.map((step, i) => `   ${i + 1}. ${step}`).join('\n')}
   Reference: ${task.reference.pattern} (see ${task.reference.files.join(', ')})
   Guidance: ${task.reference.examples}
   Verify:
${task.acceptance.map((criterion, i) => `   - ${criterion}`).join('\n')}
`
}

// executeBatch(batch) - called for each parallel/sequential batch
const timeoutByComplexity = { "Low": 2400000, "Medium": 3600000, "High": 6000000 }

function executeBatchCodex(batch) {
  return Bash(`codex --full-auto exec "
${originalUserInput ? `## Original User Request\n${originalUserInput}\n\n` : ''}

## Implementation Plan

TASK: ${planObject.summary}
APPROACH: ${planObject.approach}

### Batch ${batch.groupId}: Task Breakdown (${batch.tasks.length} tasks)
${batch.tasks.map((task, i) => formatTaskForCodex(task, i)).join('\n')}

${previousExecutionResults.length > 0 ? `\n### Previous Execution Results\n${previousExecutionResults.map(result => `
[${result.executionId}] ${result.status}
Tasks: ${result.tasksSummary}
Status: ${result.completionSummary}
Outputs: ${result.keyOutputs || 'See git diff'}
${result.notes ? `Notes: ${result.notes}` : ''}
`).join('\n---\n')}

IMPORTANT: Review previous results. Build on completed work. Avoid duplication.
` : ''}

### Multi-Angle Code Context

${explorationsContext && Object.keys(explorationsContext).length > 0 ?
  `Exploration conducted from ${explorationAngles.length} angles:

${explorationAngles.map(angle => {
  const exp = explorationsContext[angle]
  return `Angle: ${angle}
- Structure: ${exp.project_structure || 'Standard structure'}
- Files: ${exp.relevant_files?.slice(0, 5).join(', ') || 'TBD'}${exp.relevant_files?.length > 5 ? ` (+${exp.relevant_files.length - 5} more)` : ''}
- Patterns: ${exp.patterns?.substring(0, 100) || 'Follow existing'}${exp.patterns?.length > 100 ? '...' : ''}
- Constraints: ${exp.constraints || 'None'}`
}).join('\n\n')}
`
  : 'No prior exploration - analyze codebase as needed'
}

${clarificationContext ? `\n### User Clarifications\n${Object.entries(clarificationContext).map(([q, a]) => `${q}: ${a}`).join('\n')}` : ''}

${executionContext?.session?.artifacts ? `\n### Exploration Artifact Files
Detailed context from multiple exploration angles available in:
${executionContext.session.artifacts.explorations?.map(exp =>
  `- Angle: ${exp.angle} → ${exp.path}`
).join('\n') || ''}
${executionContext.session.artifacts.explorations_manifest ? `- Manifest: ${executionContext.session.artifacts.explorations_manifest}` : ''}
- Plan: ${executionContext.session.artifacts.plan}

Read exploration files for comprehensive architectural, pattern, and constraint details from multiple angles.
` : ''}

## Requirements
MUST complete ALL ${batch.tasks.length} tasks in batch ${batch.groupId}.
Return only after all tasks in this batch are fully implemented and tested.

Complexity: ${planObject.complexity}
" --skip-git-repo-check -s danger-full-access`, { timeout: timeoutByComplexity[planObject.complexity] || 3600000 })
}
```

**Note**: Timeout based on complexity (Low=40min, Medium=60min, High=100min) is handled in `executeBatchCodex`.

**Result Collection**: After completion, analyze output and collect result following `executionResult` structure

### Step 4: Progress Tracking

Progress tracked at batch level (not individual task level). Icons: ⚡ (parallel, concurrent), → (sequential, one-by-one)

### Step 5: Code Review (Optional)

**Skip Condition**: Only run if `codeReviewTool ≠ "Skip"`

**Review Focus**: Verify implementation against plan acceptance criteria
- Read plan.json for task acceptance criteria
- Check each acceptance criterion is fulfilled
- Validate code quality and identify issues
- Ensure alignment with planned approach

**Operations**:
- Agent Review: Current agent performs direct review
- Gemini Review: Execute gemini CLI with review prompt
- Custom tool: Execute specified CLI tool (qwen, codex, etc.)

**Unified Review Template** (All tools use same standard):

**Review Criteria**:
- **Acceptance Criteria**: Verify each criterion from plan.tasks[].acceptance
- **Code Quality**: Analyze quality, identify issues, suggest improvements
- **Plan Alignment**: Validate implementation matches planned approach

**Shared Prompt Template** (used by all CLI tools):
```
PURPOSE: Code review for implemented changes against plan acceptance criteria
TASK: • Verify plan acceptance criteria fulfillment • Analyze code quality • Identify issues • Suggest improvements • Validate plan adherence
MODE: analysis
CONTEXT: @**/* @{plan.json} [@{exploration.json}] | Memory: Review lite-execute changes against plan requirements
EXPECTED: Quality assessment with acceptance criteria verification, issue identification, and recommendations. Explicitly check each acceptance criterion from plan.json tasks.
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/02-review-code-quality.txt) | Focus on plan acceptance criteria and plan adherence | analysis=READ-ONLY
```

**Tool-Specific Execution** (Apply shared prompt template above):

```bash
# Method 1: Agent Review (current agent)
# - Read plan.json: ${executionContext.session.artifacts.plan}
# - Apply unified review criteria (see Shared Prompt Template)
# - Report findings directly

# Method 2: Gemini Review (recommended)
gemini -p "[Shared Prompt Template with artifacts]"
# CONTEXT includes: @**/* @${plan.json} [@${exploration.json}]

# Method 3: Qwen Review (alternative)
qwen -p "[Shared Prompt Template with artifacts]"
# Same prompt as Gemini, different execution engine

# Method 4: Codex Review (autonomous)
codex --full-auto exec "[Verify plan acceptance criteria at ${plan.json}]" --skip-git-repo-check -s danger-full-access
```

**Implementation Note**: Replace `[Shared Prompt Template with artifacts]` placeholder with actual template content, substituting:
- `@{plan.json}` → `@${executionContext.session.artifacts.plan}`
- `[@{exploration.json}]` → exploration files from artifacts (if exists)

## Best Practices

**Input Modes**: In-memory (lite-plan), prompt (standalone), file (JSON/text)
**Task Grouping**: Hybrid dependencies (explicit depends_on + file conflicts) + execution_group priority + cost-aware batching (MAX_BATCH_COST=8)
**Execution**: Parallel batches via single Claude message with multiple tool calls; cost balances workload (Low=1, Medium=2, High=4)

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Missing executionContext | --in-memory without context | Error: "No execution context found. Only available when called by lite-plan." |
| File not found | File path doesn't exist | Error: "File not found: {path}. Check file path." |
| Empty file | File exists but no content | Error: "File is empty: {path}. Provide task description." |
| Invalid Enhanced Task JSON | JSON missing required fields | Warning: "Missing required fields. Treating as plain text." |
| Malformed JSON | JSON parsing fails | Treat as plain text (expected for non-JSON files) |
| Execution failure | Agent/Codex crashes | Display error, save partial progress, suggest retry |
| Codex unavailable | Codex not installed | Show installation instructions, offer Agent execution |

## Data Structures

### executionContext (Input - Mode 1)

Passed from lite-plan via global variable:

```javascript
{
  planObject: {
    summary: string,
    approach: string,
    tasks: [...],
    estimated_time: string,
    recommended_execution: string,
    complexity: string
  },
  explorationsContext: {...} | null,       // Multi-angle explorations
  explorationAngles: string[],             // List of exploration angles
  explorationManifest: {...} | null,       // Exploration manifest
  clarificationContext: {...} | null,
  executionMethod: "Agent" | "Codex" | "Auto",
  codeReviewTool: "Skip" | "Gemini Review" | "Agent Review" | string,
  originalUserInput: string,

  // Session artifacts location (saved by lite-plan)
  session: {
    id: string,                        // Session identifier: {taskSlug}-{shortTimestamp}
    folder: string,                    // Session folder path: .workflow/.lite-plan/{session-id}
    artifacts: {
      explorations: [{angle, path}],   // exploration-{angle}.json paths
      explorations_manifest: string,   // explorations-manifest.json path
      plan: string                     // plan.json path (always present)
    }
  }
}
```

**Artifact Usage**:
- Artifact files contain detailed planning context
- Pass artifact paths to CLI tools and agents for enhanced context
- See execution options below for usage examples

### executionResult (Output)

Collected after each execution call completes:

```javascript
{
  executionId: string,                 // e.g., "[Agent-1]", "[Codex-1]"
  status: "completed" | "partial" | "failed",
  tasksSummary: string,                // Brief description of tasks handled
  completionSummary: string,           // What was completed
  keyOutputs: string,                  // Files created/modified, key changes
  notes: string                        // Important context for next execution
}
```

Appended to `previousExecutionResults` array for context continuity in multi-execution scenarios.
