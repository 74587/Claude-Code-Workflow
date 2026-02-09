---
name: execute
description: Team executor - 实现已批准的计划、编写代码、报告进度
argument-hint: ""
allowed-tools: SendMessage(*), TaskUpdate(*), TaskList(*), TaskGet(*), TodoWrite(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*), Task(*)
group: team
---

# Team Execute Command (/team:execute)

## Overview

Team executor role command. Operates as a teammate within an Agent Team, responsible for implementing approved plans by writing code, self-validating, and reporting progress to the coordinator.

**Core capabilities:**
- Task discovery from shared team task list (IMPL-* tasks)
- Plan loading and task decomposition
- Code implementation following plan modification points
- Self-validation: syntax checks, acceptance criteria verification
- Progress reporting to coordinator
- Sub-agent delegation for complex tasks

## Role Definition

**Name**: `executor`
**Responsibility**: Load plan → Implement code → Self-validate → Report completion
**Communication**: SendMessage to coordinator only

## 消息总线

每次 SendMessage **前**，必须调用 `mcp__ccw-tools__team_msg` 记录消息：

```javascript
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "executor", to: "coordinator", type: "<type>", summary: "<摘要>" })
```

### 支持的 Message Types

| Type | 方向 | 触发时机 | 说明 |
|------|------|----------|------|
| `impl_progress` | executor → coordinator | 完成一个 batch/子任务 | 报告当前进度百分比和完成的子任务 |
| `impl_complete` | executor → coordinator | 全部实现完成 | 附带变更文件列表和 acceptance 状态 |
| `error` | executor → coordinator | 遇到阻塞问题 | Plan 文件缺失、文件冲突、子代理失败等 |

### 调用示例

```javascript
// 进度更新
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "executor", to: "coordinator", type: "impl_progress", summary: "Batch 1/3 完成: auth middleware 已实现", data: { batch: 1, total: 3, files: ["src/middleware/auth.ts"] } })

// 实现完成
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "executor", to: "coordinator", type: "impl_complete", summary: "IMPL-001完成: 5个文件变更, acceptance全部满足", data: { changedFiles: 5, syntaxClean: true } })

// 错误上报
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "executor", to: "coordinator", type: "error", summary: "plan.json路径无效, 无法加载实现计划" })
```

## Execution Process

```
Phase 1: Task & Plan Loading
   ├─ TaskList to find unblocked IMPL-* tasks assigned to me
   ├─ TaskGet to read full task details
   ├─ TaskUpdate to mark in_progress
   └─ Load plan.json from plan path in task description

Phase 2: Task Grouping
   ├─ Extract depends_on from plan tasks
   ├─ Independent tasks → parallel batch
   └─ Dependent tasks → sequential batches

Phase 3: Code Implementation
   ├─ For each task in plan:
   │   ├─ Read modification points
   │   ├─ Read reference patterns
   │   ├─ Implement changes (Edit/Write)
   │   ├─ Complex tasks → code-developer sub-agent
   │   └─ Simple tasks → direct file editing
   └─ SendMessage progress updates for complex tasks

Phase 4: Self-Validation
   ├─ Syntax check (tsc --noEmit for TypeScript)
   ├─ Verify acceptance criteria from plan
   ├─ Run affected unit tests (if identifiable)
   └─ Fix any immediate issues

Phase 5: Completion Report
   ├─ Compile changed files list
   ├─ Summarize acceptance criteria status
   ├─ SendMessage report to coordinator
   ├─ Mark IMPL task completed
   └─ Check TaskList for next IMPL task
```

## Implementation

### Phase 1: Task & Plan Loading

```javascript
// Find my assigned IMPL tasks
const tasks = TaskList()
const myImplTasks = tasks.filter(t =>
  t.subject.startsWith('IMPL-') &&
  t.owner === 'executor' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0  // Not blocked
)

if (myImplTasks.length === 0) {
  // No tasks available, idle
  return
}

// Pick first available task (lowest ID)
const task = TaskGet({ taskId: myImplTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })

// Extract plan path from task description
const planPathMatch = task.description.match(/\.workflow\/\.team-plan\/[^\s]+\/plan\.json/)
const planPath = planPathMatch ? planPathMatch[0] : null

if (!planPath) {
  SendMessage({
    type: "message",
    recipient: "coordinator",
    content: `Cannot find plan.json path in task description for ${task.subject}. Please provide plan location.`,
    summary: "Plan path not found"
  })
  return
}

const plan = JSON.parse(Read(planPath))
```

### Phase 2: Task Grouping

```javascript
// Extract dependencies and group tasks
function extractDependencies(planTasks) {
  const taskIdToIndex = {}
  planTasks.forEach((t, i) => { taskIdToIndex[t.id] = i })

  return planTasks.map((task, i) => {
    const deps = (task.depends_on || [])
      .map(depId => taskIdToIndex[depId])
      .filter(idx => idx !== undefined && idx < i)
    return { ...task, taskIndex: i, dependencies: deps }
  })
}

function createBatches(planTasks) {
  const tasksWithDeps = extractDependencies(planTasks)
  const processed = new Set()
  const batches = []

  // Phase 1: Independent tasks → single parallel batch
  const independent = tasksWithDeps.filter(t => t.dependencies.length === 0)
  if (independent.length > 0) {
    independent.forEach(t => processed.add(t.taskIndex))
    batches.push({ type: 'parallel', tasks: independent })
  }

  // Phase 2+: Dependent tasks in order
  let remaining = tasksWithDeps.filter(t => !processed.has(t.taskIndex))
  while (remaining.length > 0) {
    const ready = remaining.filter(t => t.dependencies.every(d => processed.has(d)))
    if (ready.length === 0) break // circular dependency guard
    ready.forEach(t => processed.add(t.taskIndex))
    batches.push({ type: ready.length > 1 ? 'parallel' : 'sequential', tasks: ready })
    remaining = remaining.filter(t => !processed.has(t.taskIndex))
  }

  return batches
}

const batches = createBatches(plan.tasks)
```

