---
description: Lightweight interactive planning workflow with direct exploration, outputs plan.json after user confirmation
argument-hint: TASK="<task description or file.md path>" [EXPLORE="true"]
---

# Workflow Lite-Plan Command

## Overview

Intelligent lightweight planning command with dynamic workflow adaptation based on task complexity. Focuses on planning phases (exploration, clarification, planning, confirmation) and outputs plan.json for subsequent execution.

**Core capabilities:**
- Intelligent task analysis with automatic exploration detection
- Direct code exploration (grep, find, file reading) when codebase understanding needed
- Interactive clarification after exploration to gather missing information
- Adaptive planning strategy based on complexity
- Two-step confirmation: plan display → user approval
- Outputs plan.json file after user confirmation

## Task Description

**Target task**: $TASK
**Force exploration**: $EXPLORE

## Execution Process

```
Phase 1: Task Analysis & Exploration
   ├─ Parse input (description or .md file)
   ├─ Intelligent complexity assessment (Low/Medium/High)
   ├─ Exploration decision (auto-detect or EXPLORE="true")
   └─ Decision:
      ├─ needsExploration=true → Direct exploration using grep/find/read
      └─ needsExploration=false → Skip to Phase 2/3

Phase 2: Clarification (optional)
   ├─ Aggregate clarification needs from exploration
   ├─ Output questions to user
   └─ STOP and wait for user reply

Phase 3: Planning (NO CODE EXECUTION - planning only)
   └─ Generate plan.json following schema
      └─ MUST proceed to Phase 4

Phase 4: Confirmation
   ├─ Display plan summary (tasks, complexity, estimated time)
   ├─ Output confirmation request
   └─ STOP and wait for user approval

Phase 5: Output
   └─ Write plan.json to session folder
```

## Implementation

### Phase 1: Intelligent Direct Exploration

**Session Setup** (MANDATORY - follow exactly):
```javascript
// Helper: Get UTC+8 (China Standard Time) ISO string
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

const taskSlug = "$TASK".toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
const dateStr = getUtc8ISOString().substring(0, 10)  // Format: 2025-11-29

const sessionId = `${taskSlug}-${dateStr}`  // e.g., "implement-jwt-refresh-2025-11-29"
const sessionFolder = `.workflow/.lite-plan/${sessionId}`

// Create session folder
mkdir -p ${sessionFolder}
```

**Exploration Decision Logic**:
```javascript
needsExploration = (
  "$EXPLORE" === "true" ||
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

**Complexity Assessment** (Intelligent Analysis):
```javascript
// Analyzes task complexity based on:
// - Scope: How many systems/modules are affected?
// - Depth: Surface change vs architectural impact?
// - Risk: Potential for breaking existing functionality?
// - Dependencies: How interconnected is the change?

const complexity = analyzeTaskComplexity("$TASK")
// Returns: 'Low' | 'Medium' | 'High'
// Low: Single file, isolated change, minimal risk
// Medium: Multiple files, some dependencies, moderate risk
// High: Cross-module, architectural, high risk

// Angle assignment based on task type
const ANGLE_PRESETS = {
  architecture: ['architecture', 'dependencies', 'modularity', 'integration-points'],
  security: ['security', 'auth-patterns', 'dataflow', 'validation'],
  performance: ['performance', 'bottlenecks', 'caching', 'data-access'],
  bugfix: ['error-handling', 'dataflow', 'state-management', 'edge-cases'],
  feature: ['patterns', 'integration-points', 'testing', 'dependencies']
}

function selectAngles(taskDescription, count) {
  const text = taskDescription.toLowerCase()
  let preset = 'feature' // default

  if (/refactor|architect|restructure|modular/.test(text)) preset = 'architecture'
  else if (/security|auth|permission|access/.test(text)) preset = 'security'
  else if (/performance|slow|optimi|cache/.test(text)) preset = 'performance'
  else if (/fix|bug|error|issue|broken/.test(text)) preset = 'bugfix'

  return ANGLE_PRESETS[preset].slice(0, count)
}

const selectedAngles = selectAngles("$TASK", complexity === 'High' ? 4 : (complexity === 'Medium' ? 3 : 1))

console.log(`
## Exploration Plan

Task Complexity: ${complexity}
Selected Angles: ${selectedAngles.join(', ')}

Starting direct exploration...
`)
```

**Direct Exploration** (No Agent - Use grep/find/read directly):

```javascript
// For each selected angle, perform direct exploration

