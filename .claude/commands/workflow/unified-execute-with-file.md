---
name: unified-execute-with-file
description: Universal execution engine for consuming any planning/brainstorm/analysis output with minimal progress tracking, multi-agent coordination, and incremental execution
argument-hint: "[-y|--yes] [-p|--plan <path>] [-m|--mode sequential|parallel] [\"execution context or task name\"]"
allowed-tools: TodoWrite(*), Task(*), AskUserQuestion(*), Read(*), Grep(*), Glob(*), Bash(*), Edit(*), Write(*)
---

## Auto Mode

When `--yes` or `-y`: Auto-confirm execution decisions, use default parallel strategy where possible.

# Workflow Unified-Execute-With-File Command (/workflow:unified-execute-with-file)

## Overview

Universal execution engine that consumes **any** planning/brainstorm/analysis output and executes it with minimal progress tracking. Coordinates multiple agents (subagents or CLI tools), handles dependencies, and maintains execution timeline in a single minimal document.

**Core workflow**: Load Plan → Parse Tasks → Coordinate Agents → Execute → Track Progress → Verify

**Key features**:
- **Plan Format Agnostic**: Consumes IMPL_PLAN.md, brainstorm.md, analysis conclusions, debug resolutions
- **execution.md**: Single source of truth for progress, execution timeline, and results
- **Multi-Agent Orchestration**: Parallel execution where possible, sequential where needed
- **Incremental Execution**: Resume from failure point, no re-execution of completed tasks
- **Dependency Management**: Automatic topological sort and wait strategy
- **Real-Time Progress**: TodoWrite integration for live task status

## Usage

```bash
/workflow:unified-execute-with-file [FLAGS] [EXECUTION_CONTEXT]

# Flags
-y, --yes              Auto-confirm execution decisions, use defaults
-p, --plan <path>      Explicitly specify plan file (auto-detected if omitted)
-m, --mode <mode>      Execution strategy: sequential (strict order) | parallel (smart dependencies)

# Arguments
[execution-context]    Optional: Task category, module name, or execution focus (for filtering/priority)

# Examples
/workflow:unified-execute-with-file                                    # Auto-detect and execute latest plan
/workflow:unified-execute-with-file -p .workflow/plans/auth-plan.md   # Execute specific plan
/workflow:unified-execute-with-file -y "auth module"                  # Auto-execute with context focus
/workflow:unified-execute-with-file -m sequential "payment feature"   # Sequential execution
```

## Execution Process

```
Plan Detection:
   ├─ Check for IMPL_PLAN.md or task JSON files in .workflow/
   ├─ Or use explicit --plan path
   ├─ Or auto-detect from git branch/issue context
   └─ Load plan metadata and task definitions

Session Initialization:
   ├─ Create .workflow/.execution/{sessionId}/
   ├─ Initialize execution.md with plan summary
   ├─ Parse all tasks, identify dependencies
   ├─ Determine execution strategy (parallel/sequential)
   └─ Initialize progress tracking

Pre-Execution Validation:
   ├─ Check task feasibility (required files exist, tools available)
   ├─ Validate dependency graph (detect cycles)
   ├─ Ask user to confirm execution (unless --yes)
   └─ Display execution plan and timeline estimate

Task Execution Loop (Parallel/Sequential):
   ├─ Select next executable tasks (dependencies satisfied)
   ├─ Launch agents in parallel (if strategy=parallel)
   ├─ Monitor execution, wait for completion
   ├─ Capture outputs, log results
   ├─ Update execution.md with progress
   ├─ Mark tasks complete/failed
   └─ Repeat until all done or max failures reached

Error Handling:
   ├─ Task failure → Ask user: retry|skip|abort
   ├─ Dependency failure → Auto-skip dependent tasks
   ├─ Output conflict → Ask for resolution
   └─ Timeout → Mark as timeout, continue or escalate

Completion:
   ├─ Mark session complete
   ├─ Summarize execution results in execution.md
   ├─ Generate completion report (statistics, failures, recommendations)
   └─ Offer follow-up: review|debug|enhance

Output:
   ├─ .workflow/.execution/{sessionId}/execution.md (plan and overall status)
   ├─ .workflow/.execution/{sessionId}/execution-events.md (SINGLE SOURCE OF TRUTH - all task executions)
   └─ Generated files in project directories (src/*, tests/*, docs/*, etc.)
```

