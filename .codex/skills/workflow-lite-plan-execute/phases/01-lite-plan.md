# Phase 1: Lite Plan

## Overview

Intelligent lightweight planning command with dynamic workflow adaptation based on task complexity. Focuses on planning phases (exploration, clarification, planning, confirmation) and delegates execution to Phase 4: Lite Execute (phases/04-lite-execute.md).

**Core capabilities:**
- Intelligent task analysis with automatic exploration detection
- Dynamic code exploration (cli-explore-agent) when codebase understanding needed
- Interactive clarification after exploration to gather missing information
- Adaptive planning: Low complexity → Direct Claude; Medium/High → cli-lite-planning-agent
- Two-step confirmation: plan display → multi-dimensional input collection
- Execution execute with complete context handoff to lite-execute

## Parameters

| Parameter | Description |
|-----------|-------------|
| `-y`, `--yes` | Skip all confirmations (auto mode) |
| `-e`, `--explore` | Force code exploration phase (overrides auto-detection) |
| `<task-description>` | Task description or path to .md file (required) |

## Output Artifacts

| Artifact | Description |
|----------|-------------|
| `exploration-{angle}.json` | Per-angle exploration results (1-4 files based on complexity) |
| `explorations-manifest.json` | Index of all exploration files |
| `exploration-notes.md` | Full exploration log (consumed by Plan phase, 6 sections) |
| `exploration-notes-refined.md` | Refined exploration log (consumed by Execute phase, task-relevant only) |
| `planning-context.md` | Evidence paths + synthesized understanding |
| `plan.json` | Structured implementation plan (plan-json-schema.json) |

**Output Directory**: `.workflow/.lite-plan/{task-slug}-{YYYY-MM-DD}/`

**Agent Usage**:
- Low complexity → Direct Claude planning (no agent)
- Medium/High complexity → `cli-lite-planning-agent` generates `plan.json`

**Schema Reference**: `~/.claude/workflows/cli-templates/schemas/plan-json-schema.json`

## Auto Mode Defaults

When `--yes` or `-y` flag is used:
- **Clarification Questions**: Skipped (no clarification phase)
- **Plan Confirmation**: Auto-selected "Allow"
- **Execution Method**: Auto-selected "Auto"
- **Code Review**: Auto-selected "Skip"

**Flag Parsing**:
```javascript
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')
const forceExplore = $ARGUMENTS.includes('--explore') || $ARGUMENTS.includes('-e')
```

## Execution Process

```
Phase 1: Task Analysis & Exploration
   ├─ Parse input (description or .md file)
   ├─ intelligent complexity assessment (Low/Medium/High)
   ├─ Exploration decision (auto-detect or --explore flag)
   ├─ Context protection: If file reading ≥50k chars → force cli-explore-agent
   └─ Decision:
      ├─ needsExploration=true → Launch parallel cli-explore-agents (1-4 based on complexity)
      └─ needsExploration=false → Skip to Phase 2/3

Phase 2: Clarification (optional, multi-round)
   ├─ Aggregate clarification_needs from all exploration angles
   ├─ Deduplicate similar questions
   └─ Decision:
      ├─ Has clarifications → ASK_USER (max 4 questions per round, multiple rounds allowed)
      └─ No clarifications → Skip to Phase 3

Phase 3: Planning (NO CODE EXECUTION - planning only)
   └─ Decision (based on Phase 1 complexity):
      ├─ Low → Load schema: cat ~/.claude/workflows/cli-templates/schemas/plan-json-schema.json → Direct Claude planning (following schema) → plan.json
      └─ Medium/High → cli-lite-planning-agent → plan.json (agent internally executes quality check)

Phase 4: Confirmation & Selection
   ├─ Display plan summary (tasks, complexity, estimated time)
   └─ ASK_USER:
      ├─ Confirm: Allow / Modify / Cancel
      ├─ Execution: Agent / Codex / Auto
      └─ Review: Gemini / Agent / Skip

Phase 5: Execute
   ├─ Build executionContext (plan + explorations + clarifications + selections)
   └─ → Hand off to Phase 4: Lite Execute (phases/04-lite-execute.md) --in-memory
```

## Implementation

### Phase 1: Intelligent Multi-Angle Exploration

