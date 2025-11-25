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

### Phase 1: Intelligent Multi-Angle Exploration

**Session Setup**:
```javascript
const taskSlug = task_description.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const shortTimestamp = timestamp.substring(0, 19).replace('T', '-')
const sessionId = `${taskSlug}-${shortTimestamp}`
const sessionFolder = `.workflow/.lite-plan/${sessionId}`

bash(`mkdir -p ${sessionFolder}`)
```

**Exploration Decision Logic**:
```javascript
needsExploration = (
  flags.includes('--explore') || flags.includes('-e') ||
  task.mentions_specific_files ||
  task.requires_codebase_context ||
  task.needs_architecture_understanding ||
  task.modifies_existing_code
)

if (!needsExploration) {
  // Skip to Phase 2 (Clarification) or Phase 3 (Planning)
  proceed_to_next_phase()
}
```

**Complexity Assessment & Exploration Count**:
```javascript
// Estimate task complexity based on description
function estimateComplexity(taskDescription) {
  const wordCount = taskDescription.split(/\s+/).length
  const text = taskDescription.toLowerCase()

  const indicators = {
    high: ['refactor', 'migrate', 'redesign', 'architecture', 'system'],
    medium: ['implement', 'add feature', 'integrate', 'modify module'],
    low: ['fix', 'update', 'adjust', 'tweak']
  }

  let score = 0
  if (wordCount > 50) score += 2
  else if (wordCount > 20) score += 1

  if (indicators.high.some(w => text.includes(w))) score += 3
  else if (indicators.medium.some(w => text.includes(w))) score += 2
  else if (indicators.low.some(w => text.includes(w))) score += 1

  // 0-2: Low, 3-4: Medium, 5+: High
  if (score >= 5) return 'High'
  if (score >= 3) return 'Medium'
  return 'Low'
}

const complexity = estimateComplexity(task_description)
const explorationCount = complexity === 'High' ? 4 : (complexity === 'Medium' ? 3 : 1)

console.log(`
## Exploration Plan

Task Complexity: ${complexity}
Exploration Count: ${explorationCount} angle(s)

Starting intelligent multi-angle exploration...
`)
```

**Launch Parallel Explorations** - Each agent chooses its own angle:

```javascript
// Launch multiple cli-explore-agent tasks in parallel
const explorationTasks = []

for (let i = 1; i <= explorationCount; i++) {
  explorationTasks.push(
    Task(
      subagent_type="cli-explore-agent",
      description=`Explore angle ${i}/${explorationCount}`,
      prompt=`
**以解决任务为目标的智能探索** - 从不同角度分析代码库，为任务规划提供上下文。

## Output Schema Reference
~/.claude/workflows/cli-templates/schemas/explore-json-schema.json

## Task Description
${task_description}

## Your Mission
You are exploration ${i} of ${explorationCount} parallel explorations.

**Choose ONE unique angle** most relevant to solving this task:
- Choose different angles from what other explorations might cover
- Focus on aspects critical for task success
- Examples: architecture, security, dataflow, patterns, performance, dependencies, testing, error-handling, state-management, etc.
- Be creative and task-driven - not limited to examples above

## Output File Naming
Choose a descriptive angle name (lowercase, no spaces, hyphen-separated if needed)
Examples: "architecture", "security", "dataflow", "auth-patterns", "error-handling"

Generate file: exploration-{your-chosen-angle}.json

Example angles based on task type:
- Architecture refactoring → "architecture", "modularity", "dependencies"
- Security feature → "security", "auth-patterns", "dataflow"
- Performance fix → "performance", "bottlenecks", "caching"
- Bug fix → "error-handling", "dataflow", "state-management"

## Requirements
Generate exploration-{angle}.json with:
- project_structure: Architecture and module organization relevant to your angle
- relevant_files: File paths to be affected
- patterns: Code patterns relevant to your angle
- dependencies: Dependencies relevant to your angle
- integration_points: Integration points from your angle's viewpoint
- constraints: Constraints related to your angle
- clarification_needs: Ambiguities requiring user input
- _metadata:
  - timestamp: ISO 8601 timestamp
  - task_description: Original task description
  - source: "cli-explore-agent"
  - exploration_angle: "your-chosen-angle"
  - exploration_index: ${i}
  - total_explorations: ${explorationCount}

