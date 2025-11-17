---
name: lite-plan
description: Lightweight interactive planning workflow with in-memory planning, code exploration, and execution dispatch to lite-execute after user confirmation
argument-hint: "[-e|--explore] \"task description\"|file.md"
allowed-tools: TodoWrite(*), Task(*), SlashCommand(*), AskUserQuestion(*)
timeout: 180000
color: cyan
---

# Workflow Lite-Plan Command (/workflow:lite-plan)

## Overview

Intelligent lightweight planning command with dynamic workflow adaptation based on task complexity. Focuses on planning phases (exploration, clarification, planning, confirmation) and delegates execution to `/workflow:lite-execute`.

## Core Functionality

- **Intelligent Task Analysis**: Automatically determines if exploration/planning agents are needed
- **Dynamic Exploration**: Calls cli-explore-agent only when task requires codebase understanding
- **Interactive Clarification**: Asks follow-up questions after exploration to gather missing information
- **Adaptive Planning**:
  - Simple tasks: Direct planning by current Claude
  - Complex tasks: Delegates to cli-lite-planning-agent for detailed breakdown
- **Two-Step Confirmation**: First display complete plan as text, then collect three-dimensional input (task approval + execution method + code review tool)
- **Execution Dispatch**: Stores execution context in memory and calls `/workflow:lite-execute --in-memory` for actual implementation


## Usage

### Command Syntax
```bash
/workflow:lite-plan [FLAGS] <TASK_DESCRIPTION>

# Flags
-e, --explore              Force code exploration phase (overrides auto-detection logic)

# Arguments
<task-description>         Task description or path to .md file (required)
```


## Data Structures

All workflow phases use these standardized data structures:

### explorationContext

Exploration findings from cli-explore-agent (Phase 1):

```javascript
{
  project_structure: string,           // Overall architecture description
  relevant_files: string[],            // File paths to be modified/referenced
  patterns: string,                    // Existing patterns and conventions
  dependencies: string,                // Dependencies and integration points
  integration_points: string,          // Where this connects with existing code
  constraints: string,                 // Technical constraints
  clarification_needs: [               // Questions requiring user input
    {
      question: string,
      context: string,
      options: string[]
    }
  ]
}
```

### planObject

Implementation plan from Phase 3:

```javascript
{
  summary: string,                     // 2-3 sentence overview
  approach: string,                    // High-level implementation strategy
  tasks: [                             // 3-10 structured task objects
    {
      title: string,                   // Task title (e.g., "Create AuthService")
      file: string,                    // Target file path
      action: string,                  // Action type: Create|Update|Implement|Refactor|Add|Delete
      description: string,             // What to implement (1-2 sentences)
      implementation: string[],        // Step-by-step how to do it (3-7 steps)
      reference: {                     // What to reference
        pattern: string,               // Pattern name (e.g., "UserService pattern")
        files: string[],               // Reference file paths
        examples: string               // Specific guidance on what to copy/follow
      },
      acceptance: string[]             // Verification criteria (2-4 items)
    }
  ],
  estimated_time: string,              // Total implementation time estimate
  recommended_execution: string,       // "Agent" (Low) or "Codex" (Medium/High)
  complexity: string                   // "Low" | "Medium" | "High"
}
```

### executionContext

Context passed to lite-execute via --in-memory (Phase 5):

```javascript
{
  planObject: {                        // Complete planObject structure (see above)
    summary: string,
    approach: string,
    tasks: [                           // Array of structured task objects (7 fields each)
      {
        title: string,
        file: string,
        action: string,
        description: string,
        implementation: string[],
        reference: {
          pattern: string,
          files: string[],
          examples: string
        },
        acceptance: string[]
      }
    ],
    estimated_time: string,
    recommended_execution: string,
    complexity: string
  },
  explorationContext: {...} | null,    // See explorationContext structure above
  clarificationContext: {...} | null,  // User responses from Phase 2
  executionMethod: "Agent" | "Codex" | "Auto",
  codeReviewTool: "Skip" | "Gemini Review" | "Agent Review" | string,
  originalUserInput: string            // User's original task description
}
```

### Enhanced Task JSON Export

When user selects "Export JSON", lite-plan exports an enhanced structure aligned with Enhanced Task JSON Schema:

