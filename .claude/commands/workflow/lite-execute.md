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

### Step 2: Create TodoWrite Execution List

**Operations**:
- Create execution tracking from task list
- Typically single execution call for all tasks
- Split into multiple calls if task list very large (>10 tasks)

**Execution Call Creation**:
```javascript
function createExecutionCalls(tasks) {
  const taskTitles = tasks.map(t => t.title || t)

  // Single call for ≤10 tasks (most common)
  if (tasks.length <= 10) {
    return [{
      method: executionMethod === "Codex" ? "Codex" : "Agent",
      taskSummary: taskTitles.length <= 3
        ? taskTitles.join(', ')
        : `${taskTitles.slice(0, 2).join(', ')}, and ${taskTitles.length - 2} more`,
      tasks: tasks
    }]
  }

  // Split into multiple calls for >10 tasks
  const callSize = 5
  const calls = []
  for (let i = 0; i < tasks.length; i += callSize) {
    const batchTasks = tasks.slice(i, i + callSize)
    const batchTitles = batchTasks.map(t => t.title || t)
    calls.push({
      method: executionMethod === "Codex" ? "Codex" : "Agent",
      taskSummary: `Tasks ${i + 1}-${Math.min(i + callSize, tasks.length)}: ${batchTitles[0]}...`,
      tasks: batchTasks
    })
  }
  return calls
}

// Create execution calls with IDs
executionCalls = createExecutionCalls(planObject.tasks).map((call, index) => ({
  ...call,
  id: `[${call.method}-${index+1}]`
}))

// Create TodoWrite list
TodoWrite({
  todos: executionCalls.map(call => ({
    content: `${call.id} (${call.taskSummary})`,
    status: "pending",
    activeForm: `Executing ${call.id} (${call.taskSummary})`
  }))
})
```

**Example Execution Lists**:
```
Single call (typical):
[ ] [Agent-1] (Create AuthService, Add JWT utilities, Implement middleware)

Few tasks:
[ ] [Codex-1] (Create AuthService, Add JWT utilities, and 3 more)

Large task sets (>10):
[ ] [Agent-1] (Tasks 1-5: Create AuthService, Add JWT utilities, ...)
[ ] [Agent-2] (Tasks 6-10: Create tests, Update docs, ...)
```

### Step 3: Launch Execution

**IMPORTANT**: CLI execution MUST run in foreground (no background execution)

**Execution Loop**:
```javascript
for (currentIndex = 0; currentIndex < executionCalls.length; currentIndex++) {
  const currentCall = executionCalls[currentIndex]

  // Update TodoWrite: mark current call in_progress
  // Launch execution with previousExecutionResults context
  // After completion: collect result, add to previousExecutionResults
  // Update TodoWrite: mark current call completed
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

  ## Code Context
  ${explorationContext || "No exploration performed"}

  ${clarificationContext ? `\n## Clarifications\n${JSON.stringify(clarificationContext, null, 2)}` : ''}

  ## Instructions
  - Reference original request to ensure alignment
  - Review previous results to understand completed work
  - Build on previous work, avoid duplication
  - Test functionality as you implement
  - Complete all assigned tasks
  `
)
```

**Result Collection**: After completion, collect result following `executionResult` structure (see Data Structures section)

**Option B: CLI Execution (Codex)**

When to use:
- `executionMethod = "Codex"`
- `executionMethod = "Auto" AND complexity = "Medium" or "High"`

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

## Execution Instructions
- Reference original request to ensure alignment
- Review previous results for context continuity
- Build on previous work, don't duplicate completed tasks
- Complete all assigned tasks in single execution
- Test functionality as you implement

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

**Real-time TodoWrite Updates** at execution call level:

```javascript
// When call starts
TodoWrite({
  todos: [
    { content: "[Agent-1] (Implement auth + Create JWT utils)", status: "in_progress", activeForm: "..." },
    { content: "[Agent-2] (Add middleware + Update routes)", status: "pending", activeForm: "..." }
  ]
})

// When call completes
TodoWrite({
  todos: [
    { content: "[Agent-1] (Implement auth + Create JWT utils)", status: "completed", activeForm: "..." },
    { content: "[Agent-2] (Add middleware + Update routes)", status: "in_progress", activeForm: "..." }
  ]
})
```

**User Visibility**:
- User sees execution call progress (not individual task progress)
- Current execution highlighted as "in_progress"
- Completed executions marked with checkmark
- Each execution shows task summary for context

### Step 5: Code Review (Optional)

**Skip Condition**: Only run if `codeReviewTool ≠ "Skip"`

**Operations**:
- Agent Review: Current agent performs direct review
- Gemini Review: Execute gemini CLI with review prompt
- Custom tool: Execute specified CLI tool (qwen, codex, etc.)

**Command Formats**:

```bash
# Agent Review: Direct agent review (no CLI)
# Uses analysis prompt and TodoWrite tools directly

# Gemini Review:
gemini -p "
PURPOSE: Code review for implemented changes
TASK: • Analyze quality • Identify issues • Suggest improvements
MODE: analysis
CONTEXT: @**/* | Memory: Review lite-execute changes
EXPECTED: Quality assessment with recommendations
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/02-review-code-quality.txt) | Focus on recent changes | analysis=READ-ONLY
"

# Qwen Review (custom tool via "Other"):
qwen -p "
PURPOSE: Code review for implemented changes
TASK: • Analyze quality • Identify issues • Suggest improvements
MODE: analysis
CONTEXT: @**/* | Memory: Review lite-execute changes
EXPECTED: Quality assessment with recommendations
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/02-review-code-quality.txt) | Focus on recent changes | analysis=READ-ONLY
"

# Codex Review (custom tool via "Other"):
codex --full-auto exec "Review recent code changes for quality, potential issues, and improvements" --skip-git-repo-check -s danger-full-access
```

## Best Practices

### Execution Intelligence

1. **Context Continuity**: Each execution call receives previous results
   - Prevents duplication across multiple executions
   - Maintains coherent implementation flow
   - Builds on completed work

2. **Execution Call Tracking**: Progress at call level, not task level
   - Each call handles all or subset of tasks
   - Clear visibility of current execution
   - Simple progress updates

3. **Flexible Execution**: Multiple input modes supported
   - In-memory: Seamless lite-plan integration
   - Prompt: Quick standalone execution
   - File: Intelligent format detection
     - Enhanced Task JSON (lite-plan export): Full plan extraction
     - Plain text: Uses as prompt

### Task Management

1. **Live Progress Updates**: Real-time TodoWrite tracking
   - Execution calls created before execution starts
   - Updated as executions progress
   - Clear completion status

2. **Simple Execution**: Straightforward task handling
   - All tasks in single call (typical)
   - Split only for very large task sets (>10)
   - Agent/Codex determines optimal execution order

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
  originalUserInput: string
}
```

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