**Session Setup** (MANDATORY - follow exactly):
```javascript
// Helper: Get UTC+8 (China Standard Time) ISO string
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

const taskSlug = task_description.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
const dateStr = getUtc8ISOString().substring(0, 10)  // Format: 2025-11-29

const sessionId = `${taskSlug}-${dateStr}`  // e.g., "implement-jwt-refresh-2025-11-29"
const sessionFolder = `.workflow/.lite-plan/${sessionId}`

bash(`mkdir -p ${sessionFolder} && test -d ${sessionFolder} && echo "SUCCESS: ${sessionFolder}" || echo "FAILED: ${sessionFolder}"`)
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

**⚠️ Context Protection**: File reading ≥50k chars → force `needsExploration=true` (delegate to cli-explore-agent)

**Complexity Assessment** (Intelligent Analysis):
```javascript
// analyzes task complexity based on:
// - Scope: How many systems/modules are affected?
// - Depth: Surface change vs architectural impact?
// - Risk: Potential for breaking existing functionality?
// - Dependencies: How interconnected is the change?

const complexity = analyzeTaskComplexity(task_description)
// Returns: 'Low' | 'Medium' | 'High'
// Low: Single file, isolated change, minimal risk
// Medium: Multiple files, some dependencies, moderate risk
// High: Cross-module, architectural, high risk

// Angle assignment based on task type (orchestrator decides, not agent)
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

const selectedAngles = selectAngles(task_description, complexity === 'High' ? 4 : (complexity === 'Medium' ? 3 : 1))

// Planning strategy determination
const planningStrategy = complexity === 'Low'
  ? 'Direct Claude Planning'
  : 'cli-lite-planning-agent'

console.log(`
## Exploration Plan

Task Complexity: ${complexity}
Selected Angles: ${selectedAngles.join(', ')}
Planning Strategy: ${planningStrategy}

Launching ${selectedAngles.length} parallel explorations...
`)
```

**Launch Parallel Explorations** - Orchestrator assigns angle to each agent:

**⚠️ CRITICAL - SYNCHRONOUS EXECUTION**:
- **Exploration results are REQUIRED before planning**
- Use `spawn_agent` + `wait` pattern to ensure results are collected


```javascript
// Step 1: Create exploration agents in parallel
const explorationAgents = []

selectedAngles.forEach((angle, index) => {
  const agentId = spawn_agent({
    message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-explore-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

## Task Objective
Execute **${angle}** exploration for task planning context. Analyze codebase from this specific angle to discover relevant structure, patterns, and constraints.

## Output Location

**Session Folder**: ${sessionFolder}
**Output File**: ${sessionFolder}/exploration-${angle}.json

## Assigned Context
- **Exploration Angle**: ${angle}
- **Task Description**: ${task_description}
- **Exploration Index**: ${index + 1} of ${selectedAngles.length}

## MANDATORY STEPS (Execute by Agent)
**You (cli-explore-agent) MUST execute these steps in order:**
1. Run: ccw tool exec get_modules_by_depth '{}' (project structure)
2. Run: rg -l "{keyword_from_task}" --type ts (locate relevant files)
3. Execute: cat ~/.claude/workflows/cli-templates/schemas/explore-json-schema.json (get output schema reference)
4. Read: .workflow/project-tech.json (technology stack and architecture context)
5. Read: .workflow/project-guidelines.json (user-defined constraints and conventions)

## Exploration Strategy (${angle} focus)

**Step 1: Structural Scan** (Bash)
- get_modules_by_depth.sh → identify modules related to ${angle}
- find/rg → locate files relevant to ${angle} aspect
- Analyze imports/dependencies from ${angle} perspective

**Step 2: Semantic Analysis** (Gemini CLI)
- How does existing code handle ${angle} concerns?
- What patterns are used for ${angle}?
- Where would new code integrate from ${angle} viewpoint?

**Step 3: Write Output**
- Consolidate ${angle} findings into JSON
- Identify ${angle}-specific clarification needs

## Expected Output

**Schema Reference**: Schema obtained in MANDATORY FIRST STEPS step 3, follow schema exactly

**Required Fields** (all ${angle} focused):
- project_structure: Modules/architecture relevant to ${angle}
- relevant_files: Files affected from ${angle} perspective
  **IMPORTANT**: Use object format with relevance scores for synthesis:
  \`[{path: "src/file.ts", relevance: 0.85, rationale: "Core ${angle} logic"}]\`
  Scores: 0.7+ high priority, 0.5-0.7 medium, <0.5 low
- patterns: ${angle}-related patterns to follow
- dependencies: Dependencies relevant to ${angle}
- integration_points: Where to integrate from ${angle} viewpoint (include file:line locations)
- constraints: ${angle}-specific limitations/conventions
- clarification_needs: ${angle}-related ambiguities (options array + recommended index)
- _metadata.exploration_angle: "${angle}"

## Success Criteria
- [ ] Schema obtained via cat explore-json-schema.json
- [ ] get_modules_by_depth.sh executed
- [ ] At least 3 relevant files identified with ${angle} rationale
- [ ] Patterns are actionable (code examples, not generic advice)
- [ ] Integration points include file:line locations
- [ ] Constraints are project-specific to ${angle}
- [ ] JSON output follows schema exactly
- [ ] clarification_needs includes options + recommended

## Execution
**Write**: \`${sessionFolder}/exploration-${angle}.json\`
**Return**: 2-3 sentence summary of ${angle} findings
`
  })
  
  explorationAgents.push({ agentId, angle, index })
})

