---
name: develop-with-file
description: Multi-agent development workflow with documented progress, Gemini-guided planning, and incremental iteration support
argument-hint: "[-y|--yes] \"feature description or task file.md\""
allowed-tools: TodoWrite(*), Task(*), AskUserQuestion(*), Read(*), Grep(*), Glob(*), Bash(*), Edit(*), Write(*)
---

## Auto Mode

When `--yes` or `-y`: Auto-confirm all decisions (exploration, planning, execution, verification), use recommended settings.

# Workflow Develop-With-File Command (/workflow:develop-with-file)

## Overview

Production-grade development workflow with **2-document state tracking**. Combines multi-agent parallel exploration, Gemini-assisted planning/verification, and incremental iteration in a single coherent workflow.

**Core workflow**: Explore → Plan → Execute → Verify → Iterate

**Key features**:
- **progress.md**: Single source of truth for exploration, planning, execution timeline
- **plan.json**: Current execution plan (derived from progress.md)
- **Multi-agent exploration**: Parallel cli-explore-agents from multiple angles
- **Multi-CLI execution**: Support gemini/codex/agent per task
- **Gemini-guided planning**: Intelligent task decomposition and validation
- **Gemini verification**: Post-execution review and correction
- **Incremental iteration**: Resume from any phase, add new tasks dynamically

## Usage

```bash
/workflow:develop-with-file [FLAGS] <TASK_DESCRIPTION>

# Flags
-e, --explore              Force exploration phase
--resume <session-id>      Resume existing session

# Arguments
<task-description>         Feature description or path to .md file (required)
```

## Execution Process

```
Session Detection:
   ├─ Check if session exists (--resume or auto-detect)
   ├─ EXISTS → Continue mode (read progress.md for current phase)
   └─ NOT_FOUND → Explore mode

Explore Mode (Multi-Agent):
   ├─ Assess task complexity (Low/Medium/High)
   ├─ Launch 1-4 parallel cli-explore-agents (angle-based)
   ├─ Aggregate exploration results
   ├─ Document in progress.md → Exploration section
   └─ Transition → Plan mode

Plan Mode (Gemini-Guided):
   ├─ Read progress.md exploration findings
   ├─ Invoke Gemini for task decomposition
   ├─ Generate plan.json (2-7 tasks with dependencies)
   ├─ Assign executor per task (gemini/codex/agent)
   ├─ Document in progress.md → Planning section
   ├─ User confirmation (Allow/Modify/Cancel)
   └─ Transition → Execute mode

Execute Mode (Multi-Agent/CLI):
   ├─ For each task in plan.json:
   │   ├─ Check dependencies (wait if needed)
   │   ├─ Execute via assigned executor (agent/gemini/codex)
   │   ├─ Document progress in progress.md → Execution section
   │   └─ Handle failures (retry/skip/abort)
   ├─ Aggregate execution results
   └─ Transition → Verify mode

Verify Mode (Gemini-Assisted):
   ├─ Invoke Gemini CLI for code review
   ├─ Analyze: correctness, style, potential issues
   ├─ Document in progress.md → Verification section
   ├─ Decision:
   │   ├─ All passed → Complete
   │   ├─ Minor issues → Document corrections, iterate
   │   └─ Major issues → Rollback, re-plan
   └─ Transition → Iterate or Complete

Iterate Mode (Incremental):
   ├─ User provides new requirements or fixes
   ├─ Read progress.md for current state
   ├─ Gemini analyzes delta (what changed?)
   ├─ Generate incremental tasks, append to plan.json
   ├─ Update progress.md → New iteration section
   └─ Transition → Execute mode (incremental tasks only)
```

## Implementation

### Session Setup & Mode Detection

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

const taskSlug = task_description.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
const dateStr = getUtc8ISOString().substring(0, 10)

const sessionId = flags.resume || `DEV-${taskSlug}-${dateStr}`
const sessionFolder = `.workflow/.develop/${sessionId}`
const progressPath = `${sessionFolder}/progress.md`
const planPath = `${sessionFolder}/plan.json`

// Auto-detect mode
const sessionExists = fs.existsSync(sessionFolder)
const hasProgress = sessionExists && fs.existsSync(progressPath)
const hasPlan = sessionExists && fs.existsSync(planPath)