selectedAngles.forEach((angle, index) => {
  console.log(`\n### Exploring: ${angle} (${index + 1}/${selectedAngles.length})`)

  // Step 1: Structural Scan
  // - Find relevant files using grep/rg
  // - Analyze directory structure
  // - Identify modules related to the angle

  // Example commands:
  // rg -l "keyword_from_task" --type ts
  // find . -name "*.ts" -path "*auth*"
  // tree -L 3 src/

  // Step 2: Content Analysis
  // - Read key files identified
  // - Analyze patterns and conventions
  // - Identify integration points

  // Step 3: Document Findings
  const explorationResult = {
    angle: angle,
    project_structure: [], // Modules/architecture relevant to angle
    relevant_files: [],    // Files affected from angle perspective
    patterns: [],          // Angle-related patterns to follow
    dependencies: [],      // Dependencies relevant to angle
    integration_points: [], // Where to integrate from angle viewpoint
    constraints: [],       // Angle-specific limitations/conventions
    clarification_needs: [], // Angle-related ambiguities
    _metadata: {
      exploration_angle: angle,
      exploration_index: index + 1,
      timestamp: getUtc8ISOString()
    }
  }

  // Write exploration result
  Write(`${sessionFolder}/exploration-${angle}.json`, JSON.stringify(explorationResult, null, 2))
})
```

**Build Exploration Manifest**:
```javascript
// After all explorations complete, build manifest
const explorationFiles = find(`${sessionFolder}`, "-name", "exploration-*.json")