// Step 2: Batch wait for all exploration agents
const explorationResults = wait({
  ids: explorationAgents.map(a => a.agentId),
  timeout_ms: 600000  // 10 minutes
})

// Step 3: Check for timeout
if (explorationResults.timed_out) {
  console.log('部分探索超时，继续使用已完成结果')
}

// Step 4: Collect completed results
const completedExplorations = {}
explorationAgents.forEach(({ agentId, angle }) => {
  if (explorationResults.status[agentId].completed) {
    completedExplorations[angle] = explorationResults.status[agentId].completed
  }
})

// Step 5: Close all exploration agents
explorationAgents.forEach(({ agentId }) => close_agent({ id: agentId }))
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
  timestamp: getUtc8ISOString(),
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

**Generate Exploration Notes** (auto-generated after exploration completes):

```javascript
// Step 1: Load all exploration JSON files
const manifest = JSON.parse(Read(`${sessionFolder}/explorations-manifest.json`))
const explorations = manifest.explorations.map(exp => ({
  angle: exp.angle,
  data: JSON.parse(Read(exp.path))
}))

// Step 2: Extract core files (relevance ≥ 0.7)
const coreFiles = []
explorations.forEach(exp => {
  if (Array.isArray(exp.data.relevant_files)) {
    exp.data.relevant_files.forEach(f => {
      if (typeof f === 'object' && f.relevance >= 0.7) {
        coreFiles.push({ path: f.path, relevance: f.relevance, rationale: f.rationale, angle: exp.angle })
      }
    })
  }
})
const uniqueCoreFiles = deduplicateByPath(coreFiles.sort((a, b) => b.relevance - a.relevance))

// Step 3: Build exploration notes Markdown (6 sections)
const explorationLog = `# Exploration Notes: ${task_description.slice(0, 60)}

**Generated**: ${getUtc8ISOString()}
**Task**: ${task_description}
**Complexity**: ${complexity}
**Exploration Angles**: ${explorations.map(e => e.angle).join(', ')}

---

## Part 1: Multi-Angle Exploration Summary

${explorations.map(exp => `### Angle: ${exp.angle}

**Key Files** (priority sorted):
${formatFileList(exp.data.relevant_files)}

**Code Patterns**: ${exp.data.patterns}

**Integration Points**: ${exp.data.integration_points}

**Dependencies**: ${exp.data.dependencies}

**Constraints**: ${exp.data.constraints}
`).join('\n---\n')}

---

## Part 2: File Deep-Dive Summary