let mode = 'explore'
if (hasProgress) {
  const progress = Read(progressPath)
  // Parse progress.md to determine current phase
  if (progress.includes('## Verification Results')) mode = 'iterate'
  else if (progress.includes('## Execution Timeline')) mode = 'verify'
  else if (progress.includes('## Planning Results')) mode = 'execute'
  else if (progress.includes('## Exploration Results')) mode = 'plan'
}

if (!sessionExists) {
  bash(`mkdir -p ${sessionFolder}`)
}

console.log(`
## Session Info
- Session ID: ${sessionId}
- Mode: ${mode}
- Folder: ${sessionFolder}
`)
```

---

### Explore Mode (Multi-Agent Parallel)

**Step 1.1: Complexity Assessment**

```javascript
// Analyze task complexity based on:
// - Scope: How many systems/modules affected?
// - Depth: Surface change vs architectural impact?
// - Risk: Potential for breaking existing functionality?
// - Dependencies: How interconnected is the change?

const complexity = analyzeTaskComplexity(task_description)
// Returns: 'Low' (1 angle) | 'Medium' (2-3 angles) | 'High' (4 angles)

const ANGLE_PRESETS = {
  architecture: ['architecture', 'dependencies', 'modularity', 'integration-points'],
  feature: ['patterns', 'integration-points', 'testing', 'dependencies'],
  bugfix: ['error-handling', 'dataflow', 'state-management', 'edge-cases'],
  refactor: ['code-quality', 'patterns', 'dependencies', 'testing']
}

function selectAngles(taskDescription, complexity) {
  const text = taskDescription.toLowerCase()
  let preset = 'feature' // default

  if (/refactor|architect|restructure/.test(text)) preset = 'architecture'
  else if (/fix|bug|error|issue/.test(text)) preset = 'bugfix'
  else if (/clean|improve|simplify/.test(text)) preset = 'refactor'

  const count = complexity === 'High' ? 4 : (complexity === 'Medium' ? 3 : 1)
  return ANGLE_PRESETS[preset].slice(0, count)
}

const selectedAngles = selectAngles(task_description, complexity)
```

**Step 1.2: Launch Parallel Explorations**

```javascript
// Launch agents with pre-assigned angles
const explorationTasks = selectedAngles.map((angle, index) =>
  Task(
    subagent_type="cli-explore-agent",
    run_in_background=false,  // ⚠️ MANDATORY: Must wait for results
    description=`Explore: ${angle}`,
    prompt=`
## Task Objective
Execute **${angle}** exploration for development planning context.

## Assigned Context
- **Exploration Angle**: ${angle}
- **Task Description**: ${task_description}
- **Output File**: ${sessionFolder}/exploration-${angle}.json

## MANDATORY FIRST STEPS
1. cat ~/.claude/workflows/cli-templates/schemas/explore-json-schema.json (schema)
2. ccw tool exec get_modules_by_depth '{}' (project structure)
3. Read .workflow/project-tech.json (tech stack)
4. Read .workflow/project-guidelines.json (constraints)

## Exploration Strategy (${angle} focus)

**Structural Scan** (Bash):
- get_modules_by_depth.sh → modules related to ${angle}
- rg -l "{keywords}" --type ts → locate relevant files
- Analyze imports/dependencies from ${angle} perspective

**Semantic Analysis** (Gemini CLI):
- ccw cli -p "PURPOSE: Analyze ${angle} aspect for: ${task_description}
  TASK: • Identify ${angle} patterns • Locate integration points • List constraints
  MODE: analysis
  CONTEXT: @**/* | Task: ${task_description}
  EXPECTED: ${angle} findings with file:line references
  CONSTRAINTS: Focus on ${angle}" --tool gemini --mode analysis

**Output**: ${sessionFolder}/exploration-${angle}.json (follow schema)

## Required Fields
- project_structure: ${angle}-relevant modules
- relevant_files: [{path, relevance (0-1), rationale}]
- patterns: ${angle} patterns with code examples
- integration_points: Where to integrate (file:line)
- constraints: ${angle}-specific limitations
- clarification_needs: [{question, context, options, recommended}]
- _metadata.exploration_angle: "${angle}"

## Success Criteria
- Schema validated
- ≥3 relevant files with rationale
- Integration points with file:line
- Actionable patterns (code examples)
- JSON output matches schema
`
  )
)

