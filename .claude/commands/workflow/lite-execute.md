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

**Input**: Path to file containing task description or Enhanced Task JSON

**Step 1: Read and Detect Format**

```javascript
fileContent = Read(filePath)

// Attempt JSON parsing
try {
  jsonData = JSON.parse(fileContent)

  // Check if Enhanced Task JSON from lite-plan
  if (jsonData.meta?.workflow === "lite-plan") {
    // Extract plan data
    planObject = {
      summary: jsonData.context.plan.summary,
      approach: jsonData.context.plan.approach,
      tasks: jsonData.context.plan.tasks,
      estimated_time: jsonData.meta.estimated_time,
      recommended_execution: jsonData.meta.recommended_execution,
      complexity: jsonData.meta.complexity
    }

    // Extract multi-angle explorations
    explorationsContext = jsonData.context.explorations || null
    explorationAngles = jsonData.meta.exploration_angles || []
    explorationFiles = jsonData.context.exploration_files || []

    clarificationContext = jsonData.context.clarifications || null
    originalUserInput = jsonData.title

    isEnhancedTaskJson = true
  } else {
    // Valid JSON but not Enhanced Task JSON - treat as plain text
    originalUserInput = fileContent
    isEnhancedTaskJson = false
  }
} catch {
  // Not valid JSON - treat as plain text prompt
  originalUserInput = fileContent
  isEnhancedTaskJson = false
}
```

**Step 2: Create Execution Plan**

If `isEnhancedTaskJson === true`:
- Use extracted `planObject` directly
- Skip planning, use lite-plan's existing plan
- User still selects execution method and code review

If `isEnhancedTaskJson === false`:
- Treat file content as prompt (same behavior as Mode 2)
- Create simple execution plan from content

**Step 3: User Interaction**

- AskUserQuestion: Select execution method (Agent/Codex/Auto)
- AskUserQuestion: Select code review tool
- Proceed to execution with full context

## Execution Process

### Workflow Overview

```
Input Processing → Mode Detection
    |
    v
[Mode 1] --in-memory: Load executionContext → Skip selection
[Mode 2] Prompt: Create plan → User selects method + review
[Mode 3] File: Detect format → Extract plan OR treat as prompt → User selects
    |
    v
Execution & Progress Tracking
    ├─ Step 1: Initialize execution tracking
    ├─ Step 2: Create TodoWrite execution list
    ├─ Step 3: Launch execution (Agent or Codex)
    ├─ Step 4: Track execution progress
    └─ Step 5: Code review (optional)
    |
    v
Execution Complete
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
// Infer dependencies: same file → sequential, keywords (use/integrate) → sequential
function inferDependencies(tasks) {
  return tasks.map((task, i) => {
    const deps = []
    const file = task.file || task.title.match(/in\s+([^\s:]+)/)?.[1]
    const keywords = (task.description || task.title).toLowerCase()

    for (let j = 0; j < i; j++) {
      const prevFile = tasks[j].file || tasks[j].title.match(/in\s+([^\s:]+)/)?.[1]
      if (file && prevFile === file) deps.push(j)  // Same file
      else if (/use|integrate|call|import/.test(keywords)) deps.push(j)  // Keyword dependency
    }
    return { ...task, taskIndex: i, dependencies: deps }
  })
}

// Group into batches: independent → parallel [P1,P2...], dependent → sequential [S1,S2...]
function createExecutionCalls(tasks, executionMethod) {
  const tasksWithDeps = inferDependencies(tasks)
  const maxBatch = executionMethod === "Codex" ? 4 : 7
  const calls = []
  const processed = new Set()

  // Parallel: independent tasks, different files, max batch size
  const parallelGroups = []
  tasksWithDeps.forEach(t => {
    if (t.dependencies.length === 0 && !processed.has(t.taskIndex)) {
      const group = [t]
      processed.add(t.taskIndex)
      tasksWithDeps.forEach(o => {
        if (!o.dependencies.length && !processed.has(o.taskIndex) &&
            group.length < maxBatch && t.file !== o.file) {
          group.push(o)
          processed.add(o.taskIndex)
        }
      })
      parallelGroups.push(group)
    }
  })

  // Sequential: dependent tasks, batch when deps satisfied
  const remaining = tasksWithDeps.filter(t => !processed.has(t.taskIndex))
  while (remaining.length > 0) {
    const batch = remaining.filter((t, i) =>
      i < maxBatch && t.dependencies.every(d => processed.has(d))
    )
    if (!batch.length) break
    batch.forEach(t => processed.add(t.taskIndex))
    calls.push({ executionType: "sequential", groupId: `S${calls.length + 1}`, tasks: batch })
    remaining.splice(0, remaining.length, ...remaining.filter(t => !processed.has(t.taskIndex)))
  }

  // Combine results
  return [
    ...parallelGroups.map((g, i) => ({
      method: executionMethod, executionType: "parallel", groupId: `P${i+1}`,
      taskSummary: g.map(t => t.title).join(' | '), tasks: g
    })),
    ...calls.map(c => ({ ...c, method: executionMethod, taskSummary: c.tasks.map(t => t.title).join(' → ') }))
  ]
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

**Execution Flow**: Parallel batches concurrently → Sequential batches in order
```javascript
const parallel = executionCalls.filter(c => c.executionType === "parallel")
const sequential = executionCalls.filter(c => c.executionType === "sequential")