```json
{
  "id": "LP-{timestamp}",
  "title": "Original task description",
  "status": "pending",

  "meta": {
    "type": "planning",
    "created_at": "ISO timestamp",
    "complexity": "Low|Medium|High",
    "estimated_time": "X minutes",
    "recommended_execution": "Agent|Codex",
    "workflow": "lite-plan"
  },

  "context": {
    "requirements": ["Original task description"],
    "plan": {
      "summary": "2-3 sentence overview",
      "approach": "High-level implementation strategy",
      "tasks": [
        {
          "title": "Task 1 title",
          "file": "src/path/to/file.ts",
          "action": "Create|Update|Implement|...",
          "description": "What to implement",
          "implementation": ["Step 1", "Step 2", "..."],
          "reference": {
            "pattern": "Pattern name",
            "files": ["ref/file1.ts", "ref/file2.ts"],
            "examples": "Specific guidance"
          },
          "acceptance": ["Criterion 1", "Criterion 2", "..."]
        }
      ]
    },
    "exploration": {
      "project_structure": "...",
      "relevant_files": ["file1.ts", "file2.ts"],
      "patterns": "...",
      "dependencies": "...",
      "integration_points": "...",
      "constraints": "..."
    } | null,
    "clarifications": {
      "question1": "answer1",
      "question2": "answer2"
    } | null,
    "focus_paths": ["src/auth", "tests/auth"],
    "acceptance": ["Task completion criteria from plan.tasks"]
  }
}
```