// Execute all explorations
```

**Step 1.3: Aggregate Exploration Results**

```javascript
// Auto-discover exploration files
const explorationFiles = bash(`find ${sessionFolder} -name "exploration-*.json" -type f`)
  .split('\n')
  .filter(f => f.trim())

const explorations = explorationFiles.map(file => {
  const data = JSON.parse(Read(file))
  return {
    angle: data._metadata.exploration_angle,
    data: data
  }
})

// Aggregate clarification needs
const allClarifications = []
explorations.forEach(exp => {
  if (exp.data.clarification_needs?.length > 0) {
    exp.data.clarification_needs.forEach(need => {
      allClarifications.push({ ...need, source_angle: exp.angle })
    })
  }
})

// Intelligent deduplication
const dedupedClarifications = intelligentMerge(allClarifications)

// Multi-round clarification (max 4 questions per round)
if (dedupedClarifications.length > 0) {
  const BATCH_SIZE = 4
  for (let i = 0; i < dedupedClarifications.length; i += BATCH_SIZE) {
    const batch = dedupedClarifications.slice(i, i + BATCH_SIZE)
    AskUserQuestion({
      questions: batch.map(need => ({
        question: `[${need.source_angle}] ${need.question}`,
        header: need.source_angle.substring(0, 12),
        multiSelect: false,
        options: need.options.map((opt, idx) => ({
          label: need.recommended === idx ? `${opt} ★` : opt,
          description: need.recommended === idx ? "Recommended" : `Use ${opt}`
        }))
      }))
    })
  }
}
```

**Step 1.4: Document in progress.md**

Create or update `progress.md`:

```markdown
# Development Progress

**Session ID**: ${sessionId}
**Task Description**: ${task_description}
**Started**: ${getUtc8ISOString()}
**Complexity**: ${complexity}

---

## Exploration Results

### Exploration Summary (${getUtc8ISOString()})

**Angles Explored**: ${selectedAngles.join(', ')}
**Exploration Count**: ${explorations.length}

${explorations.map(exp => `
#### ${exp.angle.toUpperCase()}

**Relevant Files** (top 5):
${exp.data.relevant_files.slice(0, 5).map(f =>
  `- ${f.path} (${(f.relevance * 100).toFixed(0)}%) - ${f.rationale}`
).join('\n')}

**Integration Points**:
${exp.data.integration_points.map(p => `- ${p}`).join('\n')}

**Patterns**:
${exp.data.patterns.map(p => `- ${p}`).join('\n')}

**Constraints**:
${exp.data.constraints.map(c => `- ${c}`).join('\n')}
`).join('\n')}

### Clarifications Collected

${dedupedClarifications.length > 0 ? dedupedClarifications.map((c, i) => `
${i+1}. **[${c.source_angle}]** ${c.question}
   - Answer: ${c.user_answer || 'Pending'}
`).join('\n') : 'No clarifications needed'}

---

## Current State

**Phase**: Exploration complete, ready for planning
**Next Steps**: Invoke Gemini for task decomposition
```

---

### Plan Mode (Gemini-Guided)

**Step 2.1: Gemini-Assisted Planning**

```bash
ccw cli -p "
PURPOSE: Generate implementation plan for: ${task_description}
Success criteria: 2-7 structured tasks with clear dependencies, executor assignments

TASK:
• Read progress.md exploration findings (all angles)
• Analyze task requirements and constraints
• Decompose into 2-7 substantial tasks (15-60min each)
• Assign executor per task (gemini/codex/agent) based on:
  - User explicit mention (\"use gemini for X\")
  - Task nature (analysis → gemini, implementation → agent, git-aware → codex)
  - Default → agent
• Define true dependencies only (Task B needs Task A's output)
• Group by feature/module, NOT by file

MODE: analysis

CONTEXT: @${progressPath} | Exploration findings in progress.md

EXPECTED:
- plan.json following schema (cat ~/.claude/workflows/cli-templates/schemas/plan-json-schema.json)
- tasks: [{id, title, description, files, executor (gemini/codex/agent), depends_on, complexity}]
- executorAssignments: {taskId: {executor, reason}}
- estimated_time, complexity, summary, approach

CONSTRAINTS:
- Respect project-guidelines.json constraints
- Prefer parallel tasks (minimal depends_on)
- Group related changes into single task
- Explicit executor rationale
" --tool gemini --mode analysis --rule planning-breakdown-task-steps
```

**Step 2.2: Parse Gemini Output → plan.json**

```javascript
// Gemini returns plan structure
const planFromGemini = parseGeminiOutput()

const plan = {
  summary: planFromGemini.summary,
  approach: planFromGemini.approach,
  tasks: planFromGemini.tasks.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    files: t.files,
    executor: t.executor || 'agent',  // gemini/codex/agent
    depends_on: t.depends_on || [],
    complexity: t.complexity,
    status: 'pending'  // pending/in_progress/completed/failed
  })),
  executorAssignments: planFromGemini.executorAssignments || {},
  estimated_time: planFromGemini.estimated_time,
  complexity: complexity,
  _metadata: {
    timestamp: getUtc8ISOString(),
    source: 'gemini-planning',
    exploration_angles: selectedAngles
  }
}

