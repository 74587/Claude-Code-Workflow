---
name: lite-execute
description: Execute tasks based on in-memory plan, prompt description, or file content
argument-hint: "[--in-memory] [\"task description\"|file-path]"
allowed-tools: TodoWrite(*), Task(*), Bash(*)
---

# Workflow Lite-Execute Command (/workflow:lite-execute)

## Overview

Flexible task execution command supporting three input modes: in-memory plan (from lite-plan), direct prompt description, or file content (file input is equivalent to prompt). Handles execution orchestration, progress tracking, and optional code review.

## Core Functionality

- **Multi-Mode Input**: Three ways to specify what to execute
  - `--in-memory`: Use plan from memory (called by lite-plan)
  - Prompt description: Direct task execution with simple planning
  - File path: Read file content as prompt (equivalent to Mode 2)
- **Execution Orchestration**: Launch Agent or Codex with full context
- **Live Progress Tracking**: Real-time TodoWrite updates at execution call level
- **Optional Code Review**: Post-execution quality analysis with selected tool

## Usage

### Command Syntax
```bash
/workflow:lite-execute [FLAGS] <INPUT>

# Flags
--in-memory                Use plan from memory (called by lite-plan)

# Arguments
<input>                    Task description string, or path to file containing task description or Enhanced Task JSON (required)
```

## Data Structures

### Input Data (from lite-plan)

**executionContext** (Mode 1: --in-memory):
- Passed from lite-plan via global variable
- Contains: `planObject`, `explorationContext`, `clarificationContext`, `executionMethod`, `codeReviewTool`, `originalUserInput`

**Enhanced Task JSON file parsing** (Mode 3: file input):
- **When detected**: File is valid JSON with `meta.workflow === "lite-plan"` (exported by lite-plan)
- **Extracted fields**: `planObject` (from `context.plan`), `explorationContext` (from `context.exploration`), `clarificationContext` (from `context.clarifications`), `originalUserInput` (from `title`)
- **Otherwise**: File content treated as plain text prompt

### Output Data (produced by lite-execute)

**executionResult**:
```javascript
{
  executionId: string,                 // e.g., "[Agent-1]", "[Codex-1]"
  status: "completed" | "partial" | "failed",
  tasksSummary: string,                // Brief description of tasks handled
  completionSummary: string,           // What was completed
  keyOutputs: string,                  // Files created/modified, key changes
  notes: string                        // Any important context for next execution
}
```

Collected after each execution call completes and appended to `previousExecutionResults` array for context continuity in multi-execution scenarios.

---

## Input Modes

#### Mode 1: In-Memory Plan

**Trigger**: Called by lite-plan after Phase 4 approval

**Input Source**: `executionContext` global variable set by lite-plan