${uniqueCoreFiles.slice(0, 10).map(file => {
  const content = Read(file.path)
  const refs = Bash(\`rg "from ['\"].*${path.basename(file.path, path.extname(file.path))}['\"]" --type ts -n | head -10\`)
  return formatFileDeepDive(file, content, refs)
}).join('\n---\n')}

---

## Part 3: Architecture Reasoning Chains

${buildReasoningChains(explorations, task_description)}

---

## Part 4: Potential Risks and Mitigations

${buildRiskMitigations(explorations, uniqueCoreFiles)}

---

## Part 5: Clarification Questions Summary

${aggregateClarifications(explorations)}

---

## Part 6: Execution Recommendations Checklist

${generateExecutionChecklist(task_description, explorations, uniqueCoreFiles)}

---

## Appendix: Key Code Location Index

| Component | File Path | Key Lines | Purpose |
|-----------|-----------|-----------|---------|
${uniqueCoreFiles.slice(0, 15).map(f => `| ${path.basename(f.path)} | ${f.path} | - | ${f.rationale} |`).join('\n')}
`

// Step 4: Write initial exploration notes
Write(`${sessionFolder}/exploration-notes.md`, explorationLog)

console.log(`
## Exploration Notes Generated

File: ${sessionFolder}/exploration-notes.md
Core files: ${uniqueCoreFiles.length}
Angles: ${explorations.map(e => e.angle).join(', ')}

This log will be fully consumed by planning phase, then refined for execution.
`)
```

**Output (new)**:
- `${sessionFolder}/exploration-notes.md` (full version, consumed by Plan phase)

---

### Phase 2: Clarification (Optional, Multi-Round)

**Skip if**: No exploration or `clarification_needs` is empty across all explorations

**⚠️ CRITICAL**: ASK_USER tool limits max 4 questions per call. **MUST execute multiple rounds** to exhaust all clarification needs - do NOT stop at round 1.

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

// Parse --yes flag
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')

if (autoYes) {
  // Auto mode: Skip clarification phase
  console.log(`[--yes] Skipping ${dedupedClarifications.length} clarification questions`)
  console.log(`Proceeding to planning with exploration results...`)
  // Continue to Phase 3
} else if (dedupedClarifications.length > 0) {
  // Interactive mode: Multi-round clarification
  const BATCH_SIZE = 4
  const totalRounds = Math.ceil(dedupedClarifications.length / BATCH_SIZE)

  for (let i = 0; i < dedupedClarifications.length; i += BATCH_SIZE) {
    const batch = dedupedClarifications.slice(i, i + BATCH_SIZE)
    const currentRound = Math.floor(i / BATCH_SIZE) + 1

    console.log(`### Clarification Round ${currentRound}/${totalRounds}`)

    ASK_USER(batch.map(need => ({
      id: `clarify-${need.source_angle}`,
      type: "select",
      prompt: `[${need.source_angle}] ${need.question}\n\nContext: ${need.context}`,
      options: need.options.map((opt, index) => ({
        label: need.recommended === index ? `${opt} ★` : opt,
        description: need.recommended === index ? `Recommended` : `Use ${opt}`
      })),
      default: need.recommended
    })))  // BLOCKS (wait for user response)

    // Store batch responses in clarificationContext before next round
  }
}
```

**Output**: `clarificationContext` (in-memory)

---

### Phase 3: Planning

**Planning Strategy Selection** (based on Phase 1 complexity):

**IMPORTANT**: Phase 3 is **planning only** - NO code execution. All execution happens in Phase 5 via lite-execute.

**Executor Assignment** (Claude 智能分配，plan 生成后执行):

```javascript
// 分配规则（优先级从高到低）：
// 1. 用户明确指定："用 gemini 分析..." → gemini, "codex 实现..." → codex
// 2. 默认 → agent

const executorAssignments = {}  // { taskId: { executor: 'gemini'|'codex'|'agent', reason: string } }
plan.tasks.forEach(task => {
  // Claude 根据上述规则语义分析，为每个 task 分配 executor
  executorAssignments[task.id] = { executor: '...', reason: '...' }
})
```

**Low Complexity** - Direct planning by Claude:
```javascript
// Step 1: Read schema
const schema = Bash(`cat ~/.claude/workflows/cli-templates/schemas/plan-json-schema.json`)

// Step 2: ⚠️ MANDATORY - Read and review ALL exploration files
const manifest = JSON.parse(Read(`${sessionFolder}/explorations-manifest.json`))
manifest.explorations.forEach(exp => {
  const explorationData = Read(exp.path)
  console.log(`\n### Exploration: ${exp.angle}\n${explorationData}`)
})

// Step 3: Generate plan following schema (Claude directly, no agent)
// ⚠️ Plan MUST incorporate insights from exploration files read in Step 2
const plan = {
  summary: "...",
  approach: "...",
  tasks: [...],  // Each task: { id, title, scope, ..., depends_on, execution_group, complexity }
  estimated_time: "...",
  recommended_execution: "Agent",
  complexity: "Low",
  _metadata: { timestamp: getUtc8ISOString(), source: "direct-planning", planning_mode: "direct" }
}

// Step 4: Write plan to session folder
Write(`${sessionFolder}/plan.json`, JSON.stringify(plan, null, 2))

// Step 5: MUST continue to Phase 4 (Confirmation) - DO NOT execute code here
```

**Medium/High Complexity** - Invoke cli-lite-planning-agent:

```javascript
// Step 1: Create planning agent
const planningAgentId = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-lite-planning-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

Generate implementation plan and write plan.json.

## Output Location

**Session Folder**: ${sessionFolder}
**Output Files**:
- ${sessionFolder}/planning-context.md (evidence + understanding)
- ${sessionFolder}/plan.json (implementation plan)

## Output Schema Reference
Execute: cat ~/.claude/workflows/cli-templates/schemas/plan-json-schema.json (get schema reference before generating plan)

## Project Context (MANDATORY - Read Both Files)
1. Read: .workflow/project-tech.json (technology stack, architecture, key components)
2. Read: .workflow/project-guidelines.json (user-defined constraints and conventions)

**CRITICAL**: All generated tasks MUST comply with constraints in project-guidelines.json

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
Generate plan.json following the schema obtained above. Key constraints:
- tasks: 2-7 structured tasks (**group by feature/module, NOT by file**)
- _metadata.exploration_angles: ${JSON.stringify(manifest.explorations.map(e => e.angle))}

## Task Grouping Rules
1. **Group by feature**: All changes for one feature = one task (even if 3-5 files)
2. **Group by context**: Tasks with similar context or related functional changes can be grouped together
3. **Minimize agent count**: Simple, unrelated tasks can also be grouped to reduce agent execution overhead
4. **Avoid file-per-task**: Do NOT create separate tasks for each file
5. **Substantial tasks**: Each task should represent 15-60 minutes of work
6. **True dependencies only**: Only use depends_on when Task B cannot start without Task A's output
7. **Prefer parallel**: Most tasks should be independent (no depends_on)

## Execution
1. Read schema file (cat command above)
2. Execute CLI planning using Gemini (Qwen fallback)
3. Read ALL exploration files for comprehensive context
4. Synthesize findings and generate plan following schema
5. **Write**: \`${sessionFolder}/planning-context.md\` (evidence paths + understanding)
6. **Write**: \`${sessionFolder}/plan.json\`
7. Return brief completion summary
`
})