## Implementation

### Session Setup & Plan Detection

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

// Plan detection strategy
let planPath = $ARGUMENTS.match(/--plan\s+(\S+)/)?.[1]

if (!planPath) {
  // Auto-detect: check recent workflow artifacts
  const candidates = [
    '.workflow/.plan/IMPL_PLAN.md',
    '.workflow/plans/IMPL_PLAN.md',
    '.workflow/IMPL_PLAN.md',
  ]

  // Find most recent plan
  planPath = findMostRecentPlan(candidates)

  if (!planPath) {
    // Check for task JSONs
    const taskJsons = glob('.workflow/**/*.json').filter(f => f.includes('IMPL-') || f.includes('task'))
    if (taskJsons.length > 0) {
      planPath = taskJsons[0] // Primary task
    }
  }
}

if (!planPath) {
  AskUserQuestion({
    questions: [{
      question: "未找到执行规划。请选择方式:",
      header: "Plan Source",
      multiSelect: false,
      options: [
        { label: "浏览文件", description: "从 .workflow 目录选择" },
        { label: "使用最近规划", description: "从git提交消息推断" },
        { label: "手动输入路径", description: "直接指定规划文件路径" }
      ]
    }]
  })
}

// Parse plan and extract tasks
const planContent = Read(planPath)
const plan = parsePlan(planContent, planPath) // Format-agnostic parser

const executionId = `EXEC-${plan.slug}-${getUtc8ISOString().substring(0, 10)}-${randomId(4)}`
const executionFolder = `.workflow/.execution/${executionId}`
const executionPath = `${executionFolder}/execution.md`
const eventLogPath = `${executionFolder}/execution-events.md`

bash(`mkdir -p ${executionFolder}`)
```

---

## Plan Format Parsers

Support multiple plan sources:

```javascript
function parsePlan(content, filePath) {
  const ext = filePath.split('.').pop()

  if (filePath.includes('IMPL_PLAN')) {
    return parseImplPlan(content) // From /workflow:plan
  } else if (filePath.includes('brainstorm')) {
    return parseBrainstormPlan(content) // From /workflow:brainstorm-with-file
  } else if (filePath.includes('synthesis')) {
    return parseSynthesisPlan(content) // From /workflow:brainstorm-with-file synthesis.json
  } else if (filePath.includes('conclusions')) {
    return parseConclusionsPlan(content) // From /workflow:analyze-with-file conclusions.json
  } else if (filePath.endsWith('.json') && content.includes('tasks')) {
    return parseTaskJson(content) // Direct task JSON
  }

  throw new Error(`Unsupported plan format: ${filePath}`)
}

// IMPL_PLAN.md parser
function parseImplPlan(content) {
  // Extract:
  // - Overview/summary
  // - Phase sections
  // - Task list with dependencies
  // - Critical files
  // - Execution order

  return {
    type: 'impl-plan',
    title: extractSection(content, 'Overview'),
    phases: extractPhases(content),
    tasks: extractTasks(content),
    criticalFiles: extractCriticalFiles(content),
    estimatedDuration: extractEstimate(content)
  }
}

// Brainstorm synthesis.json parser
function parseSynthesisPlan(content) {
  const synthesis = JSON.parse(content)

  return {
    type: 'brainstorm-synthesis',
    title: synthesis.topic,
    ideas: synthesis.top_ideas,
    tasks: synthesis.top_ideas.map(idea => ({
      id: `IDEA-${slugify(idea.title)}`,
      type: 'investigation',
      title: idea.title,
      description: idea.description,
      dependencies: [],
      agent_type: 'cli-execution-agent',
      prompt: `Implement: ${idea.title}\n${idea.description}`,
      expected_output: idea.next_steps
    })),
    recommendations: synthesis.recommendations
  }
}
```

---

### Phase 1: Plan Loading & Validation

**Step 1.1: Parse Plan and Extract Tasks**

```javascript
const tasks = plan.tasks || parseTasksFromContent(plan)