**Schema Alignment Notes**:
- Aligns with Enhanced Task JSON Schema (6-field structure)
- `context_package_path` omitted (lite-plan doesn't use context packages)
- `flow_control` omitted (execution handled by lite-execute)
- `focus_paths` derived from `exploration.relevant_files`
- `acceptance` derived from `plan.tasks`

---

## Execution Process

### Workflow Overview

```
User Input ("/workflow:lite-plan \"task\"")
    |
    v
[Phase 1] Task Analysis & Exploration Decision (10-20 seconds)
    -> Analyze task description
    -> Decision: Need exploration? (Yes/No)
    -> If Yes: Launch cli-explore-agent
    -> Output: explorationContext (if performed)
    |
    v
[Phase 2] Clarification (Optional, user interaction)
    -> If exploration revealed ambiguities or missing info
    -> AskUserQuestion: Gather clarifications
    -> Update task context with user responses
    -> If no clarification needed: Skip to Phase 3
    |
    v
[Phase 3] Complexity Assessment & Planning (20-60 seconds)
    -> Assess task complexity (Low/Medium/High)
    -> Decision: Planning strategy
       - Low: Direct planning (current Claude)
       - Medium/High: Delegate to cli-lite-planning-agent
    -> Output: planObject
    |
    v
[Phase 4] Task Confirmation & Execution Selection (User interaction)
    -> Step 4.1: Output complete plan as text to user
    -> Step 4.2: AskUserQuestion with four dimensions
       1. Confirm task: Allow/Modify/Cancel (multi-select, can supplement via Other)
       2. Execution method: Agent/Codex/Auto (single-select, auto: simple→agent, complex→codex)
       3. Code review: Skip/Gemini/Agent/Other (single-select, can specify custom tool via Other)
       4. Export JSON: Yes/No (single-select, export enhanced task JSON)
    -> Process selections and proceed to Phase 5
    -> If cancel: Exit
    |
    v
[Phase 5] Dispatch to Execution
    -> Export enhanced task JSON (optional, if user selected "Yes")
    -> Store executionContext in memory
    -> Call /workflow:lite-execute --in-memory
    -> Execution delegated to lite-execute command
    |
    v
Planning Complete (Execution continues in lite-execute)
```

### Task Management Pattern

- lite-plan focuses on planning phases (1-4) with TodoWrite tracking
- Phase 5 stores execution context and dispatches to lite-execute
- Execution tracking (TodoWrite updates, progress monitoring) handled by lite-execute
- Optional enhanced task JSON export aligned with Enhanced Task JSON Schema
- Execution artifacts (code changes, test results) managed by lite-execute

## Detailed Phase Execution

### Phase 1: Task Analysis & Exploration Decision

**Operations**:
- Analyze task description to determine if code exploration is needed
- Decision logic:
  ```javascript
  needsExploration = (
    flags.includes('--explore') || flags.includes('-e') ||  // Force exploration if flag present
    (
      task.mentions_specific_files ||
      task.requires_codebase_context ||
      task.needs_architecture_understanding ||
      task.modifies_existing_code
    )
  )
  ```

**Decision Criteria**:

| Task Type | Needs Exploration | Reason |
|-----------|-------------------|--------|
| Any task with `-e` or `--explore` flag | **Yes (forced)** | **Flag overrides auto-detection logic** |
| "Implement new feature X" | Maybe | Depends on integration with existing code |
| "Refactor module Y" | Yes | Needs understanding of current implementation |
| "Add tests for Z" | Yes | Needs to understand code structure |
| "Create new standalone utility" | No | Self-contained, no existing code context |
| "Update documentation" | No | Doesn't require code exploration |
| "Fix bug in function F" | Yes | Needs to understand implementation |

**If Exploration Needed**:
- Launch cli-explore-agent with task-specific focus
- Agent call format:
  ```javascript
  Task(
    subagent_type="cli-explore-agent",
    description="Analyze codebase for task context",
    prompt=`
    Task: ${task_description}

    Analyze and return the following information in structured format:
    1. Project Structure: Overall architecture and module organization
    2. Relevant Files: List of files that will be affected by this task (with paths)
    3. Current Implementation Patterns: Existing code patterns, conventions, and styles
    4. Dependencies: External dependencies and internal module dependencies
    5. Integration Points: Where this task connects with existing code
    6. Architecture Constraints: Technical limitations or requirements
    7. Clarification Needs: Ambiguities or missing information requiring user input

    Time Limit: 60 seconds

    Output Format: Return a JSON-like structured object with the above fields populated.
    Include specific file paths, pattern examples, and clear questions for clarifications.
    `
  )
  ```

**Expected Return Structure**: See [explorationContext](#explorationcontext) in Data Structures section

**Output Processing**:
- Store exploration findings in `explorationContext`
- Extract `clarification_needs` array from exploration results
- Set `needsClarification = (clarification_needs.length > 0)`
- Use clarification_needs to generate Phase 2 questions

**Progress Tracking**:
- Mark Phase 1 as completed
- If needsClarification: Mark Phase 2 as in_progress
- Else: Skip to Phase 3

**Expected Duration**: 10-20 seconds (analysis) + 30-60 seconds (exploration if needed)

---

### Phase 2: Clarification (Optional)

**Skip Condition**: Only run if Phase 1 set `needsClarification = true`

**Operations**:
- Review `explorationContext.clarification_needs` from Phase 1
- Generate AskUserQuestion based on exploration findings
- Focus on ambiguities that affect implementation approach

**AskUserQuestion Call** (simplified reference):
```javascript
// Use clarification_needs from exploration to build questions
AskUserQuestion({
  questions: explorationContext.clarification_needs.map(need => ({
    question: `${need.context}\n\n${need.question}`,
    header: "Clarification",
    multiSelect: false,
    options: need.options.map(opt => ({
      label: opt,
      description: `Use ${opt} approach`
    }))
  }))
})
```

**Output Processing**:
- Collect user responses and store in `clarificationContext`
- Format: `{ question_id: selected_answer, ... }`
- This context will be passed to Phase 3 planning

**Progress Tracking**:
- Mark Phase 2 as completed
- Mark Phase 3 as in_progress

**Expected Duration**: User-dependent (typically 30-60 seconds)

---

### Phase 3: Complexity Assessment & Planning

**Operations**:
- Assess task complexity based on multiple factors
- Select appropriate planning strategy
- Generate task breakdown using selected method

**Complexity Assessment Factors**:
```javascript
complexityScore = {
  file_count: exploration.files_to_modify.length,
  integration_points: exploration.dependencies.length,
  architecture_changes: exploration.requires_architecture_change,
  technology_stack: exploration.unfamiliar_technologies.length,
  task_scope: (task.estimated_steps > 5),
  cross_cutting_concerns: exploration.affects_multiple_modules
}

// Calculate complexity
if (complexityScore < 3) complexity = "Low"
else if (complexityScore < 6) complexity = "Medium"
else complexity = "High"
```

**Complexity Levels**:

| Level | Characteristics | Planning Strategy |
|-------|----------------|-------------------|
| Low | 1-2 files, simple changes, clear requirements | Direct planning (current Claude) |
| Medium | 3-5 files, moderate integration, some ambiguity | Delegate to cli-lite-planning-agent |
| High | 6+ files, complex architecture, high uncertainty | Delegate to cli-lite-planning-agent with detailed analysis |

**Planning Execution**:

**Option A: Direct Planning (Low Complexity)**

Current Claude generates plan directly following these guidelines:
- **Summary**: 2-3 sentence overview of the implementation
- **Approach**: High-level implementation strategy
- **Task Breakdown**: 3-5 specific, actionable tasks with file paths
- **Estimated Time**: Total implementation time estimate
- **Recommended Execution**: "Agent" (for Low complexity tasks)

**Option B: Agent-Based Planning (Medium/High Complexity)**

Delegate to cli-lite-planning-agent with detailed requirements:
```javascript
Task(
  subagent_type="cli-lite-planning-agent",
  description="Generate detailed implementation plan",
  prompt=`
  ## Task Description
  ${task_description}

  ## Exploration Context
  ${JSON.stringify(explorationContext, null, 2) || "No exploration performed"}

  ## User Clarifications
  ${JSON.stringify(clarificationContext, null, 2) || "None provided"}

  ## Complexity Level
  ${complexity}

  ## Your Task
  1. Execute CLI planning analysis using Gemini (Qwen as fallback)
  2. Parse CLI output and extract structured plan
  3. Enhance tasks to be actionable with file paths and pattern references
  4. Generate planObject with:
     - Summary (2-3 sentences)
     - Approach (high-level strategy)
     - Tasks (3-10 actionable steps with file paths)
     - Estimated time (with breakdown if available)
     - Recommended execution method (Agent for Low, Codex for Medium/High)
  5. Return planObject (no file writes)

  ## Quality Requirements
  Each task MUST include:
  - Action verb (Create, Update, Add, Implement, Refactor)
  - Specific file path
  - Detailed changes
  - Pattern reference from exploration context

  Format: "{Action} in {file_path}: {specific_details} following {pattern}"
  `
)
```

**Expected Return Structure (Both Options)**: See [planObject](#planobject) in Data Structures section

**Progress Tracking**:
- Mark Phase 3 as completed
- Mark Phase 4 as in_progress

**Expected Duration**:
- Low complexity: 20-30 seconds (direct)
- Medium/High complexity: 40-60 seconds (agent-based)

---

### Phase 4: Task Confirmation & Execution Selection

**User Interaction Flow**: Two-step confirmation process

**Step 4.1: Display Plan Summary**

First, output the complete plan to the user as regular text:

```
## Implementation Plan

**Summary**: ${planObject.summary}

**Approach**: ${planObject.approach}

**Task Breakdown** (${planObject.tasks.length} tasks):
${planObject.tasks.map((task, i) => `
${i+1}. **${task.title}** (${task.file})
   - What: ${task.description}
   - How: ${task.implementation.length} steps
   - Reference: ${task.reference.pattern}
   - Verification: ${task.acceptance.length} criteria
`).join('')}

**Complexity**: ${planObject.complexity}
**Estimated Time**: ${planObject.estimated_time}
**Recommended Execution**: ${planObject.recommended_execution}
```

**Step 4.2: Collect User Confirmation**

After displaying the plan, collect four inputs via AskUserQuestion:

**Operations**:
- Collect four inputs:
  1. Task confirmation (multi-select: Allow/Modify/Cancel + optional supplements via "Other")
  2. Execution method (single-select: Agent/Codex/Auto)
     - Agent: Execute with @code-developer
     - Codex: Execute with codex CLI tool
     - Auto: Simple tasks (Low complexity) → Agent, Complex tasks (Medium/High) → Codex
  3. Code review tool (single-select: Skip/Gemini/Agent + custom tools via "Other")
     - Gemini Review: Use gemini CLI for code analysis
     - Agent Review: Use @code-reviewer agent
     - Other: Specify custom tool (e.g., "qwen", "codex") via text input
  4. Task JSON output (single-select: Yes/No)
     - Yes: Export plan to task JSON file for reuse or documentation
     - No: Keep plan in-memory only
- Support plan supplements and custom tool specification via "Other" input

**Four Questions in Single AskUserQuestion Call**:
- Question 1: Task confirmation (multi-select: Allow/Modify/Cancel)
- Question 2: Execution method selection (single-select: Agent/Codex/Auto)
- Question 3: Code review tool selection (single-select: Skip/Gemini/Agent, custom via "Other")
- Question 4: Task JSON output (single-select: Yes/No)

**AskUserQuestion Call**:
```javascript
AskUserQuestion({
  questions: [
    {
      question: `**Plan Summary**: ${planObject.summary}

**Tasks**: ${planObject.tasks.length} tasks | **Complexity**: ${planObject.complexity} | **Estimated Time**: ${planObject.estimated_time}

Confirm this plan? (Multi-select enabled - you can select multiple options and add supplements via "Other")`,
      header: "Confirm Plan",
      multiSelect: true,
      options: [
        { label: "Allow", description: "Proceed with plan as-is" },
        { label: "Modify", description: "Adjust plan before execution" },
        { label: "Cancel", description: "Abort workflow" }
      ]
    },
    {
      question: `Select execution method:`,
      header: "Execution",
      multiSelect: false,
      options: [
        { label: "Agent", description: "Execute with @code-developer agent" },
        { label: "Codex", description: "Execute with codex CLI tool" },
        { label: "Auto", description: `Auto-select: ${planObject.complexity === 'Low' ? 'Agent (Low complexity)' : 'Codex (Medium/High complexity)'}` }
      ]
    },
    {
      question: `Enable code review after execution?

(You can specify other tools like "qwen" or "codex" via "Other" option)`,
      header: "Code Review",
      multiSelect: false,
      options: [
        { label: "Gemini Review", description: "Review with Gemini CLI tool (gemini-2.5-pro)" },
        { label: "Agent Review", description: "Review with @code-reviewer agent" },
        { label: "Skip", description: "No review needed" }
      ]
    },
    {
      question: `Export plan to task JSON file?

This allows you to reuse the plan or use it with lite-execute later.`,
      header: "Export JSON",
      multiSelect: false,
      options: [
        { label: "Yes", description: "Export plan to JSON file (recommended for complex tasks)" },
        { label: "No", description: "Keep plan in-memory only" }
      ]
    }
  ]
})
```

**Decision Flow**:
```
Task Confirmation (Multi-select):
  ├─ Allow (+ optional supplements in Other) → Proceed to Execution Method Selection
  ├─ Modify (+ optional supplements in Other) → Re-run Phase 3 with modifications
  └─ Cancel → Exit (no execution)

Execution Method Selection (Single-select):
  ├─ Agent → Launch @code-developer agent
  ├─ Codex → Execute with codex CLI tool
  └─ Auto → Automatic selection:
      ├─ If complexity = Low → Launch @code-developer agent
      └─ If complexity = Medium/High → Execute with codex CLI tool

Code Review Selection (after execution):
  ├─ Skip → Skip review, workflow complete
  ├─ Gemini Review → Run gemini code analysis (gemini-2.5-pro)
  ├─ Agent Review → Current Claude agent review
  └─ Other → Specify custom tool (e.g., "qwen", "codex") via text input

Task JSON Export:
  ├─ Yes → Export plan to JSON file before execution
  │        Format: .workflow/lite-plans/plan-{timestamp}.json
  │        Contains: planObject + explorationContext + clarificationContext
  └─ No → Keep plan in-memory only, no file export
```

**Progress Tracking**:
- Mark Phase 4 as completed
- Mark Phase 5 as in_progress

**Expected Duration**: User-dependent (1-3 minutes typical)

---

### Phase 5: Dispatch to Execution

**Operations**:
- Export plan to task JSON file (if user selected "Yes")
- Store execution context in memory variable
- Call lite-execute command with --in-memory flag
- Execution tracking delegated to lite-execute

**Step 5.1: Export Task JSON (Optional)**

**Skip Condition**: Only run if user selected "Yes" for Task JSON Export in Phase 4

**Operations**:
- Create `.workflow/lite-plans/` directory if not exists
- Generate timestamp-based filename
- Export enhanced task JSON aligned with Enhanced Task JSON Schema

```javascript
// Only execute if userSelection.export_task_json === "Yes"
if (userSelection.export_task_json === "Yes") {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const taskId = `LP-${timestamp}`
  const filename = `.workflow/lite-plans/${taskId}.json`

  const enhancedTaskJson = {
    id: taskId,
    title: original_task_description,
    status: "pending",

    meta: {
      type: "planning",
      created_at: new Date().toISOString(),
      complexity: planObject.complexity,
      estimated_time: planObject.estimated_time,
      recommended_execution: planObject.recommended_execution,
      workflow: "lite-plan"
    },

    context: {
      requirements: [original_task_description],
      plan: {
        summary: planObject.summary,
        approach: planObject.approach,
        tasks: planObject.tasks  // Array of structured task objects
      },
      exploration: explorationContext || null,
      clarifications: clarificationContext || null,
      focus_paths: explorationContext?.relevant_files || [],
      acceptance: planObject.tasks.flatMap(t => t.acceptance)  // Collect all acceptance criteria from tasks
    }
  }

  Write(filename, JSON.stringify(enhancedTaskJson, null, 2))

  // Display export confirmation to user
  console.log(`Enhanced task JSON exported to: ${filename}`)
  console.log(`You can reuse this plan with: /workflow:lite-execute ${filename}`)
}
```

**Export File Format**: See [Enhanced Task JSON Export](#enhanced-task-json-export) in Data Structures section

**Step 5.2: Store Execution Context**

Create execution context variable with all necessary information:

```javascript
// Create execution context for lite-execute
executionContext = {
  planObject: planObject,              // From Phase 3
  explorationContext: explorationContext || null,  // From Phase 1
  clarificationContext: clarificationContext || null, // From Phase 2
  executionMethod: userSelection.execution_method,    // From Phase 4
  codeReviewTool: userSelection.code_review_tool,    // From Phase 4
  originalUserInput: original_task_description        // Original user input
}
```

**Context Structure**: See [executionContext](#executioncontext) in Data Structures section

**Step 5.3: Call lite-execute**

Dispatch execution to lite-execute command:
```javascript
SlashCommand(command="/workflow:lite-execute --in-memory")
```

**Execution Handoff**:
- lite-execute reads executionContext variable
- All execution logic (TodoWrite tracking, Agent/Codex calls, code review) handled by lite-execute
- lite-plan completes after successful handoff

**Progress Tracking**:
- Mark Phase 5 as completed
- Execution tracking handed over to lite-execute
- User sees execution progress from lite-execute TodoWrite updates

**Expected Duration**: < 1 second (dispatch only, actual execution in lite-execute)

---

## Best Practices

### Workflow Intelligence

1. **Dynamic Adaptation**: Workflow automatically adjusts based on task characteristics
   - Smart exploration: Only runs when task requires codebase context
   - Adaptive planning: Simple tasks get direct planning, complex tasks use specialized agent
   - Context-aware clarification: Only asks questions when truly needed
   - Reduces unnecessary steps while maintaining thoroughness
   - **Flag-Based Control**:
     - Use `-e` or `--explore` to force exploration when:
       - Task appears simple but you know it requires codebase context
       - Auto-detection might miss subtle integration points
       - You want comprehensive code understanding before planning

2. **Progressive Clarification**: Gather information at the right time
   - Phase 1: Explore codebase to understand current state
   - Phase 2: Ask clarifying questions based on exploration findings
   - Phase 3: Plan with complete context (task + exploration + clarifications)
   - Avoids premature assumptions and reduces rework

3. **Complexity-Aware Planning**: Planning strategy matches task complexity
   - Low complexity (1-2 files): Direct planning by current Claude (fast, 20-30s)
   - Medium complexity (3-5 files): CLI planning agent (detailed, 40-50s)
   - High complexity (6+ files): CLI planning agent with risk analysis (thorough, 50-60s)
   - Balances speed and thoroughness appropriately

4. **Two-Step Confirmation Process**: Clear plan presentation followed by comprehensive control
   - **Step 1**: Display complete plan as readable text output (not embedded in question)
     - Shows summary, approach, tasks, dependencies, risks, complexity, time estimate
     - Clear separation between plan content and user interaction
   - **Step 2**: Collect three-dimensional input via AskUserQuestion
     - First dimension: Confirm/Modify/Cancel plan (multi-select with supplement via "Other")
     - Second dimension: Execution method selection (Agent/Codex/Auto)
     - Third dimension: Code review tool selection (Skip/Gemini/Agent, custom via "Other")
   - Allows plan refinement without re-selecting execution method
   - Supports iterative planning with user feedback
   - Auto mode intelligently selects execution method based on complexity
   - Custom code review tools (qwen, codex, etc.) can be specified via "Other" option

### Task Management

1. **Live Progress Tracking**: TodoWrite provides real-time execution call visibility
   - Execution calls ([Agent-1], [Codex-1], etc.) created before execution starts
   - Updated in real-time as execution calls progress
   - User sees current execution call being worked on (e.g., "[Agent-1] (Task A + Task B)")
   - Each execution call shows task summary for context
   - Clear completion status at call level (not individual task level)

2. **Phase-Based Organization**: 5 distinct phases with clear transitions
   - Phase 1: Task Analysis & Exploration (automatic)
   - Phase 2: Clarification (conditional, interactive)
   - Phase 3: Planning (automatic, adaptive)
   - Phase 4: Confirmation (interactive, two-dimensional)
   - Phase 5: Execution & Tracking (automatic with live updates)

3. **Flexible Task Counts**: Task breakdown adapts to complexity
   - Low complexity: 3-5 tasks (focused)
   - Medium complexity: 5-7 tasks (detailed)
   - High complexity: 7-10 tasks (comprehensive)
   - Avoids artificial constraints while maintaining focus

4. **Dependency Tracking**: Medium/High complexity tasks include dependencies
   - Explicit task ordering when sequence matters
   - Parallel execution hints when tasks are independent
   - Risk flagging for complex interactions
   - Helps agent/CLI execute correctly

### Planning Standards

1. **Context-Rich Planning**: Plans include all relevant context
   - Exploration findings (code structure, patterns, constraints)
   - User clarifications (requirements, preferences, decisions)
   - Complexity assessment (risks, dependencies, time estimates)
   - Execution recommendations (Direct vs CLI, specific tool)

2. **Modification Support**: Plans can be iteratively refined
   - User can request plan modifications in Phase 4
   - Feedback incorporated into re-planning
   - No need to restart from scratch
   - Supports collaborative planning workflow

3. **No File Artifacts**: All planning stays in memory
   - Faster workflow without I/O overhead
   - Cleaner workspace
   - Plan context passed directly to execution
   - Reduces complexity and maintenance

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Phase 1 Exploration Failure | cli-explore-agent unavailable or timeout | Skip exploration, set `explorationContext = null`, log warning, continue to Phase 2/3 with task description only |
| Phase 2 Clarification Timeout | User no response > 5 minutes | Use exploration findings as-is without clarification, proceed to Phase 3 with warning |
| Phase 3 Planning Agent Failure | cli-lite-planning-agent unavailable or timeout | Fallback to direct planning by current Claude (simplified plan), continue to Phase 4 |
| Phase 3 Planning Timeout | Planning takes > 90 seconds | Generate simplified direct plan, mark as "Quick Plan", continue to Phase 4 with reduced detail |
| Phase 4 Confirmation Timeout | User no response > 5 minutes | Save plan context to temporary var, display resume instructions, exit gracefully |
| Phase 4 Modification Loop | User requests modify > 3 times | Suggest breaking task into smaller pieces or using /workflow:plan for comprehensive planning |

## Input/Output

### Input Requirements
- Task description: String or path to .md file (required)
  - Should be specific and concrete
  - Can include context about existing code or requirements
  - Examples:
    - "Implement user authentication with JWT tokens"
    - "Refactor logging module for better performance"
    - "Add unit tests for authentication service"
- Flags (optional):
  - `-e` or `--explore`: Force code exploration phase (overrides auto-detection)

### Output Format

**In-Memory Plan Object**: See [planObject](#planobject) in Data Structures section

**Optional Enhanced Task JSON Export**: See [Enhanced Task JSON Export](#enhanced-task-json-export) in Data Structures section (when user selects "Export JSON")

**Execution Context**: See [executionContext](#executioncontext) in Data Structures section (passed to lite-execute)

**Execution Result**:
- Immediate dispatch to lite-execute with executionContext
- Optional enhanced task JSON file export aligned with Enhanced Task JSON Schema
- No other file artifacts generated during planning phase
- Execution starts immediately in lite-execute after context handoff
- Tool/agent handles implementation and any necessary file operations