Write(planPath, JSON.stringify(plan, null, 2))
```

**Step 2.3: Update progress.md**

Append to `progress.md`:

```markdown
## Planning Results

### Plan Generated (${getUtc8ISOString()})

**Summary**: ${plan.summary}
**Approach**: ${plan.approach}
**Estimated Time**: ${plan.estimated_time}
**Complexity**: ${plan.complexity}

**Tasks** (${plan.tasks.length}):

${plan.tasks.map((t, i) => `
${i+1}. **${t.id}**: ${t.title}
   - Files: ${t.files.join(', ')}
   - Executor: ${t.executor}
   - Depends on: ${t.depends_on.join(', ') || 'None'}
   - Complexity: ${t.complexity}
`).join('\n')}

**Executor Assignments**:
${Object.entries(plan.executorAssignments).map(([id, assign]) =>
  `- ${id}: ${assign.executor} (Reason: ${assign.reason})`
).join('\n')}

**Gemini Insights**:
${planFromGemini.gemini_insights || 'N/A'}

---

## Current State

**Phase**: Planning complete, awaiting user confirmation
**Next Steps**: User confirms → Execute tasks
```

**Step 2.4: User Confirmation**

```javascript
AskUserQuestion({
  questions: [
    {
      question: `Confirm plan? (${plan.tasks.length} tasks, ${plan.complexity})`,
      header: "Confirm",
      multiSelect: false,
      options: [
        { label: "Allow", description: "Proceed as-is" },
        { label: "Modify", description: "Adjust tasks/executors" },
        { label: "Cancel", description: "Abort workflow" }
      ]
    }
  ]
})

// If Modify → allow editing plan.json, re-confirm
// If Allow → proceed to Execute mode
```

---

### Execute Mode (Multi-Agent/CLI)

**Step 3.1: Task Execution Loop**

```javascript
const plan = JSON.parse(Read(planPath))
const completedTasks = []
const failedTasks = []

for (const task of plan.tasks) {
  // Check dependencies
  const depsCompleted = task.depends_on.every(depId =>
    completedTasks.some(t => t.id === depId)
  )

  if (!depsCompleted) {
    console.log(`⏸️ Task ${task.id} waiting for dependencies: ${task.depends_on.join(', ')}`)
    continue
  }

  console.log(`\n## Executing Task: ${task.id} (${task.executor})\n`)

  // Update progress.md
  appendToProgress(`
### Task ${task.id} - ${task.title} (${getUtc8ISOString()})

**Status**: In Progress
**Executor**: ${task.executor}
**Files**: ${task.files.join(', ')}
`)

  // Execute based on assigned executor
  try {
    if (task.executor === 'gemini') {
      // Gemini CLI execution
      bash(`ccw cli -p "
PURPOSE: ${task.description}
TASK: Implement changes in: ${task.files.join(', ')}
MODE: write
CONTEXT: @${task.files.join(' @')} | Memory: Task ${task.id} from ${sessionId}
EXPECTED: Code implementation following project patterns
CONSTRAINTS: ${task.constraints || 'Follow project-guidelines.json'}
" --tool gemini --mode write --cd ${sessionFolder}`, run_in_background=true)

      // Wait for callback

    } else if (task.executor === 'codex') {
      // Codex CLI execution
      bash(`ccw cli -p "
${task.description}

Files to modify: ${task.files.join(', ')}
" --tool codex --mode write`, run_in_background=true)

      // Wait for callback

    } else {
      // Agent execution
      Task(
        subagent_type="code-developer",
        run_in_background=false,
        description=`Execute task ${task.id}`,
        prompt=`
## Task: ${task.title}

${task.description}

## Context from Exploration
Read ${progressPath} for exploration findings relevant to:
${task.files.map(f => `- ${f}`).join('\n')}

## Files to Modify
${task.files.join('\n')}

## Constraints
- Follow patterns identified in exploration
- Respect project-guidelines.json
- Write tests if applicable

## Success Criteria
- Code compiles without errors
- Tests pass (if applicable)
- Follows existing code style
`
      )
    }

    // Mark completed
    task.status = 'completed'
    completedTasks.push(task)

    appendToProgress(`
**Status**: ✅ Completed
**Output**: ${task.output || 'Code changes applied'}
`)

  } catch (error) {
    task.status = 'failed'
    failedTasks.push(task)

    appendToProgress(`
**Status**: ❌ Failed
**Error**: ${error.message}
`)

    // Ask user: retry/skip/abort
    AskUserQuestion({
      questions: [{
        question: `Task ${task.id} failed. How to proceed?`,
        header: "Error",
        multiSelect: false,
        options: [
          { label: "Retry", description: "Retry with same executor" },
          { label: "Skip", description: "Skip and continue" },
          { label: "Abort", description: "Stop workflow" }
        ]
      }]
    })
  }

  // Update plan.json
  Write(planPath, JSON.stringify(plan, null, 2))
}