const explorationManifest = {
  session_id: sessionId,
  task_description: "$TASK",
  timestamp: getUtc8ISOString(),
  complexity: complexity,
  exploration_count: selectedAngles.length,
  explorations: explorationFiles.map(file => {
    const data = JSON.parse(Read(file))
    return {
      angle: data._metadata.exploration_angle,
      file: path.basename(file),
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

// Intelligent deduplication: analyze allClarifications by intent
// - Identify questions with similar intent across different angles
// - Merge similar questions: combine options, consolidate context
// - Produce dedupedClarifications with unique intents only
const dedupedClarifications = intelligentMerge(allClarifications)
```

**Output Questions and Wait for User Reply**:
```javascript
if (dedupedClarifications.length > 0) {
  console.log(`
## Clarification Needed

Based on exploration, the following questions need your input:

${dedupedClarifications.map((need, index) => `
### Question ${index + 1}: [${need.source_angle}]

**${need.question}**

Context: ${need.context}

Options:
${need.options.map((opt, i) => `  ${i + 1}. ${opt}${need.recommended === i ? ' ★ (Recommended)' : ''}`).join('\n')}
`).join('\n')}

---

**Please reply with your choices** (e.g., "Q1: 2, Q2: 1, Q3: 3") to continue planning.

**WAITING FOR USER INPUT...**
`)

  // STOP HERE - Wait for user reply before continuing to Phase 3
  return
}
```

**After User Reply**: Store responses in `clarificationContext` and proceed to Phase 3.

---

### Phase 3: Planning

**IMPORTANT**: Phase 3 is **planning only** - NO code execution.

**Read Schema**:
```javascript
// Read plan schema for reference
const schema = Read("~/.claude/workflows/cli-templates/schemas/plan-json-schema.json")
```

**Read All Exploration Files**:
```javascript
// MANDATORY - Read and review ALL exploration files
const manifest = JSON.parse(Read(`${sessionFolder}/explorations-manifest.json`))
manifest.explorations.forEach(exp => {
  const explorationData = Read(exp.path)
  console.log(`\n### Exploration: ${exp.angle}\n${explorationData}`)
})
```

**Generate Plan**:
```javascript
// Generate plan following schema
// Plan MUST incorporate insights from exploration files
const plan = {
  summary: "Brief description of what will be implemented",
  approach: "High-level approach and strategy",
  tasks: [
    // Each task: { id, title, description, scope, files, depends_on, execution_group, complexity }
    // Group by feature/module, NOT by file
    // 2-7 tasks recommended
  ],
  estimated_time: "Total estimated time",
  complexity: complexity,  // Low | Medium | High
  _metadata: {
    timestamp: getUtc8ISOString(),
    source: "lite-plan",
    planning_mode: "direct",
    exploration_angles: manifest.explorations.map(e => e.angle)
  }
}
```

**Task Grouping Rules**:
1. **Group by feature**: All changes for one feature = one task (even if 3-5 files)
2. **Group by context**: Tasks with similar context or related functional changes can be grouped together
3. **Minimize task count**: Simple, unrelated tasks can also be grouped to reduce overhead
4. **Avoid file-per-task**: Do NOT create separate tasks for each file
5. **Substantial tasks**: Each task should represent 15-60 minutes of work
6. **True dependencies only**: Only use depends_on when Task B cannot start without Task A's output
7. **Prefer parallel**: Most tasks should be independent (no depends_on)

**Proceed to Phase 4** - DO NOT execute code here.

---

### Phase 4: Task Confirmation

**Display Plan Summary**:
```javascript
const plan = JSON.parse(Read(`${sessionFolder}/plan.json`))

console.log(`
## Implementation Plan

**Summary**: ${plan.summary}
**Approach**: ${plan.approach}

**Tasks** (${plan.tasks.length}):
${plan.tasks.map((t, i) => `
### Task ${i+1}: ${t.title}
- **Description**: ${t.description}
- **Scope**: ${t.scope}
- **Files**: ${t.files.join(', ')}
- **Complexity**: ${t.complexity}
- **Dependencies**: ${t.depends_on?.join(', ') || 'None'}
`).join('\n')}

**Overall Complexity**: ${plan.complexity}
**Estimated Time**: ${plan.estimated_time}

---

## Confirmation Required

Please review the plan above and reply with one of the following:

- **"Allow"** - Proceed with this plan, output plan.json
- **"Modify"** - Describe what changes you want to make
- **"Cancel"** - Abort the planning workflow

**WAITING FOR USER CONFIRMATION...**
`)

// STOP HERE - Wait for user confirmation before writing plan.json
return
```

---

### Phase 5: Output Plan File

**After User Confirms "Allow"**:
```javascript
// Write final plan.json to session folder
Write(`${sessionFolder}/plan.json`, JSON.stringify(plan, null, 2))

console.log(`
## Plan Output Complete

**Plan file written**: ${sessionFolder}/plan.json

**Session folder**: ${sessionFolder}

**Contents**:
- explorations-manifest.json
${manifest.explorations.map(e => `- exploration-${e.angle}.json`).join('\n')}
- plan.json

---

You can now use this plan with your preferred execution method:
- Manual implementation following the tasks
- Pass to another tool/agent for execution
- Import into project management system
`)
```

---

## Session Folder Structure

```
.workflow/.lite-plan/{task-slug}-{YYYY-MM-DD}/
├── exploration-{angle1}.json      # Exploration angle 1
├── exploration-{angle2}.json      # Exploration angle 2
├── exploration-{angle3}.json      # Exploration angle 3 (if applicable)
├── exploration-{angle4}.json      # Exploration angle 4 (if applicable)
├── explorations-manifest.json     # Exploration index
└── plan.json                      # Implementation plan (after confirmation)
```

**Example**:
```
.workflow/.lite-plan/implement-jwt-refresh-2025-11-25/
├── exploration-architecture.json
├── exploration-auth-patterns.json
├── exploration-security.json
├── explorations-manifest.json
└── plan.json
```

## Workflow States

| State | Action | Next |
|-------|--------|------|
| Phase 1 Complete | Exploration done | → Phase 2 or 3 |
| Phase 2 Output | Questions displayed | → Wait for user reply |
| User Replied | Clarifications received | → Phase 3 |
| Phase 3 Complete | Plan generated | → Phase 4 |
| Phase 4 Output | Plan displayed | → Wait for user confirmation |
| User: "Allow" | Confirmed | → Phase 5 (Write plan.json) |
| User: "Modify" | Changes requested | → Revise plan, back to Phase 4 |
| User: "Cancel" | Aborted | → End workflow |

## Error Handling

| Error | Resolution |
|-------|------------|
| Exploration failure | Skip exploration, continue with task description only |
| No relevant files found | Broaden search scope or proceed with minimal context |
| Clarification timeout | Use exploration findings as-is |
| Confirmation timeout | Save context, display resume instructions |
| Modify loop > 3 times | Suggest breaking task into smaller pieces |

---

**Now execute the lite-plan workflow for task**: $TASK
