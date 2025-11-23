---
name: lite-plan
description: Lightweight interactive planning workflow with in-memory planning, code exploration, and execution dispatch to lite-execute after user confirmation
argument-hint: "[-e|--explore] \"task description\"|file.md"
allowed-tools: TodoWrite(*), Task(*), SlashCommand(*), AskUserQuestion(*)
---

# Workflow Lite-Plan Command (/workflow:lite-plan)

## Overview

Intelligent lightweight planning command with dynamic workflow adaptation based on task complexity. Focuses on planning phases (exploration, clarification, planning, confirmation) and delegates execution to `/workflow:lite-execute`.

**Core capabilities:**
- Intelligent task analysis with automatic exploration detection
- Dynamic code exploration (cli-explore-agent) when codebase understanding needed
- Interactive clarification after exploration to gather missing information
- Adaptive planning strategy (direct Claude vs cli-lite-planning-agent) based on complexity
- Two-step confirmation: plan display → multi-dimensional input collection
- Execution dispatch with complete context handoff to lite-execute

## Usage

### Command Syntax
```bash
/workflow:lite-plan [FLAGS] <TASK_DESCRIPTION>

# Flags
-e, --explore              Force code exploration phase (overrides auto-detection)

# Arguments
<task-description>         Task description or path to .md file (required)
```

### Input Requirements
- **Task description**: String or path to .md file (required)
  - Should be specific and concrete
  - Can include context about existing code or requirements
  - Examples:
    - "Implement user authentication with JWT tokens"
    - "Refactor logging module for better performance"
    - "Add unit tests for authentication service"
- **Flags** (optional):
  - `-e` or `--explore`: Force exploration when:
    - Task appears simple but requires codebase context
    - Auto-detection might miss integration points
    - Comprehensive code understanding needed before planning

## Execution Process

### Workflow Overview

```
User Input → Task Analysis & Exploration Decision (Phase 1)
          ↓
     Clarification (Phase 2, optional)
          ↓
     Complexity Assessment & Planning (Phase 3)
          ↓
     Task Confirmation & Execution Selection (Phase 4)
          ↓
     Dispatch to Execution (Phase 5)
          ↓
     Planning Complete (lite-execute continues)
```

### Phase Summary

**Phase 1: Task Analysis & Exploration Decision** (10-60 seconds)
- Analyze task to determine exploration needs
- Decision logic: `--explore` flag OR requires codebase context
- If needed: Launch cli-explore-agent for code analysis
- Output: `explorationContext` with relevant files, patterns, constraints

**Phase 2: Clarification** (30-60 seconds, optional)
- Skip if no ambiguities found in Phase 1
- Use exploration findings to generate targeted questions
- AskUserQuestion based on `clarification_needs` from exploration
- Output: `clarificationContext` with user responses

**Phase 3: Complexity Assessment & Planning** (20-60 seconds)
- Assess complexity (Low/Medium/High) from multiple factors
- Strategy selection:
  - Low: Direct planning by current Claude (fast, 20-30s)
  - Medium/High: Delegate to cli-lite-planning-agent (detailed, 40-60s)
- Output: `planObject` with tasks, time estimates, recommendations

**Phase 4: Task Confirmation & Execution Selection** (user interaction)
- Step 1: Display complete plan as text to user
- Step 2: Collect four inputs via AskUserQuestion:
  1. Confirm plan (Allow/Modify/Cancel + supplements via "Other")
  2. Execution method (Agent/Codex/Auto)
  3. Code review tool (Skip/Gemini/Agent + custom via "Other")
  4. Export JSON (Yes/No for Enhanced Task JSON export)

**Phase 5: Dispatch to Execution** (<1 second)
- Export Enhanced Task JSON (optional, if user selected "Yes")
- Store `executionContext` in memory with full plan + context
- Call `/workflow:lite-execute --in-memory`
- Execution tracking delegated to lite-execute

## Detailed Phase Execution

### Phase 1: Task Analysis & Exploration Decision