## Execution Steps
1. Decide your unique exploration angle based on task needs
2. Structural scan: get_modules_by_depth.sh, find, rg (focused on your angle)
3. Semantic analysis: Use Gemini for patterns/architecture specific to your angle
4. Write JSON: Write('${sessionFolder}/exploration-{your-angle}.json', jsonContent)
5. Return: Brief summary stating your chosen angle and key findings

Time Limit: 60 seconds

**Remember**: Choose a unique, task-relevant angle. Don't duplicate other explorations' focus.
`
    )
  )
}

// Execute all exploration tasks in parallel (single message, multiple tool calls)
console.log(`Launching ${explorationCount} parallel explorations...`)
```

**Auto-discover Generated Exploration Files**:
```javascript
// After explorations complete, auto-discover all exploration-*.json files
const explorationFiles = bash(`find ${sessionFolder} -name "exploration-*.json" -type f`)
  .split('\n')
  .filter(f => f.trim())

// Read metadata to build manifest
const explorationManifest = {
  session_id: sessionId,
  task_description: task_description,
  timestamp: new Date().toISOString(),
  complexity: complexity,
  exploration_count: explorationCount,
  explorations: explorationFiles.map(file => {
    const data = JSON.parse(Read(file))
    const filename = path.basename(file)
    return {
      angle: data._metadata.exploration_angle,
      file: filename,
      path: file,
      index: data._metadata.exploration_index
    }
  })
}

Write(`${sessionFolder}/explorations-manifest.json`, JSON.stringify(explorationManifest, null, 2))

console.log(`
## Exploration Complete

Generated exploration files in ${sessionFolder}:
${explorationManifest.explorations.map(e => `- exploration-${e.angle}.json (angle: ${e.angle})`).join('\n')}

Manifest: explorations-manifest.json
Angles explored: ${explorationManifest.explorations.map(e => e.angle).join(', ')}
`)
```

**Output**:
- `${sessionFolder}/exploration-{angle1}.json`
- `${sessionFolder}/exploration-{angle2}.json`
- ... (1-4 files based on complexity)
- `${sessionFolder}/explorations-manifest.json`

---

### Phase 2: Clarification (Optional)

**Skip if**: No exploration or `clarification_needs` is empty across all explorations

**Aggregate clarification needs from all exploration angles**:
```javascript
// Load manifest and all exploration files
const manifest = JSON.parse(Read(`${sessionFolder}/explorations-manifest.json`))
const explorations = manifest.explorations.map(exp => ({
  angle: exp.angle,
  data: JSON.parse(Read(exp.path))
}))

// Aggregate clarification needs from all explorations
const allClarifications = []
explorations.forEach(exp => {
  if (exp.data.clarification_needs?.length > 0) {
    exp.data.clarification_needs.forEach(need => {
      allClarifications.push({
        ...need,
        source_angle: exp.angle
      })
    })
  }
})

// Deduplicate by question similarity
function deduplicateClarifications(clarifications) {
  const unique = []
  clarifications.forEach(c => {
    const isDuplicate = unique.some(u =>
      u.question.toLowerCase() === c.question.toLowerCase()
    )
    if (!isDuplicate) unique.push(c)
  })
  return unique
}

const uniqueClarifications = deduplicateClarifications(allClarifications)

if (uniqueClarifications.length > 0) {
  AskUserQuestion({
    questions: uniqueClarifications.map(need => ({
      question: `[${need.source_angle}] ${need.question}\n\nContext: ${need.context}`,
      header: need.source_angle,
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

## Multi-Angle Exploration Context

${manifest.explorations.map(exp => `### Exploration: ${exp.angle} (${exp.file})
Path: ${exp.path}