// Final summary
appendToProgress(`
---

## Execution Summary (${getUtc8ISOString()})

**Total Tasks**: ${plan.tasks.length}
**Completed**: ${completedTasks.length}
**Failed**: ${failedTasks.length}

${failedTasks.length > 0 ? `
**Failed Tasks**:
${failedTasks.map(t => `- ${t.id}: ${t.title}`).join('\n')}
` : ''}

---

## Current State

**Phase**: Execution complete, ready for verification
**Next Steps**: Invoke Gemini for code review
`)
```

---

### Verify Mode (Gemini-Assisted)

**Step 4.1: Gemini Code Review**

```bash
ccw cli -p "
PURPOSE: Review code changes from development session ${sessionId}
Success criteria: Identify issues, validate correctness, suggest improvements

TASK:
• Review all modified files from execution
• Check: correctness, style consistency, potential bugs, test coverage
• Validate against project-guidelines.json
• Provide actionable feedback with file:line references

MODE: review

CONTEXT: @${progressPath} | Execution results in progress.md

EXPECTED:
- Review report with severity levels (Critical/High/Medium/Low)
- Issues with file:line references and fix suggestions
- Overall quality score (1-10)
- Recommendations for improvements

CONSTRAINTS: Evidence-based feedback only
" --tool gemini --mode review
```

**Step 4.2: Parse Review Results**

```javascript
const reviewResults = parseGeminiReview()

const hasBlockers = reviewResults.issues.some(i => i.severity === 'Critical')
const hasMajorIssues = reviewResults.issues.some(i => i.severity === 'High')
```

**Step 4.3: Update progress.md**

Append to `progress.md`:

```markdown
## Verification Results

### Code Review (${getUtc8ISOString()})

**Reviewer**: Gemini
**Quality Score**: ${reviewResults.quality_score}/10

**Issues Found** (${reviewResults.issues.length}):

${reviewResults.issues.map(issue => `
#### ${issue.severity}: ${issue.title}
- **File**: ${issue.file}:${issue.line}
- **Description**: ${issue.description}
- **Suggested Fix**:
\`\`\`${issue.language || 'typescript'}
${issue.suggested_fix}
\`\`\`
`).join('\n')}

${reviewResults.issues.length === 0 ? '✅ No issues found. Code review passed.' : ''}

**Recommendations**:
${reviewResults.recommendations.map(r => `- ${r}`).join('\n')}

**Gemini Analysis**:
${reviewResults.gemini_analysis}

---

## Current State

