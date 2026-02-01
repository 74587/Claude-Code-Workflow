---
description: Universal execution engine for consuming planning/brainstorm/analysis output. Serial task execution with progress tracking. Codex-optimized.
argument-hint: "PLAN=\"<path>\" [--auto-commit] [--dry-run]"
---

# Codex Unified-Execute-With-File Prompt

## Overview

Universal execution engine consuming **any** planning output and executing tasks serially with progress tracking.

**Core workflow**: Load Plan → Parse Tasks → Execute Sequentially → Track Progress → Verify

## Target Plan

**$PLAN**

**Parameters**:
- `--auto-commit`: Auto-commit after each task (conventional commits)
- `--dry-run`: Simulate execution without making changes

## Execution Process

```
Session Initialization:
   ├─ Detect or load plan file
   ├─ Parse tasks from plan (JSON, Markdown, or other formats)
   ├─ Build task dependency graph
   └─ Validate for cycles and feasibility

Pre-Execution:
   ├─ Analyze plan structure
   ├─ Identify modification targets (files)
   ├─ Check file conflicts and feasibility
   └─ Generate execution strategy

Serial Execution (Task by Task):
   ├─ For each task:
   │  ├─ Extract task context
   │  ├─ Load previous task outputs
   │  ├─ Route to Codex CLI for execution
   │  ├─ Track progress in execution.md
   │  ├─ Auto-commit if enabled
   │  └─ Next task
   └─ Complete all tasks

Post-Execution:
   ├─ Generate execution summary
   ├─ Record completion status
   ├─ Identify any failures
   └─ Suggest next steps

Output:
   ├─ .workflow/.execution/{session-id}/execution.md (overview + timeline)
   ├─ .workflow/.execution/{session-id}/execution-events.md (detailed log)
   └─ Git commits (if --auto-commit enabled)
```

## Output Structure

```
.workflow/.execution/EXEC-{slug}-{date}/
├── execution.md              # Plan overview + task table + timeline
└── execution-events.md       # ⭐ Unified log (all executions) - SINGLE SOURCE OF TRUTH
```

---

## Implementation Details

### Session Setup

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

// Resolve plan path
let planPath = "$PLAN"
if (!fs.existsSync(planPath)) {
  // Auto-detect from common locations
  const candidates = [
    '.workflow/IMPL_PLAN.md',
    '.workflow/.planning/*/plan-note.md',
    '.workflow/.brainstorm/*/synthesis.json',
    '.workflow/.analysis/*/conclusions.json'
  ]
  planPath = autoDetectPlan(candidates)
}

// Create session
const planSlug = path.basename(planPath).replace(/[^a-z0-9-]/g, '').substring(0, 30)
const dateStr = getUtc8ISOString().substring(0, 10)
const randomId = Math.random().toString(36).substring(7)
const sessionId = `EXEC-${planSlug}-${dateStr}-${randomId}`

const sessionFolder = `.workflow/.execution/${sessionId}`
const executionPath = `${sessionFolder}/execution.md`
const eventsPath = `${sessionFolder}/execution-events.md`

bash(`mkdir -p ${sessionFolder}`)
```

---

### Phase 1: Plan Detection & Parsing

#### Step 1.1: Load Plan File

```javascript
// Detect plan format and parse
let tasks = []

if (planPath.endsWith('.json')) {
  // JSON plan (from lite-plan, collaborative-plan, etc.)
  const planJson = JSON.parse(Read(planPath))
  tasks = parsePlanJson(planJson)
} else if (planPath.endsWith('.md')) {
  // Markdown plan (IMPL_PLAN.md, plan-note.md, etc.)
  const planMd = Read(planPath)
  tasks = parsePlanMarkdown(planMd)
} else if (planPath.endsWith('synthesis.json')) {
  // Brainstorm synthesis
  const synthesis = JSON.parse(Read(planPath))
  tasks = convertSynthesisToTasks(synthesis)
} else if (planPath.endsWith('conclusions.json')) {
  // Analysis conclusions
  const conclusions = JSON.parse(Read(planPath))
  tasks = convertConclusionsToTasks(conclusions)
} else {
  throw new Error(`Unsupported plan format: ${planPath}`)
}
```

#### Step 1.2: Build Execution Order

```javascript
// Handle task dependencies
const depGraph = buildDependencyGraph(tasks)

// Validate: no cycles
validateNoCycles(depGraph)

// Calculate execution order (simple topological sort)
const executionOrder = topologicalSort(depGraph, tasks)