// Normalize task structure
const normalizedTasks = tasks.map(task => ({
  id: task.id || `TASK-${generateId()}`,
  title: task.title || task.content,
  description: task.description || task.activeForm,
  type: task.type || inferTaskType(task), // 'code', 'test', 'doc', 'analysis', 'integration'
  agent_type: task.agent_type || selectBestAgent(task),
  dependencies: task.dependencies || [],

  // Execution parameters
  prompt: task.prompt || task.description,
  files_to_modify: task.files_to_modify || [],
  expected_output: task.expected_output || [],

  // Metadata
  priority: task.priority || 'normal',
  parallel_safe: task.parallel_safe !== false,
  estimated_duration: task.estimated_duration || null,

  // Status tracking
  status: 'pending',
  attempts: 0,
  max_retries: 2
}))

// Validate and detect issues
const validation = {
  cycles: detectDependencyCycles(normalizedTasks),
  missing_dependencies: findMissingDependencies(normalizedTasks),
  file_conflicts: detectOutputConflicts(normalizedTasks),
  warnings: []
}

if (validation.cycles.length > 0) {
  throw new Error(`Circular dependencies detected: ${validation.cycles.join(', ')}`)
}
```

**Step 1.2: Create execution.md**

```markdown
# Execution Progress

**Execution ID**: ${executionId}
**Plan Source**: ${planPath}
**Started**: ${getUtc8ISOString()}
**Mode**: ${executionMode}

**Plan Summary**:
- Title: ${plan.title}
- Total Tasks: ${tasks.length}
- Phases: ${plan.phases?.length || 'N/A'}

---

## Execution Plan

### Task Overview

| Task ID | Title | Type | Agent | Dependencies | Status |
|---------|-------|------|-------|--------------|--------|
${normalizedTasks.map(t => `| ${t.id} | ${t.title} | ${t.type} | ${t.agent_type} | ${t.dependencies.join(',')} | ${t.status} |`).join('\n')}

### Dependency Graph

\`\`\`
${generateDependencyGraph(normalizedTasks)}
\`\`\`

### Execution Strategy

- **Mode**: ${executionMode}
- **Parallelization**: ${calculateParallel(normalizedTasks)}
- **Estimated Duration**: ${estimateTotalDuration(normalizedTasks)}

---

## Execution Timeline

*Updates as execution progresses*

---

## Current Status

${executionStatus()}
```

**Step 1.3: Pre-Execution Confirmation**

```javascript
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')

if (!autoYes) {
  AskUserQuestion({
    questions: [{
      question: `准备执行 ${normalizedTasks.length} 个任务，模式: ${executionMode}\n\n关键任务:\n${normalizedTasks.slice(0, 3).map(t => `• ${t.id}: ${t.title}`).join('\n')}\n\n继续?`,
      header: "Confirmation",
      multiSelect: false,
      options: [
        { label: "开始执行", description: "按计划执行" },
        { label: "调整参数", description: "修改执行参数" },
        { label: "查看详情", description: "查看完整任务列表" },
        { label: "取消", description: "退出不执行" }
      ]
    }]
  })
}
```

---

## Phase 2: Execution Orchestration

**Step 2.1: Determine Execution Order**

```javascript
// Topological sort
const executionOrder = topologicalSort(normalizedTasks)

// For parallel mode, group tasks into waves
let executionWaves = []
if (executionMode === 'parallel') {
  executionWaves = groupIntoWaves(executionOrder, parallelLimit = 3)
} else {
  executionWaves = executionOrder.map(task => [task])
}

// Log execution plan to execution.md
// execution-events.md will track actual progress as tasks execute
```

**Step 2.2: Execute Task Waves**