// Step 2: Wait for planning completion
const planResult = wait({
  ids: [planningAgentId],
  timeout_ms: 900000  // 15 minutes
})

// Step 3: Close planning agent
close_agent({ id: planningAgentId })
```

**Output**: `${sessionFolder}/plan.json`

**Refine Exploration Notes** (auto-executed after Plan completes):

**Purpose**: Generate a self-contained execution reference from exploration-notes.md + plan.json. Execution agents should be able to implement tasks **without re-reading source files**.

**Key Principle**: Each file entry must include enough structural detail (exports, key functions, types, line ranges) that an execution agent can write correct code (imports, function signatures, integration points) without opening the file.

```javascript
// Step 1: Load plan, exploration notes, and exploration JSON files
const plan = JSON.parse(Read(`${sessionFolder}/plan.json`))
const explorationLog = Read(`${sessionFolder}/exploration-notes.md`)
const manifest = JSON.parse(Read(`${sessionFolder}/explorations-manifest.json`))
const explorations = manifest.explorations.map(exp => ({
  angle: exp.angle,
  data: JSON.parse(Read(exp.path))
}))

// Step 2: Extract ALL files referenced in plan (modification_points + reference.files)
const planFiles = new Set()
const planScopes = new Set()
const fileTaskMap = {}  // file → [taskIds] mapping for cross-reference

plan.tasks.forEach(task => {
  if (task.scope) planScopes.add(task.scope)
  const taskFiles = []
  if (task.modification_points) {
    task.modification_points.forEach(mp => {
      planFiles.add(mp.file)
      taskFiles.push(mp.file)
    })
  }
  if (task.reference?.files) {
    task.reference.files.forEach(f => {
      planFiles.add(f)
      taskFiles.push(f)
    })
  }
  taskFiles.forEach(f => {
    if (!fileTaskMap[f]) fileTaskMap[f] = []
    fileTaskMap[f].push(task.id)
  })
})

// Step 3: Read each plan-referenced file and extract structural details
const fileProfiles = {}