// In Codex: serial execution, no parallel waves
console.log(`Total tasks: ${tasks.length}`)
console.log(`Execution order: ${executionOrder.map(t => t.id).join(' → ')}`)
```

#### Step 1.3: Generate execution.md

```markdown
# 执行计划

**Session**: ${sessionId}
**Plan Source**: ${planPath}
**Started**: ${getUtc8ISOString()}

---

## 计划概览

| 字段 | 值 |
|------|-----|
| 总任务数 | ${tasks.length} |
| 计划来源 | ${planPath} |
| 执行模式 | ${dryRun ? '模拟' : '实际'} |
| 自动提交 | ${autoCommit ? '启用' : '禁用'} |

---

## 任务列表

| ID | 标题 | 复杂度 | 依赖 | 状态 |
|----|------|--------|-------|-------|
${tasks.map(t => `| ${t.id} | ${t.title} | ${t.complexity || 'medium'} | ${t.depends_on?.join(',') || '-'} | ⏳ |`).join('\n')}

---

## 执行时间线

*(更新于 execution-events.md)*

---
```

---

### Phase 2: Pre-Execution Analysis

#### Step 2.1: Feasibility Check

```javascript
const issues = []

// Check file conflicts
const fileMap = new Map()
for (const task of tasks) {
  for (const file of task.files_to_modify || []) {
    if (!fileMap.has(file)) fileMap.set(file, [])
    fileMap.get(file).push(task.id)
  }
}

for (const [file, taskIds] of fileMap.entries()) {
  if (taskIds.length > 1) {
    // Sequential modification of same file
    console.log(`⚠️ Sequential modification: ${file} (${taskIds.join(' → ')})`)
  }
}

// Check missing dependencies
for (const task of tasks) {
  for (const depId of task.depends_on || []) {
    if (!tasks.find(t => t.id === depId)) {
      issues.push(`Task ${task.id} depends on missing ${depId}`)
    }
  }
}

if (issues.length > 0) {
  console.log(`⚠️ Issues found:\n${issues.map(i => `- ${i}`).join('\n')}`)
}
```

---

### Phase 3: Serial Task Execution

#### Step 3.1: Execute Tasks Sequentially

```javascript
const executionLog = []
const taskResults = new Map()

for (const task of executionOrder) {
  console.log(`\n📋 Executing: ${task.id} - ${task.title}`)

  const eventRecord = {
    timestamp: getUtc8ISOString(),
    task_id: task.id,
    task_title: task.title,
    status: 'in_progress',
    notes: []
  }

  try {
    // Load context from previous tasks
    const priorOutputs = executionOrder
      .slice(0, executionOrder.indexOf(task))
      .map(t => taskResults.get(t.id))
      .filter(Boolean)

    const context = {
      task: task,
      prior_outputs: priorOutputs,
      plan_source: planPath
    }

    // Execute task via Codex CLI
    if (dryRun) {
      console.log(`[DRY RUN] ${task.id}`)
      eventRecord.status = 'completed'
      eventRecord.notes.push('Dry run - no changes made')
    } else {
      await executeTaskViaCLI(task, context)
      eventRecord.status = 'completed'
      
      // Auto-commit if enabled
      if (autoCommit) {
        commitTask(task)
        eventRecord.notes.push(`✅ Committed: ${task.id}`)
      }
    }

  } catch (error) {
    eventRecord.status = 'failed'
    eventRecord.error = error.message
    eventRecord.notes.push(`❌ Error: ${error.message}`)
    console.log(`❌ Failed: ${task.id}`)
  }

  executionLog.push(eventRecord)
  updateExecutionEvents(eventsPath, executionLog)
  updateExecutionMd(executionPath, task, eventRecord)
}
```

#### Step 3.2: Execute Task via CLI

**CLI Call** (synchronous):
```bash
ccw cli -p "
PURPOSE: Execute task '${task.id}: ${task.title}' from plan
Success: Task completed as specified in plan

TASK DETAILS:
- ID: ${task.id}
- Title: ${task.title}
- Description: ${task.description}
- Complexity: ${task.complexity}
- Estimated Effort: ${task.effort}

REQUIRED CHANGES:
${task.files_to_modify?.map(f => `- \`${f.path}\`: ${f.summary}`).join('\n')}

PRIOR CONTEXT:
${priorOutputs.map(p => `- ${p.task_id}: ${p.notes.join('; ')}`).join('\n')}

TASK ACTIONS:
${task.actions?.map((a, i) => `${i+1}. ${a}`).join('\n')}

MODE: write