```javascript
let completedCount = 0
let failedCount = 0
const results = {}

for (let waveIndex = 0; waveIndex < executionWaves.length; waveIndex++) {
  const wave = executionWaves[waveIndex]

  console.log(`\n=== Wave ${waveIndex + 1}/${executionWaves.length} ===`)
  console.log(`Tasks: ${wave.map(t => t.id).join(', ')}`)

  // Launch tasks in parallel
  const taskPromises = wave.map(task => executeTask(task, executionFolder))

  // Wait for wave completion
  const waveResults = await Promise.allSettled(taskPromises)

  // Process results
  for (let i = 0; i < waveResults.length; i++) {
    const result = waveResults[i]
    const task = wave[i]

    if (result.status === 'fulfilled') {
      results[task.id] = result.value
      if (result.value.success) {
        completedCount++
        task.status = 'completed'
        console.log(`✅ ${task.id}: Completed`)
      } else {
        handleTaskFailure(task, result.value.error, autoYes)
      }
    } else {
      handleTaskFailure(task, result.reason, autoYes)
    }

    // Progress is tracked in execution-events.md (appended by executeTask)
  }

  // Update execution.md summary
  appendExecutionTimeline(executionPath, waveIndex + 1, wave, waveResults)
}
```

**Step 2.3: Execute Individual Task with Unified Event Logging**

```javascript
async function executeTask(task, executionFolder) {
  const eventLogPath = `${executionFolder}/execution-events.md`
  const startTime = Date.now()

  try {
    // Read previous execution events for context
    let previousEvents = ''
    if (fs.existsSync(eventLogPath)) {
      previousEvents = Read(eventLogPath)
    }

    // Select agent based on task type
    const agent = selectAgent(task.agent_type)

    // Build execution context including previous agent outputs
    const executionContext = `
## Previous Agent Executions (for reference)

${previousEvents}

---

## Current Task: ${task.id}

**Title**: ${task.title}
**Agent**: ${agent}
**Time**: ${getUtc8ISOString()}

### Description
${task.description}

### Context
- Modified Files: ${task.files_to_modify.join(', ')}
- Expected Output: ${task.expected_output.join(', ')}
- Previous Artifacts: [list any artifacts from previous tasks]

### Requirements
${task.requirements || 'Follow the plan'}

### Constraints
${task.constraints || 'No breaking changes'}
`

    // Execute based on agent type
    let result

    if (agent === 'code-developer' || agent === 'tdd-developer') {
      // Code implementation
      result = await Task({
        subagent_type: agent,
        description: `Execute: ${task.title}`,
        prompt: executionContext,
        run_in_background: false
      })
    } else if (agent === 'cli-execution-agent' || agent === 'universal-executor') {
      // CLI-based execution
      result = await Bash({
        command: `ccw cli -p "${escapeQuotes(executionContext)}" --tool gemini --mode analysis`,
        run_in_background: false
      })
    } else if (agent === 'test-fix-agent') {
      // Test execution and fixing
      result = await Task({
        subagent_type: 'test-fix-agent',
        description: `Execute Tests: ${task.title}`,
        prompt: executionContext,
        run_in_background: false
      })
    } else {
      // Generic task execution
      result = await Task({
        subagent_type: 'universal-executor',
        description: task.title,
        prompt: executionContext,
        run_in_background: false
      })
    }

    // Capture artifacts (code, tests, docs generated by this task)
    const artifacts = captureArtifacts(task, executionFolder)

    // Append to unified execution events log
    const eventEntry = `
## Task ${task.id} - COMPLETED ✅

**Timestamp**: ${getUtc8ISOString()}
**Duration**: ${calculateDuration(startTime)}ms
**Agent**: ${agent}

### Execution Summary

${generateSummary(result)}

### Key Outputs

${formatOutputs(result)}

### Generated Artifacts

${artifacts.map(a => `- **${a.type}**: \`${a.path}\` (${a.size})`).join('\n')}

### Notes for Next Agent

${generateNotesForNextAgent(result, task)}