Read this file for detailed ${exp.angle} analysis.`).join('\n\n')}

Total explorations: ${manifest.exploration_count}
Angles covered: ${manifest.explorations.map(e => e.angle).join(', ')}

Manifest: ${sessionFolder}/explorations-manifest.json

## User Clarifications
${JSON.stringify(clarificationContext) || "None"}

## Complexity Level
${complexity}

## Requirements
Generate plan.json with:
- summary: 2-3 sentence overview
- approach: High-level implementation strategy (incorporating insights from all exploration angles)
- tasks: 3-10 structured tasks with:
  - title, file, action, description
  - implementation (3-7 steps)
  - reference (pattern, files, examples)
  - acceptance (2-4 criteria)
- estimated_time, recommended_execution, complexity
- _metadata:
  - timestamp, source, planning_mode
  - exploration_angles: ${JSON.stringify(manifest.explorations.map(e => e.angle))}

## Execution
1. Read ALL exploration files for comprehensive context
2. Execute CLI planning using Gemini (Qwen fallback)
3. Synthesize findings from multiple exploration angles
4. Parse output and structure plan
5. Write JSON: Write('${sessionFolder}/plan.json', jsonContent)
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

// Load manifest and all exploration files
const manifest = JSON.parse(Read(`${sessionFolder}/explorations-manifest.json`))
const explorations = {}

manifest.explorations.forEach(exp => {
  if (file_exists(exp.path)) {
    explorations[exp.angle] = JSON.parse(Read(exp.path))
  }
})

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
    session_folder: sessionFolder,
    exploration_count: manifest.exploration_count,
    exploration_angles: manifest.explorations.map(e => e.angle)
  },

  context: {
    requirements: [task_description],
    plan: {
      summary: plan.summary,
      approach: plan.approach,
      tasks: plan.tasks
    },

    // Multi-angle exploration structure
    explorations: explorations,

    // Exploration files for reference
    exploration_files: manifest.explorations.map(exp => ({
      angle: exp.angle,
      file: exp.file,
      path: exp.path,
      index: exp.index
    })),

    clarifications: clarificationContext || null,

    // Aggregate relevant files from all exploration angles
    focus_paths: Array.from(new Set(
      Object.values(explorations).flatMap(exp => exp.relevant_files || [])
    )),

    acceptance: plan.tasks.flatMap(t => t.acceptance)
  }
}

Write(`${sessionFolder}/task.json`, JSON.stringify(taskJson, null, 2))
```

**Step 5.2: Store executionContext**

```javascript
executionContext = {
  planObject: plan,
  explorationsContext: explorations,  // Multiple explorations
  explorationAngles: manifest.explorations.map(e => e.angle),
  explorationManifest: manifest,
  clarificationContext: clarificationContext || null,
  executionMethod: userSelection.execution_method,
  codeReviewTool: userSelection.code_review_tool,
  originalUserInput: task_description,
  session: {
    id: sessionId,
    folder: sessionFolder,
    artifacts: {
      explorations: manifest.explorations.map(exp => ({
        angle: exp.angle,
        path: exp.path
      })),
      explorations_manifest: `${sessionFolder}/explorations-manifest.json`,
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
├── exploration-{angle1}.json      # Exploration angle 1 (agent-decided)
├── exploration-{angle2}.json      # Exploration angle 2 (agent-decided)
├── exploration-{angle3}.json      # Exploration angle 3 (if applicable)
├── exploration-{angle4}.json      # Exploration angle 4 (if applicable)
├── explorations-manifest.json     # Exploration index
├── plan.json                      # Implementation plan
└── task.json                      # Task definition with multi-exploration refs
```

**Example** (angles decided by agents):
```
.workflow/.lite-plan/implement-jwt-refresh-2025-11-25-14-30-25/
├── exploration-architecture.json
├── exploration-auth-patterns.json
├── exploration-security.json
├── explorations-manifest.json
├── plan.json
└── task.json
```

## Error Handling

| Error | Resolution |
|-------|------------|
| Exploration agent failure | Skip exploration, continue with task description only |
| Planning agent failure | Fallback to direct planning by Claude |
| Clarification timeout | Use exploration findings as-is |
| Confirmation timeout | Save context, display resume instructions |
| Modify loop > 3 times | Suggest breaking task or using /workflow:plan |