### Phase 3: Code Implementation

```javascript
// Unified Task Prompt Builder (from lite-execute)
function buildExecutionPrompt(planTask) {
  return `
## ${planTask.title}

**Scope**: \`${planTask.scope}\`  |  **Action**: ${planTask.action || 'implement'}

### Modification Points
${(planTask.modification_points || []).map(p => `- **${p.file}** → \`${p.target}\`: ${p.change}`).join('\n')}

### How to do it
${planTask.description}

${(planTask.implementation || []).map(step => `- ${step}`).join('\n')}

### Reference
- Pattern: ${planTask.reference?.pattern || 'N/A'}
- Files: ${planTask.reference?.files?.join(', ') || 'N/A'}

### Done when
${(planTask.acceptance || []).map(c => `- [ ] ${c}`).join('\n')}
`
}

// Execute each batch
const changedFiles = []
const previousResults = []

for (const batch of batches) {
  if (batch.tasks.length === 1 && isSimpleTask(batch.tasks[0])) {
    // Simple task: direct implementation
    const t = batch.tasks[0]
    // Read target files, apply modifications using Edit/Write
    for (const mp of (t.modification_points || [])) {
      const content = Read(mp.file)
      // Apply change based on modification point description
      Edit({ file_path: mp.file, old_string: "...", new_string: "..." })
      changedFiles.push(mp.file)
    }
  } else {
    // Complex task(s): delegate to code-developer sub-agent
    const prompt = batch.tasks.map(buildExecutionPrompt).join('\n\n---\n')

    Task({
      subagent_type: "code-developer",
      run_in_background: false,
      description: batch.tasks.map(t => t.title).join(' | '),
      prompt: `## Goal
${plan.summary}

## Tasks
${prompt}

## Context
### Project Guidelines
@.workflow/project-guidelines.json

Complete each task according to its "Done when" checklist.`
    })

    // Collect changed files from sub-agent results
    batch.tasks.forEach(t => {
      (t.modification_points || []).forEach(mp => changedFiles.push(mp.file))
    })
  }

  previousResults.push({
    batchType: batch.type,
    tasks: batch.tasks.map(t => t.title),
    status: 'completed'
  })
}
```

### Phase 4: Self-Validation

```javascript
// Step 1: Syntax check
const syntaxResult = Bash(`tsc --noEmit 2>&1 || true`)
const hasSyntaxErrors = syntaxResult.includes('error TS')

if (hasSyntaxErrors) {
  // Attempt to fix syntax errors
  // Parse error locations, apply fixes
  console.log('Syntax errors detected, attempting fix...')
}

// Step 2: Verify acceptance criteria
const acceptanceStatus = plan.tasks.map(t => ({
  title: t.title,
  criteria: (t.acceptance || []).map(c => ({
    criterion: c,
    met: true // Evaluate based on implementation
  }))
}))

// Step 3: Run affected tests (if identifiable)
const testFiles = changedFiles
  .map(f => f.replace(/\/src\//, '/tests/').replace(/\.(ts|js)$/, '.test.$1'))
  .filter(f => Bash(`test -f ${f} && echo exists || true`).includes('exists'))

if (testFiles.length > 0) {
  const testResult = Bash(`npx jest ${testFiles.join(' ')} --passWithNoTests 2>&1 || true`)
  // Parse test results
}
```

### Phase 5: Completion Report

```javascript
// Compile report
const report = {
  task: task.subject,
  changedFiles: [...new Set(changedFiles)],
  newFiles: changedFiles.filter(f => /* detect new files */),
  acceptanceStatus: acceptanceStatus,
  syntaxClean: !hasSyntaxErrors,
  testsPassed: testFiles.length > 0 ? testResult.includes('passed') : 'N/A'
}

// Send to coordinator
SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## Implementation Complete

**Task**: ${task.subject}

### Changed Files
${report.changedFiles.map(f => `- ${f}`).join('\n')}

### Acceptance Criteria
${acceptanceStatus.map(t => `**${t.title}**: ${t.criteria.every(c => c.met) ? 'All met' : 'Partial'}`).join('\n')}

### Validation
- Syntax: ${report.syntaxClean ? 'Clean' : 'Has errors (attempted fix)'}
- Tests: ${report.testsPassed}

Implementation is ready for testing and review.`,
  summary: `IMPL complete: ${report.changedFiles.length} files changed`
})

// Mark task completed
TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next IMPL task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('IMPL-') &&
  t.owner === 'executor' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (nextTasks.length > 0) {
  // Continue with next task → back to Phase 1
}
```

## Helper Functions

```javascript
function isSimpleTask(task) {
  return (task.modification_points || []).length <= 2 &&
    !task.code_skeleton &&
    (task.risks || []).length === 0
}
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Plan file not found | Notify coordinator, request plan location |
| Syntax errors after implementation | Attempt auto-fix, report remaining errors |
| Sub-agent failure | Retry once, then attempt direct implementation |
| File conflict / merge issue | Notify coordinator, request guidance |
| Test failures in self-validation | Report in completion message, let tester handle |
| Circular dependencies in plan | Execute in plan order, ignore dependency chain |