---
`

    appendToEventLog(eventLogPath, eventEntry)

    return {
      success: true,
      task_id: task.id,
      output: result,
      artifacts: artifacts,
      duration: calculateDuration(startTime)
    }
  } catch (error) {
    // Append failure event to unified log
    const failureEntry = `
## Task ${task.id} - FAILED ❌

**Timestamp**: ${getUtc8ISOString()}
**Duration**: ${calculateDuration(startTime)}ms
**Agent**: ${agent}
**Error**: ${error.message}

### Error Details

\`\`\`
${error.stack}
\`\`\`

### Recovery Notes for Next Attempt

${generateRecoveryNotes(error, task)}

---
`

    appendToEventLog(eventLogPath, failureEntry)

    return {
      success: false,
      task_id: task.id,
      error: error.message,
      duration: calculateDuration(startTime)
    }
  }
}

// Helper function to append to unified event log
function appendToEventLog(logPath, eventEntry) {
  if (fs.existsSync(logPath)) {
    const currentContent = Read(logPath)
    Write(logPath, currentContent + eventEntry)
  } else {
    Write(logPath, eventEntry)
  }
}

// Helper to generate context for next agent
function generateNotesForNextAgent(result, task) {
  return `
- This task completed successfully and generated code/artifacts
- Downstream tasks can reference: ${task.id}
- Key decisions made: [summarize important choices]
- Potential issues for next agent: [list any gotchas]
`
}

async function handleTaskFailure(task, error, autoYes) {
  task.attempts++

  if (task.attempts < task.max_retries && autoYes) {
    console.log(`⚠️ ${task.id}: Failed, retrying (${task.attempts}/${task.max_retries})`)
    // Retry
  } else if (task.attempts >= task.max_retries) {
    if (!autoYes) {
      const decision = AskUserQuestion({
        questions: [{
          question: `任务失败: ${task.id}\n错误: ${error}`,
          header: "Decision",
          multiSelect: false,
          options: [
            { label: "重试", description: "重新执行该任务" },
            { label: "跳过", description: "跳过此任务，继续下一个" },
            { label: "终止", description: "停止整个执行" }
          ]
        }]
      })

      if (decision === 'retry') {
        task.attempts = 0 // Reset counter
      } else if (decision === 'skip') {
        task.status = 'skipped'
        // Skip dependent tasks
        skipDependentTasks(task.id, normalizedTasks)
      } else {
        throw new Error('Execution aborted by user')
      }
    } else {
      task.status = 'failed'
      skipDependentTasks(task.id, normalizedTasks)
    }
  }
}
```

---

## Phase 3: Progress Tracking & Event Logging

### Unified Event Log Format

The `execution-events.md` file serves as the **single source of truth** for all agent executions. Each agent:
1. **Reads** previous execution events for context
2. **Executes** its task
3. **Writes** its execution event (success or failure)
4. Subsequent agents **read** all previous events

This creates a "knowledge chain" where agents can learn from and build upon previous agent work.

**Step 3.1: Unified Event Log Structure**

```markdown
# Execution Events Log

**Session ID**: EXEC-xxx-2025-01-27-abcd
**Started**: 2025-01-27T10:00:00+08:00

---

## Task TASK-001 - COMPLETED ✅

**Timestamp**: 2025-01-27T10:05:00+08:00
**Duration**: 300000ms (5 minutes)
**Agent**: code-developer

### Execution Summary

Implemented authentication types module as per specification. Created:
- `src/types/auth.ts` with JWT payload types
- Type definitions for user sessions

### Key Outputs

- ✅ TypeScript type definitions
- ✅ JSDoc comments for all exports
- ✅ Export statements verified

### Generated Artifacts

- **Source Code**: `artifacts/src/types/auth.ts` (2.3KB)
- **Type Definitions**: `artifacts/src/types/index.ts` (0.8KB)

### Notes for Next Agent

- **Reference**: Use types from `src/types/auth.ts` in JWT handler implementation
- **Key Decisions**: Used discriminated unions for different token types
- **Potential Issues**: None identified
- **Artifacts Available**: Type definitions in artifacts/src/types/

---

## Task TASK-002 - COMPLETED ✅