CONTEXT: @**/* | Plan Source: ${planPath} | Task: ${task.id}

EXPECTED:
- Modifications implemented as specified
- Code follows project conventions
- No test failures introduced
- All required files updated

CONSTRAINTS: Exactly as specified in plan | No additional scope
" --tool codex --mode write
```

#### Step 3.3: Track Progress

```javascript
function updateExecutionEvents(eventsPath, log) {
  const eventsMd = `# 执行日志

**Session**: ${sessionId}
**更新**: ${getUtc8ISOString()}

---

## 事件时间线

${log.map((e, i) => `
### 事件 ${i+1}: ${e.task_id}

**时间**: ${e.timestamp}
**任务**: ${e.task_title}
**状态**: ${e.status === 'completed' ? '✅' : e.status === 'failed' ? '❌' : '⏳'}

**笔记**:
${e.notes.map(n => `- ${n}`).join('\n')}

${e.error ? `**错误**: ${e.error}` : ''}
`).join('\n')}

---

## 统计

- **总数**: ${log.length}
- **完成**: ${log.filter(e => e.status === 'completed').length}
- **失败**: ${log.filter(e => e.status === 'failed').length}
- **进行中**: ${log.filter(e => e.status === 'in_progress').length}
`

  Write(eventsPath, eventsMd)
}

function updateExecutionMd(mdPath, task, record) {
  const content = Read(mdPath)
  
  // Update task status in table
  const updated = content.replace(
    new RegExp(`\\| ${task.id} \\|.*\\| ⏳ \\|`),
    `| ${task.id} | ... | ... | ... | ${record.status === 'completed' ? '✅' : '❌'} |`
  )
  
  Write(mdPath, updated)
}
```

---

### Phase 4: Completion

#### Step 4.1: Generate Summary

```javascript
const completed = executionLog.filter(e => e.status === 'completed').length
const failed = executionLog.filter(e => e.status === 'failed').length

const summary = `
# 执行完成

**Session**: ${sessionId}
**完成时间**: ${getUtc8ISOString()}

## 结果

| 指标 | 数值 |
|------|------|
| 总任务 | ${executionLog.length} |
| 成功 | ${completed} ✅ |
| 失败 | ${failed} ❌ |
| 成功率 | ${Math.round(completed / executionLog.length * 100)}% |

## 后续步骤

${failed > 0 ? `
### ❌ 修复失败的任务

\`\`\`bash
# 检查失败详情
cat ${eventsPath}

# 重新执行失败任务
${executionLog.filter(e => e.status === 'failed').map(e => `# ${e.task_id}`).join('\n')}
\`\`\`
` : `
### ✅ 执行完成

所有任务已成功完成！
`}

## 提交日志

${executionLog.filter(e => e.notes.some(n => n.includes('Committed'))).map(e => `- ${e.task_id}: ✅`).join('\n')}
`

Write(executionPath, summary)
```

#### Step 4.2: Report Results

```javascript
console.log(`
✅ 执行完成: ${sessionId}
   成功: ${completed}/${executionLog.length}
   ${failed > 0 ? `失败: ${failed}` : '无失败'}
   
📁 详情: ${eventsPath}
`)
```

---

## Configuration

### Task Format Detection

Supports multiple plan formats:

| Format | Source | Parser |
|--------|--------|--------|
| JSON | lite-plan, collaborative-plan | parsePlanJson() |
| Markdown | IMPL_PLAN.md, plan-note.md | parsePlanMarkdown() |
| JSON synthesis | Brainstorm session | convertSynthesisToTasks() |
| JSON conclusions | Analysis session | convertConclusionsToTasks() |

### Auto-Commit Format

Conventional Commits:
```
{type}({scope}): {description}

{task_id}: {task_title}
Files: {list of modified files}
```

---

## Error Handling

| Error | Resolution |
|-------|------------|
| Plan not found | Use explicit --plan flag or check .workflow/ |
| Unsupported format | Verify plan file format matches supported types |
| Task execution fails | Check execution-events.md for details |
| Dependency missing | Verify plan completeness |

---

## Execution Modes

| Mode | Behavior |
|------|----------|
| Normal | Execute tasks sequentially, auto-commit disabled |
| --auto-commit | Execute + commit each task |
| --dry-run | Simulate execution, no changes |

---

## Usage

```bash
# Load and execute plan
PLAN="path/to/plan.json" \
  --auto-commit

# Dry run first
PLAN="path/to/plan.json" \
  --dry-run

# Auto-detect plan
# (searches .workflow/ for recent plans)
```

---

**Now execute unified-execute-with-file for**: $PLAN
