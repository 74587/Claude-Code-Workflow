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
    explorationContext = jsonData.context.exploration || null
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

### Step 2: Intelligent Task Grouping & Execution Planning

**Operations**:
- Analyze task dependencies and file targets
- Group tasks based on context similarity and dependencies
- Support parallel execution for independent tasks
- Respect task limits per execution (Agent: 7 tasks, CLI: 4 tasks)

**Task Analysis & Grouping**:
```javascript
// Extract file path from task for dependency analysis
function getTaskFile(task) {
  return task.file || task.title.match(/in\s+([^\s:]+)/)?.[1] || null
}

// Infer dependencies from task descriptions and file paths
function inferDependencies(tasks) {
  return tasks.map((task, index) => {
    const dependencies = []
    const taskFile = getTaskFile(task)
    const keywords = task.description?.toLowerCase() || task.title.toLowerCase()

    // Check previous tasks for dependencies
    for (let i = 0; i < index; i++) {
      const prevTask = tasks[i]
      const prevFile = getTaskFile(prevTask)

      // Same file modification → sequential dependency
      if (taskFile && prevFile === taskFile) {
        dependencies.push(i)
        continue
      }

      // Keyword-based dependency detection
      if (keywords.includes('use') || keywords.includes('integrate') ||
          keywords.includes('call') || keywords.includes('import')) {
        const prevTitle = prevTask.title.toLowerCase()
        if (keywords.includes(prevTitle.split(' ')[0])) {
          dependencies.push(i)
        }
      }
    }

    return { ...task, taskIndex: index, dependencies }
  })
}

// Group tasks into execution batches
function createExecutionCalls(tasks, executionMethod) {
  const tasksWithDeps = inferDependencies(tasks)
  const maxTasksPerCall = executionMethod === "Codex" ? 4 : 7
  const calls = []
  const processed = new Set()

  // Phase 1: Group independent tasks for parallel execution
  const parallelGroups = []
  tasksWithDeps.forEach(task => {
    if (task.dependencies.length === 0 && !processed.has(task.taskIndex)) {
      const group = [task]
      processed.add(task.taskIndex)

      // Find other independent tasks with different files for parallel batch
      const taskFile = getTaskFile(task)
      tasksWithDeps.forEach(other => {
        if (other.dependencies.length === 0 &&
            !processed.has(other.taskIndex) &&
            group.length < maxTasksPerCall) {
          const otherFile = getTaskFile(other)
          // Only group if different files (avoid conflicts)
          if (!taskFile || !otherFile || taskFile !== otherFile) {
            group.push(other)
            processed.add(other.taskIndex)
          }
        }
      })

      parallelGroups.push(group)
    }
  })

  // Phase 2: Group dependent tasks sequentially
  const dependentTasks = tasksWithDeps.filter(t => !processed.has(t.taskIndex))
  const sequentialBatches = []
  while (dependentTasks.length > 0) {
    const batch = []
    const batchIndices = new Set()

    for (const task of dependentTasks) {
      // Can add to batch if dependencies are already processed
      const depsProcessed = task.dependencies.every(dep =>
        processed.has(dep) || batchIndices.has(dep)
      )

      if (depsProcessed && batch.length < maxTasksPerCall) {
        batch.push(task)
        batchIndices.add(task.taskIndex)
        processed.add(task.taskIndex)
      }
    }

    if (batch.length === 0) break // Prevent infinite loop
    sequentialBatches.push(batch)
    dependentTasks.splice(0, dependentTasks.length,
      ...dependentTasks.filter(t => !processed.has(t.taskIndex))
    )
  }

  // Combine parallel and sequential batches
  parallelGroups.forEach((group, i) => {
    calls.push({
      method: executionMethod === "Codex" ? "Codex" : "Agent",
      executionType: "parallel",
      groupId: `P${i + 1}`,
      taskSummary: group.map(t => t.title).join(' | '),
      tasks: group
    })
  })

  sequentialBatches.forEach((batch, i) => {
    calls.push({
      method: executionMethod === "Codex" ? "Codex" : "Agent",
      executionType: "sequential",
      groupId: `S${i + 1}`,
      taskSummary: batch.map(t => t.title).join(' → '),
      tasks: batch
    })
  })

  return calls
}

// Create execution calls with IDs and execution method
executionCalls = createExecutionCalls(planObject.tasks, executionMethod).map((call, index) => ({
  ...call,
  id: `[${call.groupId}]`
}))

// Create TodoWrite list with execution type indicators
TodoWrite({
  todos: executionCalls.map(call => {
    const typeIcon = call.executionType === "parallel" ? "⚡" : "→"
    const typeLabel = call.executionType === "parallel" ? "Parallel" : "Sequential"
    return {
      content: `${typeIcon} ${call.id} [${typeLabel}] (${call.tasks.length} tasks: ${call.taskSummary})`,
      status: "pending",
      activeForm: `Executing ${call.id} - ${typeLabel} batch (${call.tasks.length} tasks)`
    }
  })
})
```