**Timestamp**: 2025-01-27T10:15:00+08:00
**Duration**: 450000ms (7.5 minutes)
**Agent**: code-developer

### Execution Summary

Implemented JWT token handler using types from TASK-001.
- Successfully imported and used types from previous task
- Implemented sign/verify/refresh token methods
- Added comprehensive error handling

### Key Outputs

- ✅ JWT handler implementation
- ✅ Integration with auth types from TASK-001
- ✅ Token validation logic
- ✅ Refresh token mechanism

### Generated Artifacts

- **Source Code**: `artifacts/src/handlers/jwt.ts` (4.2KB)
- **Tests**: `artifacts/tests/handlers/jwt.test.ts` (3.1KB)

### Notes for Next Agent

- **Depends On**: TASK-001 (auth types) - successfully integrated ✅
- **Key Decisions**: Used HS256 algorithm with configurable secret
- **Potential Issues**: Token expiration handling assumes UTC timestamps
- **Ready For**: Middleware integration (TASK-003)
- **Artifacts Available**: JWT handler in artifacts/src/handlers/

---

## Task TASK-003 - FAILED ❌

**Timestamp**: 2025-01-27T10:25:00+08:00
**Duration**: 180000ms (3 minutes)
**Agent**: code-developer
**Error**: Missing dependency - TASK-002 artifacts not properly integrated

### Error Details

\`\`\`
Error: Cannot find module 'src/handlers/jwt'
  at Module._load (internal/modules/node_modules/module.js:...)
```

Attempted to import JWT handler from TASK-002, but path resolution failed in test environment.

### Recovery Notes for Next Attempt

- **Root Cause**: Artifacts path resolution differs in test vs build environment
- **Solution**: Use relative path `../artifacts/src/handlers/jwt` or adjust import configuration
- **Next Attempt Should**:
  - Verify artifacts are properly copied to correct location
  - Update path resolution to handle both test and build environments
  - Run integration test after fix

---

## Task TASK-004 - IN PROGRESS ⏳

**Timestamp**: 2025-01-27T10:30:00+08:00
**Agent**: code-developer

Building on previous tasks:
- Artifact: `artifacts/src/types/auth.ts` (from TASK-001)
- Artifact: `artifacts/src/handlers/jwt.ts` (from TASK-002)
- Context: TASK-003 failed, will skip dependent tasks...

---
```

**Step 3.2: Event Log Integration with Execution Plan**

Update `execution.md` to reference the unified event log:

```markdown
### Wave 2 - Execution (2025-01-27 10:05)

**Tasks**: TASK-001, TASK-002, TASK-004 (parallel)

#### Execution Results

For detailed execution records, see: `execution-events.md`

| Task | Status | Duration | Artifacts |
|------|--------|----------|-----------|
| TASK-001 | ✅ Complete | 5m | src/types/auth.ts |
| TASK-002 | ✅ Complete | 7.5m | src/handlers/jwt.ts |
| TASK-004 | ⏳ In Progress | - | - |

#### Next Steps

- TASK-003 failed due to path resolution
- Dependent tasks automatically skipped
- Review execution-events.md for recovery notes

---
```

**Step 3.3: Agent-Readable Execution Context**

When executing each task, agents receive full context:

```javascript
// Each agent receives this as context:
const agentExecutionContext = {
  // Summary of all previous task executions
  previousExecutions: readPreviousEvents(eventLogPath),

  // Direct references to previous artifacts
  previousArtifacts: {
    'TASK-001': 'artifacts/src/types/auth.ts',
    'TASK-002': 'artifacts/src/handlers/jwt.ts'
  },

  // Notes from previous agents about current task
  contextFromPreviousAgent: loadContextNotes(currentTask),

  // Failed tasks to avoid/handle
  failedTasks: ['TASK-003'],
  failureReason: 'Path resolution issue - use relative paths',

  // Recommended practices based on what worked
  successPatterns: [
    'TASK-001: Direct imports from types work well',
    'TASK-002: Relative path imports to artifacts successful'
  ]
}
```

**Step 3.4: Todo List Integration**

```javascript
// Use TodoWrite to track task execution with previous events visible
const todos = normalizedTasks.map(task => {
  const previousEvent = readEventForTask(eventLogPath, task.id)

  return {
    content: task.title,
    status: task.status,
    activeForm: `Executing: ${task.title}`,
    // Include previous attempt notes if exists
    notes: previousEvent ? `Previous: ${previousEvent.status}` : null
  }
})