**Phase**: Verification complete
**Decision**: ${hasBlockers ? 'BLOCKERS FOUND - Fix required' : (hasMajorIssues ? 'Major issues - Recommend fixing' : 'PASSED - Ready to commit')}
```

**Step 4.4: Decision**

```javascript
if (hasBlockers) {
  // Critical issues → must fix before commit
  console.log(`
❌ Critical issues found. Transitioning to Iterate mode for fixes.
  `)
  mode = 'iterate'

} else if (hasMajorIssues) {
  // Ask user
  AskUserQuestion({
    questions: [{
      question: "High severity issues found. How to proceed?",
      header: "Review",
      multiSelect: false,
      options: [
        { label: "Fix Issues", description: "Iterate to fix high severity issues" },
        { label: "Accept As-Is", description: "Proceed despite issues" },
        { label: "Manual Review", description: "Stop and review manually" }
      ]
    }]
  })

} else {
  // All passed
  console.log(`
✅ Code review passed. Development complete.

Session artifacts saved in: ${sessionFolder}
- progress.md: Full development timeline
- plan.json: Execution plan

Run \`/workflow:develop-with-file --resume ${sessionId}\` to iterate.
  `)
}
```

---

### Iterate Mode (Incremental)

**Step 5.1: Analyze Delta**

User provides new requirements or fix instructions:

```bash
ccw cli -p "
PURPOSE: Analyze incremental changes for session ${sessionId}
Success criteria: Identify minimal tasks to address new requirements

TASK:
• Read progress.md for current state
• Compare new requirements with existing implementation
• Identify delta (what changed?)
• Generate incremental tasks (append to existing plan)

MODE: analysis

CONTEXT:
@${progressPath}
@${planPath}
| New requirements: ${new_requirements}