**Decision Logic**:
```javascript
needsExploration = (
  flags.includes('--explore') || flags.includes('-e') ||  // Force if flag present
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
| Any task with `-e`/`--explore` flag | **Yes (forced)** | **Flag overrides auto-detection** |
| "Implement new feature X" | Maybe | Depends on integration needs |
| "Refactor module Y" | Yes | Needs current implementation understanding |
| "Add tests for Z" | Yes | Needs code structure understanding |
| "Create standalone utility" | No | Self-contained, no existing context |
| "Update documentation" | No | Doesn't require code exploration |
| "Fix bug in function F" | Yes | Needs implementation understanding |

**Exploration Execution** (if needed):
```javascript
// Generate session identifiers for artifact storage
const taskSlug = task_description.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const shortTimestamp = timestamp.substring(0, 19).replace('T', '-') // YYYY-MM-DD-HH-mm-ss
const sessionId = `${taskSlug}-${shortTimestamp}`
const sessionFolder = `.workflow/.lite-plan/${sessionId}`

Task(
  subagent_type="cli-explore-agent",
  description="Analyze codebase for task context",
  prompt=`
  Task: ${task_description}

  Analyze and return structured information:
  1. Project Structure: Architecture and module organization
  2. Relevant Files: Files to be affected (with paths)
  3. Current Patterns: Code patterns, conventions, styles
  4. Dependencies: External/internal module dependencies
  5. Integration Points: Task connections with existing code
  6. Architecture Constraints: Technical limitations/requirements
  7. Clarification Needs: Ambiguities requiring user input

  Time Limit: 60 seconds
  Output Format: JSON-like structured object
  `
)

// Save exploration results for CLI/agent access in lite-execute
const explorationFile = `${sessionFolder}/exploration.json`
Write(explorationFile, JSON.stringify(explorationContext, null, 2))
```

**Output**: `explorationContext` (in-memory, see Data Structures section)
**Artifact**: Saved to `{sessionFolder}/exploration.json` for CLI/agent use

**Progress Tracking**:
- Mark Phase 1 completed
- If `clarification_needs.length > 0`: Mark Phase 2 in_progress
- Else: Skip to Phase 3

---

### Phase 2: Clarification (Optional)

**Skip Condition**: Only run if `needsClarification = true` from Phase 1

**Operations**:
- Review `explorationContext.clarification_needs`
- Generate AskUserQuestion from exploration findings
- Focus on ambiguities affecting implementation approach

**Question Generation**:
```javascript
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

**Output**: `clarificationContext` in format `{ question_id: selected_answer }`

**Progress Tracking**:
- Mark Phase 2 completed
- Mark Phase 3 in_progress

---

### Phase 3: Complexity Assessment & Planning

**Complexity Assessment**:
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
| Medium | 3-5 files, moderate integration, some ambiguity | cli-lite-planning-agent |
| High | 6+ files, complex architecture, high uncertainty | cli-lite-planning-agent with detailed analysis |

**Option A: Direct Planning (Low Complexity)**

Current Claude generates plan directly:
- Summary: 2-3 sentence overview
- Approach: High-level implementation strategy
- Task Breakdown: 3-5 specific, actionable tasks with file paths
- Estimated Time: Total implementation time
- Recommended Execution: "Agent"

```javascript
// Save planning results to session folder (same as Option B)
const planFile = `${sessionFolder}/plan.json`
Write(planFile, JSON.stringify(planObject, null, 2))
```

**Artifact**: Saved to `{sessionFolder}/plan.json` for CLI/agent use

**Option B: Agent-Based Planning (Medium/High Complexity)**

Delegate to cli-lite-planning-agent:
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
  1. Execute CLI planning using Gemini (Qwen fallback)
  2. Parse CLI output and extract structured plan
  3. Enhance tasks with file paths and pattern references
  4. Generate planObject with:
     - Summary (2-3 sentences)
     - Approach (high-level strategy)
     - Tasks (3-10 actionable steps)
     - Estimated time (with breakdown)
     - Recommended execution (Agent for Low, Codex for Medium/High)
  5. Return planObject (no file writes)

  ## Quality Requirements
  Each task MUST include:
  - Action verb (Create/Update/Add/Implement/Refactor)
  - Specific file path
  - Detailed changes
  - Pattern reference from exploration

  Format: "{Action} in {file_path}: {details} following {pattern}"
  `
)

// Save planning results to session folder
const planFile = `${sessionFolder}/plan.json`
Write(planFile, JSON.stringify(planObject, null, 2))
```