TodoWrite({ todos })
```

---

## Phase 4: Completion & Summary

**Step 4.1: Generate Completion Report**

```javascript
const completionReport = {
  execution_id: executionId,
  plan_source: planPath,
  start_time: progressJson.start_time,
  end_time: getUtc8ISOString(),

  statistics: {
    total_tasks: normalizedTasks.length,
    completed: completedCount,
    failed: failedCount,
    skipped: normalizedTasks.filter(t => t.status === 'skipped').length,
    success_rate: (completedCount / normalizedTasks.length * 100).toFixed(1)
  },

  results: results,

  artifacts: {
    generated_files: getAllGeneratedFiles(executionFolder),
    modified_files: getAllModifiedFiles(executionFolder)
  }
}
```

**Step 4.2: Final execution.md Update**

```markdown
---

## Execution Completed

**Status**: ${completionReport.statistics.success_rate === '100' ? 'SUCCESS ✅' : 'PARTIAL ⚠️'}

**Statistics**:
- Total Tasks: ${completionReport.statistics.total_tasks}
- Completed: ${completionReport.statistics.completed}
- Failed: ${completionReport.statistics.failed}
- Skipped: ${completionReport.statistics.skipped}
- Success Rate: ${completionReport.statistics.success_rate}%

**Duration**: ${calculateDuration(progressJson.start_time, getUtc8ISOString())}

### Summary

${generateExecutionSummary(completionReport)}

### Generated Artifacts

${completionReport.artifacts.generated_files.map(f => `- ${f}`).join('\n')}

### Modified Files

${completionReport.artifacts.modified_files.map(f => `- ${f}`).join('\n')}

### Recommendations

${generateRecommendations(completionReport)}
```

**Step 4.3: Post-Completion Options**

```javascript
if (!autoYes) {
  AskUserQuestion({
    questions: [{
      question: "执行完成。是否需要后续操作?",
      header: "Next Steps",
      multiSelect: true,
      options: [
        { label: "查看详情", description: "查看完整执行日志" },
        { label: "调试失败项", description: "对失败任务进行调试" },
        { label: "优化执行", description: "分析执行改进建议" },
        { label: "生成报告", description: "导出执行报告" },
        { label: "完成", description: "不需要后续操作" }
      ]
    }]
  })
}
```

---

## Session Folder Structure

```
.workflow/.execution/{sessionId}/
├── execution.md              # Execution plan and overall status
└── execution-events.md       # 📋 Unified execution log (all agents) - SINGLE SOURCE OF TRUTH
                               # This is both human-readable AND machine-parseable

# Generated files go directly to project directories (not into execution folder)
# E.g. TASK-001 generates: src/types/auth.ts (not artifacts/src/types/auth.ts)
# execution-events.md records the actual project paths
```

**Key Concept**:
- **execution-events.md** is the **single source of truth** for execution state
- Human-readable: Clear markdown format with task summaries
- Machine-parseable: Status indicators (✅/❌/⏳) and structured sections
- Progress tracking: Read task count by parsing status indicators
- No redundancy: One unified log for all purposes

## Execution Document Template

```markdown
# Execution Progress

**Execution ID**: EXEC-xxx-2025-01-27-abcd
**Plan Source**: .workflow/plans/IMPL_PLAN.md
**Started**: 2025-01-27T10:00:00+08:00
**Mode**: parallel

**Plan Summary**:
- Title: Authentication System Refactoring
- Total Tasks: 12
- Phases: 3

---

## Execution Plan

### Task Overview