Array.from(planFiles).forEach(filePath => {
  try {
    const content = Read(filePath)
    const lines = content.split('\n')
    const totalLines = lines.length

    // Extract exports (named + default)
    const namedExports = []
    const defaultExport = []
    lines.forEach((line, idx) => {
      if (/^export\s+(function|const|class|interface|type|enum|async\s+function)\s+(\w+)/.test(line)) {
        const match = line.match(/^export\s+(?:async\s+)?(?:function|const|class|interface|type|enum)\s+(\w+)/)
        if (match) namedExports.push({ name: match[1], line: idx + 1, declaration: line.trim().substring(0, 120) })
      }
      if (/^export\s+default/.test(line)) {
        defaultExport.push({ line: idx + 1, declaration: line.trim().substring(0, 120) })
      }
    })

    // Extract imports (first 30 lines typically)
    const imports = []
    lines.slice(0, 50).forEach((line, idx) => {
      if (/^import\s/.test(line)) {
        imports.push({ line: idx + 1, statement: line.trim() })
      }
    })

    // Extract key function/class signatures (non-exported too)
    const signatures = []
    lines.forEach((line, idx) => {
      // Function declarations
      if (/^\s*(async\s+)?function\s+\w+/.test(line) || /^\s*(export\s+)?(async\s+)?function\s+\w+/.test(line)) {
        signatures.push({ line: idx + 1, signature: line.trim().substring(0, 150) })
      }
      // Class declarations
      if (/^\s*(export\s+)?class\s+\w+/.test(line)) {
        signatures.push({ line: idx + 1, signature: line.trim().substring(0, 150) })
      }
      // Arrow function assignments (const foo = ...)
      if (/^\s*(export\s+)?(const|let)\s+\w+\s*=\s*(async\s+)?\(/.test(line)) {
        signatures.push({ line: idx + 1, signature: line.trim().substring(0, 150) })
      }
    })

    // Extract modification points context (±5 lines around each modification_points.line)
    const modificationContexts = []
    plan.tasks.forEach(task => {
      if (task.modification_points) {
        task.modification_points.filter(mp => mp.file === filePath && mp.line).forEach(mp => {
          const startLine = Math.max(0, mp.line - 6)
          const endLine = Math.min(totalLines, mp.line + 5)
          modificationContexts.push({
            taskId: task.id,
            taskTitle: task.title,
            line: mp.line,
            description: mp.description || '',
            context: lines.slice(startLine, endLine).map((l, i) => `${startLine + i + 1}: ${l}`).join('\n')
          })
        })
      }
    })

    fileProfiles[filePath] = {
      totalLines,
      imports,
      namedExports,
      defaultExport,
      signatures,
      modificationContexts,
      relatedTasks: fileTaskMap[filePath] || []
    }
  } catch (e) {
    fileProfiles[filePath] = { error: `Failed to read: ${e.message}`, relatedTasks: fileTaskMap[filePath] || [] }
  }
})

// Step 4: Build refined exploration notes with full file profiles
const refinedLog = `# Exploration Notes (Refined): ${task_description.slice(0, 60)}

**Generated**: ${getUtc8ISOString()}
**Task**: ${task_description}
**Plan Tasks**: ${plan.tasks.length}
**Referenced Files**: ${planFiles.size}
**Refined For**: Execution phase — self-contained, no need to re-read source files

---

## Part 1: File Profiles (Execution Reference)

> Each profile contains enough detail for execution agents to write correct imports,
> call correct functions, and integrate at the right locations WITHOUT opening the file.

${Array.from(planFiles).map(filePath => {
  const profile = fileProfiles[filePath]
  if (!profile || profile.error) {
    return `### \`${filePath}\`\n\n⚠️ ${profile?.error || 'File not found'}\n**Related Tasks**: ${(profile?.relatedTasks || []).join(', ')}`
  }

  return `### \`${filePath}\`

**Lines**: ${profile.totalLines} | **Related Tasks**: ${profile.relatedTasks.join(', ')}

**Imports**:
\`\`\`
${profile.imports.map(i => i.statement).join('\n') || '(none)'}
\`\`\`

**Exports** (named):
${profile.namedExports.length > 0
  ? profile.namedExports.map(e => `- L${e.line}: \`${e.declaration}\``).join('\n')
  : '(none)'}
${profile.defaultExport.length > 0
  ? `\n**Default Export**: L${profile.defaultExport[0].line}: \`${profile.defaultExport[0].declaration}\``
  : ''}

**Key Signatures**:
${profile.signatures.slice(0, 15).map(s => `- L${s.line}: \`${s.signature}\``).join('\n') || '(none)'}

${profile.modificationContexts.length > 0 ? `**Modification Points** (with surrounding code):
${profile.modificationContexts.map(mc => `
#### → Task ${mc.taskId}: ${mc.taskTitle}
**Target Line ${mc.line}**: ${mc.description}
\`\`\`
${mc.context}
\`\`\`
`).join('\n')}` : ''}
`
}).join('\n---\n')}