**Output**: `planObject` (see Data Structures section)
**Artifact**: Saved to `{sessionFolder}/plan.json` for CLI/agent use

**Progress Tracking**:
- Mark Phase 3 completed
- Mark Phase 4 in_progress

**Expected Duration**:
- Low: 20-30 seconds (direct)
- Medium/High: 40-60 seconds (agent-based)

---

### Phase 4: Task Confirmation & Execution Selection

**Two-Step Confirmation Process**

**Step 4.1: Display Plan Summary**

Output complete plan as regular text:

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

Three questions via single AskUserQuestion call:

```javascript
AskUserQuestion({
  questions: [
    {
      question: `**Plan Summary**: ${planObject.summary}

**Tasks**: ${planObject.tasks.length} | **Complexity**: ${planObject.complexity} | **Time**: ${planObject.estimated_time}

Confirm plan? (Multi-select: can supplement via "Other")`,
      header: "Confirm Plan",
      multiSelect: true,
      options: [
        { label: "Allow", description: "Proceed as-is" },
        { label: "Modify", description: "Adjust before execution" },
        { label: "Cancel", description: "Abort workflow" }
      ]
    },
    {
      question: "Select execution method:",
      header: "Execution",
      multiSelect: false,
      options: [
        { label: "Agent", description: "@code-developer agent" },
        { label: "Codex", description: "codex CLI tool" },
        { label: "Auto", description: `Auto: ${planObject.complexity === 'Low' ? 'Agent' : 'Codex'}` }
      ]
    },
    {
      question: "Enable code review after execution?\n\n(Custom tools via \"Other\": qwen, codex, etc.)",
      header: "Code Review",
      multiSelect: false,
      options: [
        { label: "Gemini Review", description: "Gemini CLI (gemini-2.5-pro)" },
        { label: "Agent Review", description: "@code-reviewer agent" },
        { label: "Skip", description: "No review" }
      ]
    }
  ]
})
```

**Decision Flow**:
```
Task Confirmation (Multi-select):
  ├─ Allow (+ supplements) → Execution Method Selection
  ├─ Modify (+ supplements) → Re-run Phase 3
  └─ Cancel → Exit

Execution Method (Single-select):
  ├─ Agent → Launch @code-developer
  ├─ Codex → Execute with codex CLI
  └─ Auto → Low complexity: Agent | Medium/High: Codex

Code Review (after execution):
  ├─ Skip → No review
  ├─ Gemini Review → gemini CLI analysis
  ├─ Agent Review → Current Claude review
  └─ Other → Custom tool (e.g., qwen, codex)
```

**Progress Tracking**:
- Mark Phase 4 completed
- Mark Phase 5 in_progress

---

### Phase 5: Dispatch to Execution

**Step 5.1: Export Enhanced Task JSON**

Always export Enhanced Task JSON to session folder:

```javascript
const taskId = `LP-${shortTimestamp}`
const filename = `${sessionFolder}/task.json`

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
    workflow: "lite-plan",
    session_id: sessionId,
    session_folder: sessionFolder
  },

  context: {
    requirements: [original_task_description],
    plan: {
      summary: planObject.summary,
      approach: planObject.approach,
      tasks: planObject.tasks
    },
    exploration: explorationContext || null,
    clarifications: clarificationContext || null,
    focus_paths: explorationContext?.relevant_files || [],
    acceptance: planObject.tasks.flatMap(t => t.acceptance)
  }
}

Write(filename, JSON.stringify(enhancedTaskJson, null, 2))
console.log(`Enhanced Task JSON exported to: ${filename}`)
console.log(`Session folder: ${sessionFolder}`)
console.log(`Reuse with: /workflow:lite-execute ${filename}`)
```

**Step 5.2: Store Execution Context**