| Task ID | Title | Type | Status |
|---------|-------|------|--------|
| TASK-001 | Setup auth types | code | pending |
| TASK-002 | Implement JWT handler | code | pending |

### Dependency Graph

```
TASK-001 → TASK-002 → TASK-003
       ↘                    ↗
         TASK-004 --------→ TASK-005
```

---

## Execution Timeline

### Wave 1 - Setup (2025-01-27 10:00)

- ✅ **TASK-001**: Completed
- ⏳ **TASK-002**: In Progress

---

## Current Status

- **Progress**: 1/12 (8%)
- **In Progress**: 1 task
- **Pending**: 10 tasks
- **Failed**: 0 tasks
```

## Agent Selection Strategy

```javascript
function selectBestAgent(task) {
  if (task.type === 'code' || task.type === 'implementation') {
    return task.includes_tests ? 'tdd-developer' : 'code-developer'
  } else if (task.type === 'test' || task.type === 'test-fix') {
    return 'test-fix-agent'
  } else if (task.type === 'doc' || task.type === 'documentation') {
    return 'doc-generator'
  } else if (task.type === 'analysis' || task.type === 'investigation') {
    return 'cli-execution-agent'
  } else if (task.type === 'debug') {
    return 'debug-explore-agent'
  } else {
    return 'universal-executor'
  }
}
```

## Parallelization Rules

```javascript
function calculateParallel(tasks) {
  // Group tasks into execution waves
  // Constraints:
  // - Tasks with same file modifications must be sequential
  // - Tasks with dependencies must wait
  // - Max 3 parallel tasks per wave (resource constraint)

  const waves = []
  const completed = new Set()

  while (completed.size < tasks.length) {
    const available = tasks.filter(t =>
      !completed.has(t.id) &&
      t.dependencies.every(d => completed.has(d))
    )

    if (available.length === 0) break

    // Check for file conflicts
    const noConflict = []
    const modifiedFiles = new Set()

    for (const task of available) {
      const conflicts = task.files_to_modify.some(f => modifiedFiles.has(f))
      if (!conflicts && noConflict.length < 3) {
        noConflict.push(task)
        task.files_to_modify.forEach(f => modifiedFiles.add(f))
      } else if (!conflicts && noConflict.length < 3) {
        waves.push([task])
        completed.add(task.id)
      }
    }

    if (noConflict.length > 0) {
      waves.push(noConflict)
      noConflict.forEach(t => completed.add(t.id))
    }
  }

  return waves
}
```

## Error Handling & Recovery

| Situation | Action |
|-----------|--------|
| Task timeout | Mark as timeout, ask user: retry/skip/abort |
| Missing dependency | Auto-skip dependent tasks, log warning |
| File conflict | Detect before execution, ask for resolution |
| Output mismatch | Validate against expected_output, flag for review |
| Agent unavailable | Fallback to universal-executor |
| Execution interrupted | Support resume with `/workflow:unified-execute-with-file --continue` |

## Usage Recommendations

Use `/workflow:unified-execute-with-file` when:
- Executing any planning document (IMPL_PLAN.md, brainstorm conclusions, analysis recommendations)
- Multiple tasks with dependencies need orchestration
- Want minimal progress tracking without clutter
- Need to handle failures gracefully and resume
- Want to parallelize where possible but ensure correctness

Use for consuming output from:
- `/workflow:plan` → IMPL_PLAN.md
- `/workflow:brainstorm-with-file` → synthesis.json → execution
- `/workflow:analyze-with-file` → conclusions.json → execution
- `/workflow:debug-with-file` → recommendations → execution
- `/workflow:lite-plan` → task JSONs → execution

## Session Resume

```bash
/workflow:unified-execute-with-file --continue     # Resume last execution
/workflow:unified-execute-with-file --continue EXEC-xxx-2025-01-27-abcd  # Resume specific
```

When resuming:
1. Load execution.md and execution-events.md
2. Parse execution-events.md to identify completed/failed/skipped tasks
3. Recalculate remaining dependencies
4. Resume from first incomplete task
5. Append to execution-events.md with "Resumed from [sessionId]" note