EXPECTED:
- Delta analysis (what's new, what needs changing)
- Incremental tasks [{id, title, description, files, executor}]
- Updated plan.json with new tasks

CONSTRAINTS: Minimal changes, preserve existing work
" --tool gemini --mode analysis --rule planning-breakdown-task-steps
```

**Step 5.2: Append Incremental Tasks**

```javascript
const plan = JSON.parse(Read(planPath))
const incrementalTasks = parseGeminiDelta()

// Assign new task IDs
const maxId = Math.max(...plan.tasks.map(t => parseInt(t.id.replace('T', ''))))
incrementalTasks.forEach((task, i) => {
  task.id = `T${maxId + i + 1}`
  task.status = 'pending'
  plan.tasks.push(task)
})

Write(planPath, JSON.stringify(plan, null, 2))
```

**Step 5.3: Update progress.md**

Append new iteration section:

```markdown
---

## Iteration ${iteration_number} (${getUtc8ISOString()})

### New Requirements
${new_requirements}

### Delta Analysis
${incrementalTasks.delta_analysis}

### Incremental Tasks
${incrementalTasks.tasks.map(t => `
- **${t.id}**: ${t.title}
  - Files: ${t.files.join(', ')}
  - Executor: ${t.executor}
`).join('\n')}

---

## Current State

**Phase**: Iteration planning complete
**Next Steps**: Execute incremental tasks
```

**Step 5.4: Execute Incremental Tasks**

Re-enter Execute Mode, but only process tasks with `status: 'pending'`.

---

## Session Folder Structure

```
.workflow/.develop/{session-id}/
├── progress.md                    # Timeline: exploration → planning → execution → verification
├── plan.json                      # Current execution plan (tasks, statuses, executors)
└── exploration-{angle}.json       # Temporary exploration results (optional, can delete after planning)
```

**Example**:
```
.workflow/.develop/DEV-implement-jwt-refresh-2025-01-23/
├── progress.md
├── plan.json
├── exploration-architecture.json
├── exploration-patterns.json
└── exploration-testing.json
```

## Progress.md Template

```markdown
# Development Progress

**Session ID**: DEV-xxx-2025-01-23
**Task Description**: [original description]
**Started**: 2025-01-23T10:00:00+08:00
**Complexity**: Medium

---

## Exploration Results

### Exploration Summary (2025-01-23 10:05)
...

### Clarifications Collected
...

---

## Planning Results

### Plan Generated (2025-01-23 10:15)
...

---

## Execution Timeline

### Task T1 - ... (2025-01-23 10:20)
**Status**: ✅ Completed
...

### Task T2 - ... (2025-01-23 10:35)
**Status**: ✅ Completed
...

---

## Verification Results

### Code Review (2025-01-23 11:00)
...

---

## Iteration 2 (2025-01-23 14:00)

### New Requirements
...

### Delta Analysis
...

---

## Current State

**Phase**: Complete
**Quality Score**: 8/10
**Artifacts**: progress.md, plan.json
```

## Plan.json Schema

```json
{
  "summary": "Implementation summary",
  "approach": "Technical approach description",
  "tasks": [
    {
      "id": "T1",
      "title": "Task title",
      "description": "Detailed description",
      "files": ["src/file1.ts", "src/file2.ts"],
      "executor": "agent",  // gemini/codex/agent
      "depends_on": [],
      "complexity": "Medium",
      "status": "completed"  // pending/in_progress/completed/failed
    }
  ],
  "executorAssignments": {
    "T1": {
      "executor": "agent",
      "reason": "Standard implementation task, agent handles well"
    }
  },
  "estimated_time": "2-3 hours",
  "complexity": "Medium",
  "_metadata": {
    "timestamp": "2025-01-23T10:15:00+08:00",
    "source": "gemini-planning",
    "exploration_angles": ["architecture", "patterns", "testing"]
  }
}
```

## Gemini Integration Points

### 1. Planning (Plan Mode)

**Purpose**: Intelligent task decomposition with executor assignment

**Prompt Pattern**:
```
PURPOSE: Generate implementation plan + executor assignments
TASK: Analyze exploration → decompose → assign executors (gemini/codex/agent)
CONTEXT: @progress.md (exploration findings)
EXPECTED: plan.json with tasks, executorAssignments, rationale
```

### 2. Verification (Verify Mode)

**Purpose**: Post-execution code review and quality check

**Prompt Pattern**:
```
PURPOSE: Review code changes + validate quality
TASK: Check correctness, style, bugs → severity levels → fix suggestions
CONTEXT: @progress.md (execution results)
EXPECTED: Review report with issues (Critical/High/Medium/Low), quality score
```

### 3. Iteration (Iterate Mode)

**Purpose**: Analyze delta and generate incremental tasks

**Prompt Pattern**:
```
PURPOSE: Analyze incremental changes + minimal tasks
TASK: Compare new requirements with current state → delta → incremental tasks
CONTEXT: @progress.md @plan.json | New requirements
EXPECTED: Delta analysis + incremental tasks
```

## Error Correction Mechanism

### Correction Format in progress.md

When verification finds issues:

```markdown
### Corrected Understanding (Iteration 2)

- ~~Assumed API returns array~~ → API returns object with data array
  - Why wrong: Misread API response structure
  - Evidence: Runtime error "map is not a function"
  - Fix applied: Changed `response.map` to `response.data.map`

- ~~Thought validation was client-side~~ → Validation is server-side
  - Why wrong: Only checked frontend code
  - Evidence: Backend validation logic found in exploration
  - Fix applied: Removed redundant client validation
```

## Error Handling

| Situation | Action |
|-----------|--------|
| Exploration agent failure | Skip angle, continue with remaining explorations |
| Gemini planning unavailable | Fallback to direct Claude planning (Low complexity mode) |
| Task execution failure | Ask user: Retry/Skip/Abort |
| Verification finds blockers | Force iteration mode, cannot proceed |
| plan.json corrupted | Regenerate from progress.md + Gemini |
| >5 iterations | Suggest breaking into sub-sessions |

## Comparison with /workflow:lite-plan

| Feature | /workflow:lite-plan | /workflow:develop-with-file |
|---------|---------------------|----------------------------|
| State tracking | In-memory → lite-execute | progress.md (persistent) |
| Exploration | Multi-agent parallel | ✅ Same |
| Planning | cli-lite-planning-agent | Gemini CLI (more flexible) |
| Execution | Delegated to lite-execute | Built-in (multi-agent/CLI) |
| Verification | None | ✅ Gemini code review |
| Iteration support | ❌ | ✅ Incremental tasks |
| Document continuity | ❌ (session ends) | ✅ (progress.md timeline) |
| Executor assignment | Global only | ✅ Per-task |

## Usage Recommendations

Use `/workflow:develop-with-file` when:
- Complex features requiring multiple phases (explore → plan → execute → verify)
- Need persistent progress tracking across sessions
- Want Gemini-assisted planning and verification
- Anticipate multiple iterations/refinements
- Team needs to understand development rationale

Use `/workflow:lite-plan` when:
- Quick one-off tasks
- Simple features (Low complexity)
- Don't need verification
- Session-level documentation not needed