**Expected Structure**: See [executionContext](#executioncontext) in Data Structures section

**Behavior**:
- Skip execution method selection (already set)
- Directly proceed to execution with full context

#### Mode 2: Prompt Description

**Trigger**: User calls with task description string

**Input**: Simple task description (e.g., "Add unit tests for auth module")

**Behavior**:
- Store user's prompt as `originalUserInput`
- Create simple execution plan from prompt
- Ask user to select execution method (Agent/Codex/Auto)
- Ask user about code review preference
- Proceed to execution with `originalUserInput` included

**AskUserQuestion Call**:
```javascript
AskUserQuestion({
  questions: [
    {
      question: "Select execution method for this task:",
      header: "Execution",
      multiSelect: false,
      options: [
        { label: "Agent", description: "Execute with @code-developer agent" },
        { label: "Codex", description: "Execute with codex CLI tool" },
        { label: "Auto", description: "Auto-select based on task complexity" }
      ]
    },
    {
      question: "Enable code review after execution?",
      header: "Code Review",
      multiSelect: false,
      options: [
        { label: "Skip", description: "No review needed" },
        { label: "Gemini Review", description: "Review with Gemini CLI tool" },
        { label: "Agent Review", description: "Review with current agent" }
      ]
    }
  ]
})
```

#### Mode 3: File Content

**Trigger**: User calls with file path

**Input**: Path to file containing task description, plan, or Enhanced Task JSON

**Behavior**:

**Step 3.1: Read and Detect File Format**
```javascript
fileContent = Read(filePath)

// Attempt to parse as JSON
try {
  jsonData = JSON.parse(fileContent)

  // Check if it's Enhanced Task JSON from lite-plan
  if (jsonData.meta?.workflow === "lite-plan") {
    // Extract plan data from Enhanced Task JSON
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
    originalUserInput = jsonData.title  // Original task description

    // Set detected format flag
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

**Step 3.2: Create Execution Plan**

If `isEnhancedTaskJson === true`:
- Use extracted `planObject` directly
- Skip planning, use lite-plan's existing plan
- User still selects execution method and code review

If `isEnhancedTaskJson === false`:
- Create simple execution plan from file content (treated as prompt)
- Same behavior as Mode 2

**Step 3.3: User Interaction**
- Ask user to select execution method (Agent/Codex/Auto)
- Ask user about code review preference
- Proceed to execution with full context

**Note**:
- Enhanced Task JSON format from lite-plan is automatically recognized and parsed
- Other file formats (plain text, markdown, etc.) are treated as prompts
- All extracted data stored in `originalUserInput` for execution reference

## Execution Process

### Workflow Overview

```
Input Processing
    |
    v
[Mode Detection]
    ├─ --in-memory → Load from executionContext variable
    ├─ File path → Read and detect format
    │   ├─ Enhanced Task JSON (lite-plan export) → Extract plan data
    │   └─ Plain text/other → Use as prompt
    └─ String → Use as prompt directly
    |
    v
[Execution Method Selection]
    ├─ --in-memory: Already set (skip)
    └─ Others (file/prompt): AskUserQuestion for method + review
    |
    v
[Execution & Progress Tracking]
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
- Set up previousExecutionResults array

```javascript
// Initialize result tracking
previousExecutionResults = []
```

### Step 2: Create TodoWrite Execution List

**Operations**:
- Create execution tracking from task list
- Typically single execution call for all tasks
- May split into multiple calls if task list is very large (>10 tasks)

```javascript
// Create execution calls (usually 1-2 calls total)
executionCalls = createExecutionCalls(planObject.tasks).map((call, index) => ({
  ...call,
  id: `[${call.method}-${index+1}]`  // Store ID for result collection
}))

// Create TodoWrite execution list
TodoWrite({
  todos: executionCalls.map(call => ({
    content: `${call.id} (${call.taskSummary})`,
    status: "pending",
    activeForm: `Executing ${call.id} (${call.taskSummary})`
  }))
})
```

**Example Execution List**:
```
[ ] [Agent-1] (Implement all planned tasks)
```

Or for large task sets:
```
[ ] [Agent-1] (Tasks 1-5: Core implementation)
[ ] [Agent-2] (Tasks 6-10: Tests and documentation)
```

### Step 3: Launch Execution

**IMPORTANT**: CLI execution MUST run in foreground (no background execution)

**Execution Loop**:
```javascript
// Execute each call in the execution list sequentially
for (currentIndex = 0; currentIndex < executionCalls.length; currentIndex++) {
  const currentCall = executionCalls[currentIndex]

  // Update TodoWrite: mark current call as in_progress
  // Launch execution with previousExecutionResults context
  // After completion, collect result and add to previousExecutionResults
  // Update TodoWrite: mark current call as completed
}
```

Based on execution method selection, launch appropriate execution:

#### Option A: Agent Execution

**When to use**:
- executionMethod = "Agent"
- executionMethod = "Auto" AND complexity = "Low"

**Agent Call**:
```javascript
Task(
  subagent_type="code-developer",
  description="Implement planned tasks with progress tracking",
  prompt=`
  ${originalUserInput ? `## Original User Request\n${originalUserInput}\n\n` : ''}

  ## Implementation Plan

  Summary: ${planObject.summary}

  Task Breakdown:
  ${planObject.tasks.map((t, i) => `${i+1}. ${t}`).join('\n')}

  ${previousExecutionResults.length > 0 ? `\n## Previous Execution Results\n${previousExecutionResults.map(result => `
[${result.executionId}] ${result.status}
Tasks handled: ${result.tasksSummary}
Completion status: ${result.completionSummary}
Key outputs: ${result.keyOutputs || 'See git diff for details'}
${result.notes ? `Notes: ${result.notes}` : ''}
  `).join('\n---\n')}` : ''}

  ## Implementation Approach
  ${planObject.approach}

  ## Code Context
  ${explorationContext || "No exploration performed"}

  ${clarificationContext ? `\n## Clarifications\n${JSON.stringify(clarificationContext, null, 2)}` : ''}

  ## Instructions
  - Reference the original user request above to ensure alignment with user intent
  - Review previous execution results to understand what's already completed
  - Build on previous work and avoid duplication
  - Test functionality as you go
  - Complete all tasks listed above
  `
)
```

**Note**: `originalUserInput` is the user's original prompt (Mode 2), file content (Mode 3 plain text), or task title (Mode 3 Enhanced Task JSON). For Mode 1 (--in-memory), this may be null if not provided by lite-plan.

**Execution Result Collection**: After agent execution completes, collect result following [executionResult](#executionresult) structure in Data Structures section and append to `previousExecutionResults` array

#### Option B: CLI Execution (Codex)

**When to use**:
- executionMethod = "Codex"
- executionMethod = "Auto" AND complexity = "Medium" or "High"

**Command Format**:
```bash
codex --full-auto exec "
${originalUserInput ? `## Original User Request\n${originalUserInput}\n\n` : ''}

## Implementation Plan

TASK: ${planObject.summary}

### Task Breakdown
${planObject.tasks.map((t, i) => `${i+1}. ${t}`).join('\n')}

${previousExecutionResults.length > 0 ? `\n### Previous Execution Results\n${previousExecutionResults.map(result => `
[${result.executionId}] ${result.status}
Tasks: ${result.tasksSummary}
Status: ${result.completionSummary}
Outputs: ${result.keyOutputs || 'See git diff'}
${result.notes ? `Notes: ${result.notes}` : ''}
`).join('\n---\n')}

IMPORTANT: Review previous results above. Build on completed work. Avoid duplication.
` : ''}

### Implementation Approach
${planObject.approach}

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
- Reference the original user request above to ensure alignment with user intent
- Review previous execution results for context continuity
- Build on previous work, don't duplicate completed tasks
- Complete all assigned tasks in single execution
- Test functionality as you implement

Complexity: ${planObject.complexity}
" --skip-git-repo-check -s danger-full-access
```

**Note**: `originalUserInput` is the user's original prompt (Mode 2), file content (Mode 3 plain text), or task title (Mode 3 Enhanced Task JSON). For Mode 1 (--in-memory), this may be null if not provided by lite-plan.

**Execution with Progress Tracking**:
```javascript
// Launch CLI in foreground (NOT background)
bash_result = Bash(
  command=cli_command,
  timeout=600000  // 10 minutes
)

// Update TodoWrite when CLI execution call completes
```

**Execution Result Collection**: After CLI execution completes, analyze output and collect result following [executionResult](#executionresult) structure in Data Structures section

### Step 4: Track Execution Progress

**Real-time TodoWrite Updates**:

Track at **execution call level** (not individual tasks):

```javascript
// When execution call starts
TodoWrite({
  todos: [
    { content: "[Agent-1] (Implement auth service + Create JWT utilities)", status: "in_progress", activeForm: "Executing [Agent-1] (Implement auth service + Create JWT utilities)" },
    { content: "[Agent-2] (Add middleware + Update routes)", status: "pending", activeForm: "Executing [Agent-2] (Add middleware + Update routes)" },
    { content: "[Codex-1] (Add integration tests)", status: "pending", activeForm: "Executing [Codex-1] (Add integration tests)" }
  ]
})

// When execution call completes
TodoWrite({
  todos: [
    { content: "[Agent-1] (Implement auth service + Create JWT utilities)", status: "completed", activeForm: "Executing [Agent-1] (Implement auth service + Create JWT utilities)" },
    { content: "[Agent-2] (Add middleware + Update routes)", status: "in_progress", activeForm: "Executing [Agent-2] (Add middleware + Update routes)" },
    { content: "[Codex-1] (Add integration tests)", status: "pending", activeForm: "Executing [Codex-1] (Add integration tests)" }
  ]
})
```

**User Visibility**:
- User sees **execution call progress** (not individual task progress)
- Current execution highlighted as "in_progress"
- Completed executions marked with checkmark
- Pending executions remain unchecked
- Each execution shows **task summary** for context

### Step 5: Code Review (Optional)

**Skip Condition**: Only run if codeReviewTool ≠ "Skip"

**Operations**:
- If "Agent Review": Current agent performs direct code review analysis
- If "Gemini Review": Execute gemini CLI with code review analysis prompt
- If custom tool (via "Other"): Execute specified CLI tool (e.g., qwen, codex)
- Review all modified files from execution
- Generate quality assessment and improvement recommendations

**Command Format**:

```bash
# Agent Review: Direct agent review (no CLI command needed)
# Uses analysis prompt and TodoWrite tools directly

# Gemini Review:
gemini -p "
PURPOSE: Code review for implemented changes
TASK: • Analyze code quality • Identify potential issues • Suggest improvements
MODE: analysis
CONTEXT: @**/* | Memory: Review changes from lite-execute execution
EXPECTED: Quality assessment with actionable recommendations
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/02-review-code-quality.txt) | Focus on recent changes | analysis=READ-ONLY
"

# Qwen Review (custom tool via "Other"):
qwen -p "
PURPOSE: Code review for implemented changes
TASK: • Analyze code quality • Identify potential issues • Suggest improvements
MODE: analysis
CONTEXT: @**/* | Memory: Review changes from lite-execute execution
EXPECTED: Quality assessment with actionable recommendations
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/02-review-code-quality.txt) | Focus on recent changes | analysis=READ-ONLY
"

# Codex Review (custom tool via "Other"):
codex --full-auto exec "Review the recent code changes for quality, potential issues, and improvements" --skip-git-repo-check -s danger-full-access
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

3. **Flexible Execution**: Supports multiple input modes
   - In-memory: Seamless integration with lite-plan
   - Prompt: Quick standalone execution
   - File: Intelligent format detection
     - Enhanced Task JSON (lite-plan export): Extracts full plan context
     - Plain text: Uses as prompt for execution

### Task Management

1. **Live Progress Updates**: Real-time TodoWrite tracking
   - Execution calls created before execution starts
   - Updated as executions progress
   - Clear completion status

2. **Simple Execution**: Straightforward task handling
   - All tasks in single execution call (typical)
   - Split only for very large task sets (>10 tasks)
   - Agent/Codex determines optimal execution order

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Missing executionContext | --in-memory called without context | Display error: "No execution context found. This mode is only available when called by lite-plan." |
| File not found | File path doesn't exist | Display error: "File not found: {path}. Please check the file path." |
| Empty file | File exists but has no content | Display error: "File is empty: {path}. Please provide task description." |
| Invalid Enhanced Task JSON | JSON parsing succeeds but missing required fields | Display warning: "File appears to be Enhanced Task JSON but missing required fields. Treating as plain text prompt." |
| Malformed JSON | JSON parsing fails | Treat as plain text prompt, no error displayed (expected behavior for non-JSON files) |
| Execution failure | Agent/Codex crashes or errors | Display error details, save partial progress, suggest retry |
| Codex unavailable | Codex tool not installed | Show installation instructions, offer Agent execution |