**Grouping Strategy Examples**:

```javascript
// Example 1: Independent tasks, different files → Parallel groups
Tasks: [
  { title: "Create auth.ts", file: "src/auth.ts" },
  { title: "Create utils.ts", file: "src/utils.ts" },
  { title: "Create types.ts", file: "src/types.ts" }
]
Result: [P1] ⚡ Parallel (3 tasks)

// Example 2: Same file modifications → Sequential batch
Tasks: [
  { title: "Add function in auth.ts", file: "src/auth.ts" },
  { title: "Update function in auth.ts", file: "src/auth.ts" }
]
Result: [S1] → Sequential (2 tasks)

// Example 3: Mixed dependencies → Multiple batches
Tasks: [
  { title: "Create base.ts", file: "src/base.ts" },          // No deps
  { title: "Create helper.ts", file: "src/helper.ts" },      // No deps
  { title: "Use base in main.ts", file: "src/main.ts" },     // Depends on base.ts
  { title: "Use helper in app.ts", file: "src/app.ts" }      // Depends on helper.ts
]
Result:
  [P1] ⚡ Parallel (2 tasks: base.ts | helper.ts)
  [P2] ⚡ Parallel (2 tasks: main.ts | app.ts)

// Example 4: Exceeds batch limit → Multiple batches
Agent (7 tasks max): 10 tasks → [P1: 7 tasks] + [P2: 3 tasks]
Codex (4 tasks max): 10 tasks → [P1: 4 tasks] + [P2: 4 tasks] + [P3: 2 tasks]
```

**TodoWrite Display Examples**:
```
Parallel execution (independent files):
[ ] ⚡ [P1] [Parallel] (3 tasks: Create auth.ts | Create utils.ts | Create types.ts)

Sequential execution (same file or dependencies):
[ ] → [S1] [Sequential] (2 tasks: Add function in auth.ts → Update function in auth.ts)

Mixed execution (multiple batches):
[ ] ⚡ [P1] [Parallel] (4 tasks: Create base.ts | Create helper.ts | Create config.ts | Create types.ts)
[ ] ⚡ [P2] [Parallel] (3 tasks: Use base in main.ts | Use helper in app.ts | Use config in index.ts)
[ ] → [S1] [Sequential] (2 tasks: Integrate components → Add tests)
```

### Step 3: Launch Execution

**Execution Strategy**:
- **Parallel batches**: Launch all parallel batches simultaneously (CLI has no concurrency limit)
- **Sequential batches**: Execute in order, waiting for previous completion
- **Mixed workflow**: Process parallel groups first, then sequential groups

**Execution Loop**:
```javascript
// Phase 1: Launch all parallel batches concurrently
const parallelCalls = executionCalls.filter(c => c.executionType === "parallel")
const sequentialCalls = executionCalls.filter(c => c.executionType === "sequential")

if (parallelCalls.length > 0) {
  // Mark all parallel calls as in_progress
  TodoWrite({
    todos: executionCalls.map(call => ({
      content: `${call.executionType === "parallel" ? "⚡" : "→"} ${call.id} [${call.executionType}] (${call.tasks.length} tasks)`,
      status: call.executionType === "parallel" ? "in_progress" : "pending",
      activeForm: `Executing ${call.id}`
    }))
  })

  // Launch all parallel batches using single message with multiple tool calls
  // Use Task tool or Bash tool to launch each parallel execution
  // Collect results as they complete

  parallelResults = await Promise.all(parallelCalls.map(call => executeBatch(call)))
  previousExecutionResults.push(...parallelResults)

  // Mark parallel calls as completed
  TodoWrite({
    todos: executionCalls.map(call => ({
      content: `${call.executionType === "parallel" ? "⚡" : "→"} ${call.id} [${call.executionType}] (${call.tasks.length} tasks)`,
      status: parallelCalls.includes(call) ? "completed" : "pending",
      activeForm: `Executing ${call.id}`
    }))
  })
}

// Phase 2: Execute sequential batches in order
for (const call of sequentialCalls) {
  // Update TodoWrite: mark current sequential call in_progress
  TodoWrite({
    todos: executionCalls.map(c => ({
      content: `${c.executionType === "parallel" ? "⚡" : "→"} ${c.id} [${c.executionType}] (${c.tasks.length} tasks)`,
      status: c === call ? "in_progress" : (parallelCalls.includes(c) ? "completed" : "pending"),
      activeForm: `Executing ${c.id}`
    }))
  })

  // Launch sequential execution with previousExecutionResults context
  result = await executeBatch(call)
  previousExecutionResults.push(result)

  // Update TodoWrite: mark completed
  TodoWrite({
    todos: executionCalls.map(c => ({
      content: `${c.executionType === "parallel" ? "⚡" : "→"} ${c.id} [${c.executionType}] (${c.tasks.length} tasks)`,
      status: c.id <= call.id ? "completed" : "pending",
      activeForm: `Executing ${c.id}`
    }))
  })
}
```

