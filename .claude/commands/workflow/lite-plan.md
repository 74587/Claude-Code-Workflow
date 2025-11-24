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

```bash
/workflow:lite-plan [FLAGS] <TASK_DESCRIPTION>

# Flags
-e, --explore              Force code exploration phase (overrides auto-detection)

# Arguments
<task-description>         Task description or path to .md file (required)
```

## Execution Process

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
```

## Implementation

### Phase 1: Task Analysis & Exploration Decision

**Session Setup**:
```javascript
const taskSlug = task_description.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const shortTimestamp = timestamp.substring(0, 19).replace('T', '-')
const sessionId = `${taskSlug}-${shortTimestamp}`
const sessionFolder = `.workflow/.lite-plan/${sessionId}`

bash(`mkdir -p ${sessionFolder}`)
```

**Decision Logic**:
```javascript
needsExploration = (
  flags.includes('--explore') || flags.includes('-e') ||
  task.mentions_specific_files ||
  task.requires_codebase_context ||
  task.needs_architecture_understanding ||
  task.modifies_existing_code
)
```

**If exploration needed** - Invoke cli-explore-agent:

```javascript
Task(
  subagent_type="cli-explore-agent",
  description="Analyze codebase for task context",
  prompt=`
Analyze codebase for task context and generate exploration.json.

## Output Schema Reference
~/.claude/workflows/cli-templates/schemas/explore-json-schema.json

## Task Description
${task_description}

## Requirements
Generate exploration.json with:
- project_structure: Architecture and module organization
- relevant_files: File paths to be affected
- patterns: Code patterns, conventions, styles
- dependencies: External/internal module dependencies
- integration_points: Task connections with existing code
- constraints: Technical limitations/requirements
- clarification_needs: Ambiguities requiring user input
- _metadata: timestamp, task_description, source

## Execution
1. Structural scan: get_modules_by_depth.sh, find, rg
2. Semantic analysis: Gemini for patterns/architecture
3. Write JSON: Write('${sessionFolder}/exploration.json', jsonContent)
4. Return brief completion summary

Time Limit: 60 seconds
`
)
```

**Output**: `${sessionFolder}/exploration.json` (if exploration performed)

---

### Phase 2: Clarification (Optional)

**Skip if**: No exploration or `clarification_needs` is empty

**If clarification needed**:
```javascript
const exploration = JSON.parse(Read(`${sessionFolder}/exploration.json`))

if (exploration.clarification_needs?.length > 0) {
  AskUserQuestion({
    questions: exploration.clarification_needs.map(need => ({
      question: `${need.context}\n\n${need.question}`,
      header: "Clarification",
      multiSelect: false,
      options: need.options.map(opt => ({
        label: opt,
        description: `Use ${opt} approach`
      }))
    }))
  })
}
```

**Output**: `clarificationContext` (in-memory)

---

### Phase 3: Complexity Assessment & Planning

**Complexity Assessment**:
```javascript
complexityScore = {
  file_count: exploration?.relevant_files?.length || 0,
  integration_points: exploration?.dependencies?.length || 0,
  architecture_changes: exploration?.constraints?.includes('architecture'),
  task_scope: estimated_steps > 5
}

// Low: score < 3, Medium: 3-5, High: > 5
```

**Low Complexity** - Direct planning by Claude:
- Generate plan directly, write to `${sessionFolder}/plan.json`
- No agent invocation

**Medium/High Complexity** - Invoke cli-lite-planning-agent:

```javascript
Task(
  subagent_type="cli-lite-planning-agent",
  description="Generate detailed implementation plan",
  prompt=`
Generate implementation plan and write plan.json.

## Output Schema Reference
~/.claude/workflows/cli-templates/schemas/plan-json-schema.json

## Task Description
${task_description}

## Exploration Context
${sessionFolder}/exploration.json (if exists)

## User Clarifications
${JSON.stringify(clarificationContext) || "None"}

## Complexity Level
${complexity}

## Requirements
Generate plan.json with:
- summary: 2-3 sentence overview
- approach: High-level implementation strategy
- tasks: 3-10 structured tasks with:
  - title, file, action, description
  - implementation (3-7 steps)
  - reference (pattern, files, examples)
  - acceptance (2-4 criteria)
- estimated_time, recommended_execution, complexity
- _metadata: timestamp, source, planning_mode

## Execution
1. Execute CLI planning using Gemini (Qwen fallback)
2. Parse output and structure plan
3. Write JSON: Write('${sessionFolder}/plan.json', jsonContent)
4. Return brief completion summary
`
)
```

**Output**: `${sessionFolder}/plan.json`

---

### Phase 4: Task Confirmation & Execution Selection

**Step 4.1: Display Plan**
```javascript
const plan = JSON.parse(Read(`${sessionFolder}/plan.json`))