// Phase 1: Launch all parallel batches (single message with multiple tool calls)
if (parallel.length > 0) {
  TodoWrite({ todos: executionCalls.map(c => ({ status: c.executionType === "parallel" ? "in_progress" : "pending" })) })
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

Task(
  subagent_type="code-developer",
  description="Implement planned tasks",
  prompt=`
  ${originalUserInput ? `## Original User Request\n${originalUserInput}\n\n` : ''}

  ## Implementation Plan

  **Summary**: ${planObject.summary}
  **Approach**: ${planObject.approach}

  ## Task Breakdown (${planObject.tasks.length} tasks)
  ${planObject.tasks.map((task, i) => formatTaskForAgent(task, i)).join('\n')}

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
  - Task: ${executionContext.session.artifacts.task}

  Read exploration files for comprehensive context from multiple angles.` : ''}

  ## Requirements
  MUST complete ALL ${planObject.tasks.length} tasks listed above in this single execution.
  Return only after all tasks are fully implemented and tested.
  `
)
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

codex --full-auto exec "
${originalUserInput ? `## Original User Request\n${originalUserInput}\n\n` : ''}

## Implementation Plan

TASK: ${planObject.summary}
APPROACH: ${planObject.approach}

### Task Breakdown (${planObject.tasks.length} tasks)
${planObject.tasks.map((task, i) => formatTaskForCodex(task, i)).join('\n')}

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
- Task: ${executionContext.session.artifacts.task}

Read exploration files for comprehensive architectural, pattern, and constraint details from multiple angles.
` : ''}

## Requirements
MUST complete ALL ${planObject.tasks.length} tasks listed above in this single execution.
Return only after all tasks are fully implemented and tested.

Complexity: ${planObject.complexity}
" --skip-git-repo-check -s danger-full-access
```

**Execution with tracking**:
```javascript
// Launch CLI in foreground (NOT background)
bash_result = Bash(
  command=cli_command,
  timeout=600000  // 10 minutes
)

// Update TodoWrite when execution completes
```

**Result Collection**: After completion, analyze output and collect result following `executionResult` structure

### Step 4: Progress Tracking

Progress tracked at batch level (not individual task level). Icons: ⚡ (parallel, concurrent), → (sequential, one-by-one)

### Step 5: Code Review (Optional)

**Skip Condition**: Only run if `codeReviewTool ≠ "Skip"`

**Review Focus**: Verify implementation against task.json acceptance criteria
- Read task.json from session artifacts for acceptance criteria
- Check each acceptance criterion is fulfilled
- Validate code quality and identify issues
- Ensure alignment with planned approach

**Operations**:
- Agent Review: Current agent performs direct review (read task.json for acceptance criteria)
- Gemini Review: Execute gemini CLI with review prompt (task.json in CONTEXT)
- Custom tool: Execute specified CLI tool (qwen, codex, etc.) with task.json reference

**Unified Review Template** (All tools use same standard):

**Review Criteria**:
- **Acceptance Criteria**: Verify each criterion from task.json `context.acceptance`
- **Code Quality**: Analyze quality, identify issues, suggest improvements
- **Plan Alignment**: Validate implementation matches planned approach

**Shared Prompt Template** (used by all CLI tools):
```
PURPOSE: Code review for implemented changes against task.json acceptance criteria
TASK: • Verify task.json acceptance criteria fulfillment • Analyze code quality • Identify issues • Suggest improvements • Validate plan adherence
MODE: analysis
CONTEXT: @**/* @{task.json} @{plan.json} [@{exploration.json}] | Memory: Review lite-execute changes against task.json requirements
EXPECTED: Quality assessment with acceptance criteria verification, issue identification, and recommendations. Explicitly check each acceptance criterion from task.json.
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/02-review-code-quality.txt) | Focus on task.json acceptance criteria and plan adherence | analysis=READ-ONLY
```

**Tool-Specific Execution** (Apply shared prompt template above):

```bash
# Method 1: Agent Review (current agent)
# - Read task.json: ${executionContext.session.artifacts.task}
# - Apply unified review criteria (see Shared Prompt Template)
# - Report findings directly

# Method 2: Gemini Review (recommended)
gemini -p "[Shared Prompt Template with artifacts]"
# CONTEXT includes: @**/* @${task.json} @${plan.json} [@${exploration.json}]

# Method 3: Qwen Review (alternative)
qwen -p "[Shared Prompt Template with artifacts]"
# Same prompt as Gemini, different execution engine

# Method 4: Codex Review (autonomous)
codex --full-auto exec "[Verify task.json acceptance criteria at ${task.json}]" --skip-git-repo-check -s danger-full-access
```

**Implementation Note**: Replace `[Shared Prompt Template with artifacts]` placeholder with actual template content, substituting:
- `@{task.json}` → `@${executionContext.session.artifacts.task}`
- `@{plan.json}` → `@${executionContext.session.artifacts.plan}`
- `[@{exploration.json}]` → `@${executionContext.session.artifacts.exploration}` (if exists)

## Best Practices

**Input Modes**: In-memory (lite-plan), prompt (standalone), file (JSON/text)
**Batch Limits**: Agent 7 tasks, CLI 4 tasks
**Execution**: Parallel batches use single Claude message with multiple tool calls (no concurrency limit)

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
  explorationContext: {...} | null,
  clarificationContext: {...} | null,
  executionMethod: "Agent" | "Codex" | "Auto",
  codeReviewTool: "Skip" | "Gemini Review" | "Agent Review" | string,
  originalUserInput: string,

  // Session artifacts location (saved by lite-plan)
  session: {
    id: string,                        // Session identifier: {taskSlug}-{shortTimestamp}
    folder: string,                    // Session folder path: .workflow/.lite-plan/{session-id}
    artifacts: {
      exploration: string | null,      // exploration.json path (if exploration performed)
      plan: string,                    // plan.json path (always present)
      task: string                     // task.json path (always exported)
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