**Important Notes**:
- Parallel batches use single Claude message with multiple Bash/Task tool calls
- CLI tools (Codex/Gemini/Qwen) execute in foreground (NOT background)
- Each batch receives `previousExecutionResults` for context continuity

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

  ## Code Context
  ${explorationContext || "No exploration performed"}

  ${clarificationContext ? `\n## Clarifications\n${JSON.stringify(clarificationContext, null, 2)}` : ''}

  ${executionContext?.session?.artifacts ? `\n## Planning Artifacts
  Detailed planning context available in:
  ${executionContext.session.artifacts.exploration ? `- Exploration: ${executionContext.session.artifacts.exploration}` : ''}
  - Plan: ${executionContext.session.artifacts.plan}
  - Task: ${executionContext.session.artifacts.task}

  Read these files for detailed architecture, patterns, and constraints.` : ''}

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

### Code Context from Exploration
${explorationContext ? `
Project Structure: ${explorationContext.project_structure || 'Standard structure'}
Relevant Files: ${explorationContext.relevant_files?.join(', ') || 'TBD'}
Current Patterns: ${explorationContext.patterns || 'Follow existing conventions'}
Integration Points: ${explorationContext.dependencies || 'None specified'}
Constraints: ${explorationContext.constraints || 'None'}
` : 'No prior exploration - analyze codebase as needed'}

${clarificationContext ? `\n### User Clarifications\n${Object.entries(clarificationContext).map(([q, a]) => `${q}: ${a}`).join('\n')}` : ''}

${executionContext?.session?.artifacts ? `\n### Planning Artifact Files
Detailed planning context available in session folder:
${executionContext.session.artifacts.exploration ? `- Exploration: ${executionContext.session.artifacts.exploration}` : ''}
- Plan: ${executionContext.session.artifacts.plan}
- Task: ${executionContext.session.artifacts.task}

Read these files for complete architecture details, code patterns, and integration constraints.
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

### Step 4: Track Execution Progress

**Real-time TodoWrite Updates** at batch level:

```javascript
// Parallel batches executing concurrently
TodoWrite({
  todos: [
    { content: "⚡ [P1] [Parallel] (4 tasks)", status: "in_progress", activeForm: "Executing P1" },
    { content: "⚡ [P2] [Parallel] (3 tasks)", status: "in_progress", activeForm: "Executing P2" },
    { content: "→ [S1] [Sequential] (2 tasks)", status: "pending", activeForm: "..." }
  ]
})

// After parallel completion, sequential execution
TodoWrite({
  todos: [
    { content: "⚡ [P1] [Parallel] (4 tasks)", status: "completed", activeForm: "..." },
    { content: "⚡ [P2] [Parallel] (3 tasks)", status: "completed", activeForm: "..." },
    { content: "→ [S1] [Sequential] (2 tasks)", status: "in_progress", activeForm: "Executing S1" }
  ]
})
```

**User Visibility**:
- Parallel batches show simultaneous execution (multiple "in_progress" at once)
- Sequential batches execute one at a time
- Icons distinguish parallel (⚡) from sequential (→)
- Task count shows batch size for each execution group

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

### Execution Intelligence

1. **Intelligent Task Grouping**: Dependency-aware task allocation
   - Same file modifications → Sequential batch
   - Different files + no dependencies → Parallel batch
   - Respects batch limits: Agent (7 tasks), CLI (4 tasks)
   - Infers dependencies from file paths and keywords

2. **Parallel Execution**: Maximize throughput for independent tasks
   - All parallel batches launch simultaneously
   - No concurrency limit for CLI tools
   - Reduces total execution time for independent work
   - Uses single Claude message with multiple tool calls

3. **Context Continuity**: Each batch receives previous results
   - Prevents duplication across batches
   - Maintains coherent implementation flow
   - Builds on completed work from parallel/sequential batches

4. **Flexible Execution**: Multiple input modes supported
   - In-memory: Seamless lite-plan integration
   - Prompt: Quick standalone execution
   - File: Intelligent format detection
     - Enhanced Task JSON (lite-plan export): Full plan extraction
     - Plain text: Uses as prompt

### Task Management

1. **Smart Batch Creation**: Automatic dependency analysis
   - File path extraction and comparison
   - Keyword-based dependency inference
   - Context signature grouping (same files = sequential)
   - Batch size optimization per execution method

2. **Live Progress Tracking**: Real-time batch-level updates
   - Visual distinction: ⚡ (parallel) vs → (sequential)
   - Shows concurrent execution for parallel batches
   - Clear batch completion tracking
   - Task count per batch for progress visibility

3. **Execution Strategies**:
   - Parallel-first: All independent batches execute concurrently
   - Sequential-after: Dependent batches execute in order
   - Context passing: Each batch receives all previous results

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