---

## Part 2: Task-Specific Execution Context

${plan.tasks.map(task => {
  const taskFiles = []
  if (task.modification_points) taskFiles.push(...task.modification_points.map(mp => mp.file))
  if (task.reference?.files) taskFiles.push(...task.reference.files)
  const uniqueFiles = [...new Set(taskFiles)]

  return `### Task ${task.id}: ${task.title}

**Scope**: \`${task.scope}\`
**Complexity**: ${task.complexity || 'N/A'}
**Depends On**: ${task.depends_on?.join(', ') || 'None (parallel-safe)'}

**Files to Modify**:
${uniqueFiles.map(f => {
  const profile = fileProfiles[f]
  if (!profile || profile.error) return `- \`${f}\` — ⚠️ ${profile?.error || 'not profiled'}`
  return `- \`${f}\` (${profile.totalLines} lines, ${profile.namedExports.length} exports)`
}).join('\n')}

**Relevant Exploration Findings**:
${extractRelevantExploration(explorationLog, task)}

**Reference Patterns**:
${task.reference?.pattern || 'Follow existing patterns in referenced files'}

**Risk Notes**:
${extractRelevantRisks(explorationLog, task)}
`
}).join('\n---\n')}

---

## Part 3: Cross-Cutting Concerns

### Key Constraints (from exploration)
${extractConstraints(explorationLog)}

### Integration Points (plan-task related)
${extractIntegrationPoints(explorationLog, planFiles)}

### Dependencies (external packages & internal modules)
${extractDependencies(explorationLog, planFiles)}

### Shared Patterns Across Tasks
${explorations.map(exp => {
  if (exp.data.patterns) {
    return `- **${exp.angle}**: ${typeof exp.data.patterns === 'string' ? exp.data.patterns.substring(0, 200) : JSON.stringify(exp.data.patterns).substring(0, 200)}`
  }
  return null
}).filter(Boolean).join('\n') || '(none extracted)'}

---

## Appendix: Quick Lookup

### File → Task Mapping

| File | Tasks | Exports Count | Lines |
|------|-------|---------------|-------|
${Array.from(planFiles).map(f => {
  const p = fileProfiles[f]
  if (!p || p.error) return `| \`${f}\` | ${(p?.relatedTasks || []).join(', ')} | — | — |`
  return `| \`${f}\` | ${p.relatedTasks.join(', ')} | ${p.namedExports.length} | ${p.totalLines} |`
}).join('\n')}

### Original Exploration Notes

Full exploration notes: \`${sessionFolder}/exploration-notes.md\`
`

// Step 5: Write refined exploration notes
Write(`${sessionFolder}/exploration-notes-refined.md`, refinedLog)

// Step 6: Update session artifacts
console.log(`
## Exploration Notes Refined

Original: ${sessionFolder}/exploration-notes.md (full version, for Plan reference)
Refined:  ${sessionFolder}/exploration-notes-refined.md (self-contained, for Execute consumption)

File profiles: ${Object.keys(fileProfiles).length} files with structural details
Modification contexts: ${Object.values(fileProfiles).reduce((sum, p) => sum + (p.modificationContexts?.length || 0), 0)} code snippets
`)
```

**Output (new)**: `${sessionFolder}/exploration-notes-refined.md`

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
// Parse --yes flag
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')

let userSelection

if (autoYes) {
  // Auto mode: Use defaults
  console.log(`[--yes] Auto-confirming plan:`)
  console.log(`  - Confirmation: Allow`)
  console.log(`  - Execution: Auto`)
  console.log(`  - Review: Skip`)

  userSelection = {
    confirmation: "Allow",
    executionMethod: "Auto",
    codeReviewTool: "Skip"
  }
} else {
  // Interactive mode: Ask user
  const rawSelection = ASK_USER([
    {
      id: "confirm",
      type: "select",
      prompt: `Confirm plan? (${plan.tasks.length} tasks, ${plan.complexity})`,
      options: [
        { label: "Allow", description: "Proceed as-is" },
        { label: "Modify", description: "Adjust before execution" },
        { label: "Cancel", description: "Abort workflow" }
      ],
      default: "Allow"
    },
    {
      id: "execution",
      type: "select",
      prompt: "Execution method:",
      options: [
        { label: "Agent", description: "@code-developer agent" },
        { label: "Codex", description: "codex CLI tool" },
        { label: "Auto", description: `Auto: ${plan.complexity === 'Low' ? 'Agent' : 'Codex'}` }
      ],
      default: "Auto"
    },
    {
      id: "review",
      type: "select",
      prompt: "Code review after execution?",
      options: [
        { label: "Gemini Review", description: "Gemini CLI review" },
        { label: "Codex Review", description: "Git-aware review (prompt OR --uncommitted)" },
        { label: "Agent Review", description: "@code-reviewer agent" },
        { label: "Skip", description: "No review" }
      ],
      default: "Skip"
    }
  ])  // BLOCKS (wait for user response)

  userSelection = {
    confirmation: rawSelection.confirm,
    executionMethod: rawSelection.execution,
    codeReviewTool: rawSelection.review
  }
}
```