```javascript
executionContext = {
  planObject: planObject,
  explorationContext: explorationContext || null,
  clarificationContext: clarificationContext || null,
  executionMethod: userSelection.execution_method,
  codeReviewTool: userSelection.code_review_tool,
  originalUserInput: original_task_description,

  // Session artifacts location
  session: {
    id: sessionId,
    folder: sessionFolder,
    artifacts: {
      exploration: explorationContext ? `${sessionFolder}/exploration.json` : null,
      plan: `${sessionFolder}/plan.json`,
      task: `${sessionFolder}/task.json`  // Always exported
    }
  }
}
```

**Step 5.3: Call lite-execute**

```javascript
SlashCommand(command="/workflow:lite-execute --in-memory")
```

**Execution Handoff**:
- lite-execute reads `executionContext` variable from memory
- `executionContext.session.artifacts` contains file paths to saved planning artifacts:
  - `exploration` - exploration.json (if exploration performed)
  - `plan` - plan.json (always exists)
  - `task` - task.json (if user selected export)
- All execution logic handled by lite-execute
- lite-plan completes after successful handoff

**Progress Tracking**:
- Mark Phase 5 completed
- Execution tracking delegated to lite-execute

## Best Practices

### Workflow Intelligence

1. **Dynamic Adaptation**: Workflow adjusts based on task characteristics
   - Smart exploration: Only when codebase context needed
   - Adaptive planning: Simple → direct, complex → specialized agent
   - Context-aware clarification: Only when truly needed
   - Reduces unnecessary steps while maintaining thoroughness

2. **Flag-Based Control**: Use `-e`/`--explore` to force exploration when:
   - Task appears simple but requires codebase context
   - Auto-detection might miss subtle integration points
   - Comprehensive code understanding needed

3. **Progressive Clarification**: Information gathered at right time
   - Phase 1: Explore codebase (current state)
   - Phase 2: Ask questions (based on findings)
   - Phase 3: Plan with complete context
   - Avoids premature assumptions, reduces rework

4. **Complexity-Aware Planning**: Strategy matches task complexity
   - Low (1-2 files): Direct planning (fast, 20-30s)
   - Medium (3-5 files): CLI planning (detailed, 40-50s)
   - High (6+ files): CLI planning with risk analysis (thorough, 50-60s)

5. **Two-Step Confirmation**: Clear separation between plan and control
   - Step 1: Display plan as readable text (not in question)
   - Step 2: Collect multi-dimensional input
     - Plan confirmation (multi-select with supplements)
     - Execution method selection
     - Code review tool selection (custom via "Other")
   - Enhanced Task JSON always exported to session folder
   - Allows plan refinement without re-selecting execution method

### Task Management

1. **Phase-Based Organization**: 5 distinct phases with clear transitions
   - Phase 1: Analysis & Exploration (automatic)
   - Phase 2: Clarification (conditional, interactive)
   - Phase 3: Planning (automatic, adaptive)
   - Phase 4: Confirmation (interactive, multi-dimensional)
   - Phase 5: Execution Dispatch (automatic)

2. **Flexible Task Counts**: Adapts to complexity
   - Low: 3-5 tasks (focused)
   - Medium: 5-7 tasks (detailed)
   - High: 7-10 tasks (comprehensive)

3. **Session Artifact Management**:
   - All planning artifacts saved to dedicated session folder
   - Enhanced Task JSON always exported for reusability
   - Plan context passed to execution via memory and files
   - Clean organization with session-based folder structure

### Planning Standards

1. **Context-Rich Planning**: Plans include all relevant context
   - Exploration findings (structure, patterns, constraints)
   - User clarifications (requirements, preferences, decisions)
   - Complexity assessment (risks, dependencies, estimates)
   - Execution recommendations (Direct vs CLI, specific tool)