console.log(`
## Implementation Plan

**Summary**: ${plan.summary}
**Approach**: ${plan.approach}

**Tasks** (${plan.tasks.length}):
${plan.tasks.map((t, i) => `${i+1}. ${t.title} (${t.file})`).join('\n')}

**Complexity**: ${plan.complexity}
**Estimated Time**: ${plan.estimated_time}
**Recommended**: ${plan.recommended_execution}
`)
```

**Step 4.2: Collect Confirmation**
```javascript
AskUserQuestion({
  questions: [
    {
      question: `Confirm plan? (${plan.tasks.length} tasks, ${plan.complexity})`,
      header: "Confirm",
      multiSelect: true,
      options: [
        { label: "Allow", description: "Proceed as-is" },
        { label: "Modify", description: "Adjust before execution" },
        { label: "Cancel", description: "Abort workflow" }
      ]
    },
    {
      question: "Execution method:",
      header: "Execution",
      multiSelect: false,
      options: [
        { label: "Agent", description: "@code-developer agent" },
        { label: "Codex", description: "codex CLI tool" },
        { label: "Auto", description: `Auto: ${plan.complexity === 'Low' ? 'Agent' : 'Codex'}` }
      ]
    },
    {
      question: "Code review after execution?",
      header: "Review",
      multiSelect: false,
      options: [
        { label: "Gemini Review", description: "Gemini CLI" },
        { label: "Agent Review", description: "@code-reviewer" },
        { label: "Skip", description: "No review" }
      ]
    }
  ]
})
```

---

### Phase 5: Dispatch to Execution

**Step 5.1: Generate task.json** (by command, not agent)

```javascript
const taskId = `LP-${shortTimestamp}`
const exploration = file_exists(`${sessionFolder}/exploration.json`)
  ? JSON.parse(Read(`${sessionFolder}/exploration.json`))
  : null
const plan = JSON.parse(Read(`${sessionFolder}/plan.json`))

const taskJson = {
  id: taskId,
  title: task_description,
  status: "pending",

  meta: {
    type: "planning",
    created_at: new Date().toISOString(),
    complexity: plan.complexity,
    estimated_time: plan.estimated_time,
    recommended_execution: plan.recommended_execution,
    workflow: "lite-plan",
    session_id: sessionId,
    session_folder: sessionFolder
  },

  context: {
    requirements: [task_description],
    plan: {
      summary: plan.summary,
      approach: plan.approach,
      tasks: plan.tasks
    },
    exploration: exploration,
    clarifications: clarificationContext || null,
    focus_paths: exploration?.relevant_files || [],
    acceptance: plan.tasks.flatMap(t => t.acceptance)
  }
}

Write(`${sessionFolder}/task.json`, JSON.stringify(taskJson, null, 2))
```

**Step 5.2: Store executionContext**

```javascript
executionContext = {
  planObject: plan,
  explorationContext: exploration,
  clarificationContext: clarificationContext || null,
  executionMethod: userSelection.execution_method,
  codeReviewTool: userSelection.code_review_tool,
  originalUserInput: task_description,
  session: {
    id: sessionId,
    folder: sessionFolder,
    artifacts: {
      exploration: exploration ? `${sessionFolder}/exploration.json` : null,
      plan: `${sessionFolder}/plan.json`,
      task: `${sessionFolder}/task.json`
    }
  }
}
```

**Step 5.3: Dispatch**

```javascript
SlashCommand(command="/workflow:lite-execute --in-memory")
```

## Session Folder Structure

```
.workflow/.lite-plan/{task-slug}-{timestamp}/
├── exploration.json    # If exploration performed (by cli-explore-agent)
├── plan.json           # Always created (by agent or direct planning)
└── task.json           # Always created (by command)
```

## Error Handling

| Error | Resolution |
|-------|------------|
| Exploration agent failure | Skip exploration, continue with task description only |
| Planning agent failure | Fallback to direct planning by Claude |
| Clarification timeout | Use exploration findings as-is |
| Confirmation timeout | Save context, display resume instructions |
| Modify loop > 3 times | Suggest breaking task or using /workflow:plan |