---

### Phase 5: Execute to Execution

**CRITICAL**: lite-plan NEVER executes code directly. ALL execution MUST go through lite-execute.

**Step 5.1: Build executionContext**

```javascript
// Load manifest and all exploration files
const manifest = JSON.parse(Read(`${sessionFolder}/explorations-manifest.json`))
const explorations = {}

manifest.explorations.forEach(exp => {
  if (file_exists(exp.path)) {
    explorations[exp.angle] = JSON.parse(Read(exp.path))
  }
})

const plan = JSON.parse(Read(`${sessionFolder}/plan.json`))

executionContext = {
  planObject: plan,
  explorationsContext: explorations,
  explorationAngles: manifest.explorations.map(e => e.angle),
  explorationManifest: manifest,
  clarificationContext: clarificationContext || null,
  userSelection: userSelection,
  executionMethod: userSelection.executionMethod,  // Global default; may be overridden by executorAssignments
  codeReviewTool: userSelection.codeReviewTool,
  originalUserInput: task_description,

  // Task-level executor assignments (priority over global executionMethod)
  executorAssignments: executorAssignments,  // { taskId: { executor, reason } }

  session: {
    id: sessionId,
    folder: sessionFolder,
    artifacts: {
      explorations: manifest.explorations.map(exp => ({
        angle: exp.angle,
        path: exp.path
      })),
      explorations_manifest: `${sessionFolder}/explorations-manifest.json`,
      exploration_log: `${sessionFolder}/exploration-notes.md`,           // Full version (Plan consumption)
      exploration_log_refined: `${sessionFolder}/exploration-notes-refined.md`,  // Refined version (Execute consumption)
      plan: `${sessionFolder}/plan.json`
    }
  }
}
```

**Step 5.2: Execute**

```javascript
// → Hand off to Phase 4: Lite Execute (phases/04-lite-execute.md) --in-memory
```

## Session Folder Structure

```
.workflow/.lite-plan/{task-slug}-{YYYY-MM-DD}/
├── exploration-{angle1}.json           # Exploration angle 1
├── exploration-{angle2}.json           # Exploration angle 2
├── exploration-{angle3}.json           # Exploration angle 3 (if applicable)
├── exploration-{angle4}.json           # Exploration angle 4 (if applicable)
├── explorations-manifest.json          # Exploration index
├── exploration-notes.md                # Full exploration notes (Plan phase consumption)
├── exploration-notes-refined.md        # Refined exploration notes (Execute phase consumption)
└── plan.json                           # Implementation plan
```

**Example**:
```
.workflow/.lite-plan/implement-jwt-refresh-2025-11-25-14-30-25/
├── exploration-architecture.json
├── exploration-auth-patterns.json
├── exploration-security.json
├── explorations-manifest.json
└── plan.json
```

## Error Handling

| Error | Resolution |
|-------|------------|
| Exploration agent failure | Skip exploration, continue with task description only |
| Planning agent failure | Fallback to direct planning by Claude |
| Clarification timeout | Use exploration findings as-is |
| Confirmation timeout | Save context, display resume instructions |
| Modify loop > 3 times | Suggest breaking task or using full planning workflow (workflow-plan-execute/SKILL.md) |

---

## Post-Phase Update

After Phase 1 (Lite Plan) completes:
- **Output Created**: `executionContext` with plan.json, explorations, clarifications, user selections
- **Session Artifacts**: All files in `.workflow/.lite-plan/{session-id}/`
- **Next Action**: Auto-continue to [Phase 4: Lite Execute](04-lite-execute.md) with --in-memory
- **TodoWrite**: Mark "Lite Plan - Planning" as completed, start "Execution (Phase 4)"