2. **Modification Support**: Iterative refinement
   - User can request modifications in Phase 4
   - Feedback incorporated into re-planning
   - No restart from scratch
   - Collaborative planning workflow

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Phase 1 Exploration Failure | cli-explore-agent unavailable/timeout | Skip exploration, set `explorationContext = null`, continue with task description only |
| Phase 2 Clarification Timeout | User no response > 5 minutes | Use exploration findings as-is, proceed to Phase 3 with warning |
| Phase 3 Planning Agent Failure | cli-lite-planning-agent unavailable/timeout | Fallback to direct planning by current Claude |
| Phase 3 Planning Timeout | Planning > 90 seconds | Generate simplified plan, mark as "Quick Plan", continue |
| Phase 4 Confirmation Timeout | User no response > 5 minutes | Save context to temp var, display resume instructions, exit gracefully |
| Phase 4 Modification Loop | User requests modify > 3 times | Suggest breaking task into smaller pieces or using `/workflow:plan` |

## Session Folder Structure

Each lite-plan execution creates a dedicated session folder to organize all artifacts:

```
.workflow/.lite-plan/{task-slug}-{short-timestamp}/
├── exploration.json          # Exploration results (if exploration performed)
├── plan.json                 # Planning results (always created)
└── task.json                 # Enhanced Task JSON (always created)
```

**Folder Naming Convention**:
- `{task-slug}`: First 40 characters of task description, lowercased, non-alphanumeric replaced with `-`
- `{short-timestamp}`: YYYY-MM-DD-HH-mm-ss format
- Example: `.workflow/.lite-plan/implement-user-auth-jwt-2025-01-15-14-30-45/`

**File Contents**:
- `exploration.json`: Complete explorationContext object (if exploration performed, see Data Structures)
- `plan.json`: Complete planObject (always created, see Data Structures)
- `task.json`: Enhanced Task JSON with all context (always created, see Data Structures)

**Access Patterns**:
- **lite-plan**: Creates folder and writes all artifacts during execution, passes paths via `executionContext.session.artifacts`
- **lite-execute**: Reads artifact paths from `executionContext.session.artifacts` (see lite-execute.md for usage details)
- **User**: Can inspect artifacts for debugging or reference
- **Reuse**: Pass `task.json` path to `/workflow:lite-execute {path}` for re-execution


## Data Structures

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
      title: string,                   // Task title
      file: string,                    // Target file path
      action: string,                  // Create|Update|Implement|Refactor|Add|Delete
      description: string,             // What to implement (1-2 sentences)
      implementation: string[],        // Step-by-step how-to (3-7 steps)
      reference: {                     // What to reference
        pattern: string,               // Pattern name
        files: string[],               // Reference file paths
        examples: string               // Specific guidance
      },
      acceptance: string[]             // Verification criteria (2-4 items)
    }
  ],
  estimated_time: string,              // Total implementation time
  recommended_execution: string,       // "Agent" (Low) or "Codex" (Medium/High)
  complexity: string                   // "Low" | "Medium" | "High"
}
```

### executionContext

Context passed to lite-execute via --in-memory (Phase 5):

```javascript
{
  planObject: {                        // Complete planObject (see above)
    summary: string,
    approach: string,
    tasks: [...],
    estimated_time: string,
    recommended_execution: string,
    complexity: string
  },
  explorationContext: {...} | null,    // See explorationContext above
  clarificationContext: {...} | null,  // User responses from Phase 2
  executionMethod: "Agent" | "Codex" | "Auto",
  codeReviewTool: "Skip" | "Gemini Review" | "Agent Review" | string,
  originalUserInput: string,           // User's original task description

  // Session artifacts location (for lite-execute to access saved files)
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

### Enhanced Task JSON Export

When user selects "Export JSON", lite-plan exports this structure:

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
      "approach": "High-level strategy",
      "tasks": [/* Array of task objects */]
    },
    "exploration": {/* explorationContext */} | null,
    "clarifications": {/* clarificationContext */} | null,
    "focus_paths": ["src/auth", "tests/auth"],
    "acceptance": ["Criteria from plan.tasks"]
  }
}
```

**Schema Notes**:
- Aligns with Enhanced Task JSON Schema (6-field structure)
- `context_package_path` omitted (not used by lite-plan)
- `flow_control` omitted (handled by lite-execute)
- `focus_paths` derived from `exploration.relevant_files`
- `acceptance` derived from `plan.tasks`
