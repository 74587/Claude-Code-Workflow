# Phase 2: Execution

## Overview

消费 Phase 1 产出的统一 JSONL (`tasks.jsonl`)，串行执行任务并进行收敛验证，通过 `execution.md` + `execution-events.md` 跟踪进度。

**Core workflow**: Load JSONL → Validate → Pre-Execution Analysis → Execute → Verify Convergence → Track Progress

**Key features**:
- **Single format**: 只消费统一 JSONL (`tasks.jsonl`)
- **Convergence-driven**: 每个任务执行后验证收敛标准
- **Serial execution**: 按拓扑序串行执行，依赖跟踪
- **Dual progress tracking**: `execution.md` (概览) + `execution-events.md` (事件流)
- **Auto-commit**: 可选的每任务 conventional commits
- **Dry-run mode**: 模拟执行，不做实际修改

## Invocation

```javascript
$unified-execute-with-file PLAN="${sessionFolder}/tasks.jsonl"

// With options
$unified-execute-with-file PLAN="${sessionFolder}/tasks.jsonl" --auto-commit
$unified-execute-with-file PLAN="${sessionFolder}/tasks.jsonl" --dry-run
```

## Output Structure

```
${projectRoot}/.workflow/.execution/EXEC-{slug}-{date}-{random}/
├── execution.md              # Plan overview + task table + summary statistics
└── execution-events.md       # Unified event log (single source of truth)
```

Additionally, the source `tasks.jsonl` is updated in-place with `_execution` states.

---

## Session Initialization

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
const projectRoot = Bash(`git rev-parse --show-toplevel 2>/dev/null || pwd`).trim()

// Parse arguments
const autoCommit = $ARGUMENTS.includes('--auto-commit')
const dryRun = $ARGUMENTS.includes('--dry-run')
const planMatch = $ARGUMENTS.match(/PLAN="([^"]+)"/) || $ARGUMENTS.match(/PLAN=(\S+)/)
let planPath = planMatch ? planMatch[1] : null

// Auto-detect if no PLAN specified
if (!planPath) {
  // Search in order (most recent first):
  //   .workflow/.lite-plan/*/tasks.jsonl
  //   .workflow/.req-plan/*/tasks.jsonl
  //   .workflow/.planning/*/tasks.jsonl
  //   .workflow/.analysis/*/tasks.jsonl
  //   .workflow/.brainstorm/*/tasks.jsonl
}

// Resolve path
planPath = path.isAbsolute(planPath) ? planPath : `${projectRoot}/${planPath}`

// Generate session ID
const slug = path.basename(path.dirname(planPath)).toLowerCase().substring(0, 30)
const dateStr = getUtc8ISOString().substring(0, 10)
const random = Math.random().toString(36).substring(2, 9)
const sessionId = `EXEC-${slug}-${dateStr}-${random}`
const sessionFolder = `${projectRoot}/.workflow/.execution/${sessionId}`

Bash(`mkdir -p ${sessionFolder}`)
```

---

## Phase 1: Load & Validate

**Objective**: Parse unified JSONL, validate schema and dependencies, build execution order.

### Step 1.1: Parse Unified JSONL

```javascript
const content = Read(planPath)
const tasks = content.split('\n')
  .filter(line => line.trim())
  .map((line, i) => {
    try { return JSON.parse(line) }
    catch (e) { throw new Error(`Line ${i + 1}: Invalid JSON — ${e.message}`) }
  })

if (tasks.length === 0) throw new Error('No tasks found in JSONL file')
```

### Step 1.2: Validate Schema

```javascript
const errors = []
tasks.forEach((task, i) => {
  // Required fields
  if (!task.id) errors.push(`Task ${i + 1}: missing 'id'`)
  if (!task.title) errors.push(`Task ${i + 1}: missing 'title'`)
  if (!task.description) errors.push(`Task ${i + 1}: missing 'description'`)
  if (!Array.isArray(task.depends_on)) errors.push(`${task.id}: missing 'depends_on' array`)

  // Convergence required
  if (!task.convergence) {
    errors.push(`${task.id}: missing 'convergence'`)
  } else {
    if (!task.convergence.criteria?.length) errors.push(`${task.id}: empty convergence.criteria`)
    if (!task.convergence.verification) errors.push(`${task.id}: missing convergence.verification`)
    if (!task.convergence.definition_of_done) errors.push(`${task.id}: missing convergence.definition_of_done`)
  }
})

if (errors.length) {
  // Report errors, stop execution
}
```

### Step 1.3: Build Execution Order

```javascript
// 1. Validate dependency references
const taskIds = new Set(tasks.map(t => t.id))
tasks.forEach(task => {
  task.depends_on.forEach(dep => {
    if (!taskIds.has(dep)) errors.push(`${task.id}: depends on unknown task '${dep}'`)
  })
})

// 2. Detect cycles (DFS)
function detectCycles(tasks) {
  const graph = new Map(tasks.map(t => [t.id, t.depends_on || []]))
  const visited = new Set(), inStack = new Set(), cycles = []
  function dfs(node, path) {
    if (inStack.has(node)) { cycles.push([...path, node].join(' → ')); return }
    if (visited.has(node)) return
    visited.add(node); inStack.add(node)
    ;(graph.get(node) || []).forEach(dep => dfs(dep, [...path, node]))
    inStack.delete(node)
  }
  tasks.forEach(t => { if (!visited.has(t.id)) dfs(t.id, []) })
  return cycles
}
const cycles = detectCycles(tasks)
if (cycles.length) errors.push(`Circular dependencies: ${cycles.join('; ')}`)

// 3. Topological sort
function topoSort(tasks) {
  const inDegree = new Map(tasks.map(t => [t.id, 0]))
  tasks.forEach(t => t.depends_on.forEach(dep => {
    inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1)
  }))
  const queue = tasks.filter(t => inDegree.get(t.id) === 0).map(t => t.id)
  const order = []
  while (queue.length) {
    const id = queue.shift()
    order.push(id)
    tasks.forEach(t => {
      if (t.depends_on.includes(id)) {
        inDegree.set(t.id, inDegree.get(t.id) - 1)
        if (inDegree.get(t.id) === 0) queue.push(t.id)
      }
    })
  }
  return order
}
const executionOrder = topoSort(tasks)
```

### Step 1.4: Initialize Execution Artifacts

```javascript
// execution.md
const executionMd = `# Execution Overview

## Session Info
- **Session ID**: ${sessionId}
- **Plan Source**: ${planPath}
- **Started**: ${getUtc8ISOString()}
- **Total Tasks**: ${tasks.length}
- **Mode**: ${dryRun ? 'Dry-run (no changes)' : 'Direct inline execution'}
- **Auto-Commit**: ${autoCommit ? 'Enabled' : 'Disabled'}

## Task Overview

| # | ID | Title | Type | Priority | Effort | Dependencies | Status |
|---|-----|-------|------|----------|--------|--------------|--------|
${tasks.map((t, i) => `| ${i+1} | ${t.id} | ${t.title} | ${t.type || '-'} | ${t.priority || '-'} | ${t.effort || '-'} | ${t.depends_on.join(', ') || '-'} | pending |`).join('\n')}

## Pre-Execution Analysis
> Populated in Phase 2

## Execution Timeline
> Updated as tasks complete

## Execution Summary
> Updated after all tasks complete
`
Write(`${sessionFolder}/execution.md`, executionMd)

// execution-events.md
Write(`${sessionFolder}/execution-events.md`, `# Execution Events

**Session**: ${sessionId}
**Started**: ${getUtc8ISOString()}
**Source**: ${planPath}

---

`)
```

---

## Phase 2: Pre-Execution Analysis

**Objective**: Validate feasibility and identify issues before execution.

### Step 2.1: Analyze File Conflicts

```javascript
const fileTaskMap = new Map()  // file → [taskIds]
tasks.forEach(task => {
  (task.files || []).forEach(f => {
    const key = f.path
    if (!fileTaskMap.has(key)) fileTaskMap.set(key, [])
    fileTaskMap.get(key).push(task.id)
  })
})

const conflicts = []
fileTaskMap.forEach((taskIds, file) => {
  if (taskIds.length > 1) {
    conflicts.push({ file, tasks: taskIds, resolution: 'Execute in dependency order' })
  }
})

// Check file existence
const missingFiles = []
tasks.forEach(task => {
  (task.files || []).forEach(f => {
    if (f.action !== 'create' && !file_exists(f.path)) {
      missingFiles.push({ file: f.path, task: task.id })
    }
  })
})
```

### Step 2.2: Append to execution.md

```javascript
// Replace "Pre-Execution Analysis" section with:
// - File Conflicts (list or "No conflicts")
// - Missing Files (list or "All files exist")
// - Dependency Validation (errors or "No issues")
// - Execution Order (numbered list)
```

### Step 2.3: User Confirmation

```javascript
if (!dryRun) {
  AskUserQuestion({
    questions: [{
      question: `Execute ${tasks.length} tasks?\n\n${conflicts.length ? `⚠ ${conflicts.length} file conflicts\n` : ''}Execution order:\n${executionOrder.map((id, i) => `  ${i+1}. ${id}: ${tasks.find(t => t.id === id).title}`).join('\n')}`,
      header: "Confirm",
      multiSelect: false,
      options: [
        { label: "Execute", description: "Start serial execution" },
        { label: "Dry Run", description: "Simulate without changes" },
        { label: "Cancel", description: "Abort execution" }
      ]
    }]
  })
}
```

---

## Phase 3: Serial Execution + Convergence Verification

**Objective**: Execute tasks sequentially, verify convergence after each task, track all state.

**Execution Model**: Direct inline execution — main process reads, edits, writes files directly. No CLI delegation.

### Step 3.1: Execution Loop

```javascript
const completedTasks = new Set()
const failedTasks = new Set()
const skippedTasks = new Set()

for (const taskId of executionOrder) {
  const task = tasks.find(t => t.id === taskId)
  const startTime = getUtc8ISOString()

  // 1. Check dependencies
  const unmetDeps = task.depends_on.filter(dep => !completedTasks.has(dep))
  if (unmetDeps.length) {
    appendToEvents(task, 'BLOCKED', `Unmet dependencies: ${unmetDeps.join(', ')}`)
    skippedTasks.add(task.id)
    task._execution = { status: 'skipped', executed_at: startTime,
      result: { success: false, error: `Blocked by: ${unmetDeps.join(', ')}` } }
    continue
  }

  // 2. Record START event
  appendToEvents(`## ${getUtc8ISOString()} — ${task.id}: ${task.title}

**Type**: ${task.type || '-'} | **Priority**: ${task.priority || '-'} | **Effort**: ${task.effort || '-'}
**Status**: ⏳ IN PROGRESS
**Files**: ${(task.files || []).map(f => f.path).join(', ') || 'To be determined'}
**Description**: ${task.description}
**Convergence Criteria**:
${task.convergence.criteria.map(c => `- [ ] ${c}`).join('\n')}

### Execution Log
`)

  if (dryRun) {
    // Simulate: mark as completed without changes
    appendToEvents(`\n**Status**: ⏭ DRY RUN (no changes)\n\n---\n`)
    task._execution = { status: 'completed', executed_at: startTime,
      result: { success: true, summary: 'Dry run — no changes made' } }
    completedTasks.add(task.id)
    continue
  }

  // 3. Execute task directly
  //    - Read each file in task.files (if specified)
  //    - Analyze what changes satisfy task.description + task.convergence.criteria
  //    - If task.files has detailed changes, use them as guidance
  //    - Apply changes using Edit (preferred) or Write (for new files)
  //    - Use Grep/Glob/mcp__ace-tool for discovery if needed
  //    - Use Bash for build/test commands

  // 4. Verify convergence
  const convergenceResults = verifyConvergence(task)

  const endTime = getUtc8ISOString()
  const filesModified = getModifiedFiles()

  if (convergenceResults.allPassed) {
    // 5a. Record SUCCESS
    appendToEvents(`
**Status**: ✅ COMPLETED
**Duration**: ${calculateDuration(startTime, endTime)}
**Files Modified**: ${filesModified.join(', ')}

#### Changes Summary
${changeSummary}

#### Convergence Verification
${task.convergence.criteria.map((c, i) => `- [${convergenceResults.verified[i] ? 'x' : ' '}] ${c}`).join('\n')}
- **Verification**: ${convergenceResults.verificationOutput}
- **Definition of Done**: ${task.convergence.definition_of_done}

---
`)
    task._execution = {
      status: 'completed', executed_at: endTime,
      result: {
        success: true,
        files_modified: filesModified,
        summary: changeSummary,
        convergence_verified: convergenceResults.verified
      }
    }
    completedTasks.add(task.id)
  } else {
    // 5b. Record FAILURE
    handleTaskFailure(task, convergenceResults, startTime, endTime)
  }

  // 6. Auto-commit if enabled
  if (autoCommit && task._execution.status === 'completed') {
    autoCommitTask(task, filesModified)
  }
}
```

### Step 3.2: Convergence Verification

```javascript
function verifyConvergence(task) {
  const results = {
    verified: [],           // boolean[] per criterion
    verificationOutput: '', // output of verification command
    allPassed: true
  }

  // 1. Check each criterion
  //    For each criterion in task.convergence.criteria:
  //      - If it references a testable condition, check it
  //      - If it's manual, mark as verified based on changes made
  //      - Record true/false per criterion
  task.convergence.criteria.forEach(criterion => {
    const passed = evaluateCriterion(criterion, task)
    results.verified.push(passed)
    if (!passed) results.allPassed = false
  })

  // 2. Run verification command (if executable)
  const verification = task.convergence.verification
  if (isExecutableCommand(verification)) {
    try {
      const output = Bash(verification, { timeout: 120000 })
      results.verificationOutput = `${verification} → PASS`
    } catch (e) {
      results.verificationOutput = `${verification} → FAIL: ${e.message}`
      results.allPassed = false
    }
  } else {
    results.verificationOutput = `Manual: ${verification}`
  }

  return results
}

function isExecutableCommand(verification) {
  // Detect executable patterns: npm, npx, jest, tsc, curl, pytest, go test, etc.
  return /^(npm|npx|jest|tsc|eslint|pytest|go\s+test|cargo\s+test|curl|make)/.test(verification.trim())
}
```

### Step 3.3: Failure Handling

```javascript
function handleTaskFailure(task, convergenceResults, startTime, endTime) {
  appendToEvents(`
**Status**: ❌ FAILED
**Duration**: ${calculateDuration(startTime, endTime)}
**Error**: Convergence verification failed

#### Failed Criteria
${task.convergence.criteria.map((c, i) => `- [${convergenceResults.verified[i] ? 'x' : ' '}] ${c}`).join('\n')}
- **Verification**: ${convergenceResults.verificationOutput}

---
`)

  task._execution = {
    status: 'failed', executed_at: endTime,
    result: {
      success: false,
      error: 'Convergence verification failed',
      convergence_verified: convergenceResults.verified
    }
  }
  failedTasks.add(task.id)

  // Ask user
  AskUserQuestion({
    questions: [{
      question: `Task ${task.id} failed convergence verification. How to proceed?`,
      header: "Failure",
      multiSelect: false,
      options: [
        { label: "Skip & Continue", description: "Skip this task, continue with next" },
        { label: "Retry", description: "Retry this task" },
        { label: "Accept", description: "Mark as completed despite failure" },
        { label: "Abort", description: "Stop execution, keep progress" }
      ]
    }]
  })
}
```

### Step 3.4: Auto-Commit

```javascript
function autoCommitTask(task, filesModified) {
  Bash(`git add ${filesModified.join(' ')}`)

  const commitType = {
    fix: 'fix', refactor: 'refactor', feature: 'feat',
    enhancement: 'feat', testing: 'test', infrastructure: 'chore'
  }[task.type] || 'chore'

  const scope = inferScope(filesModified)

  Bash(`git commit -m "$(cat <<'EOF'
${commitType}(${scope}): ${task.title}

Task: ${task.id}
Source: ${path.basename(planPath)}
EOF
)"`)

  appendToEvents(`**Commit**: \`${commitType}(${scope}): ${task.title}\`\n`)
}
```

---

## Phase 4: Completion

**Objective**: Finalize all artifacts, write back execution state, offer follow-up actions.

### Step 4.1: Finalize execution.md

Append summary statistics to execution.md:

```javascript
const summary = `
## Execution Summary

- **Completed**: ${getUtc8ISOString()}
- **Total Tasks**: ${tasks.length}
- **Succeeded**: ${completedTasks.size}
- **Failed**: ${failedTasks.size}
- **Skipped**: ${skippedTasks.size}
- **Success Rate**: ${Math.round(completedTasks.size / tasks.length * 100)}%

### Task Results

| ID | Title | Status | Convergence | Files Modified |
|----|-------|--------|-------------|----------------|
${tasks.map(t => {
  const ex = t._execution || {}
  const convergenceStatus = ex.result?.convergence_verified
    ? `${ex.result.convergence_verified.filter(v => v).length}/${ex.result.convergence_verified.length}`
    : '-'
  return `| ${t.id} | ${t.title} | ${ex.status || 'pending'} | ${convergenceStatus} | ${(ex.result?.files_modified || []).join(', ') || '-'} |`
}).join('\n')}

${failedTasks.size > 0 ? `### Failed Tasks

${[...failedTasks].map(id => {
  const t = tasks.find(t => t.id === id)
  return `- **${t.id}**: ${t.title} — ${t._execution?.result?.error || 'Unknown'}`
}).join('\n')}
` : ''}
### Artifacts
- **Plan Source**: ${planPath}
- **Execution Overview**: ${sessionFolder}/execution.md
- **Execution Events**: ${sessionFolder}/execution-events.md
`
// Append to execution.md
```

### Step 4.2: Finalize execution-events.md

```javascript
appendToEvents(`
---

# Session Summary

- **Session**: ${sessionId}
- **Completed**: ${getUtc8ISOString()}
- **Tasks**: ${completedTasks.size} completed, ${failedTasks.size} failed, ${skippedTasks.size} skipped
- **Total Events**: ${completedTasks.size + failedTasks.size + skippedTasks.size}
`)
```

### Step 4.3: Write Back tasks.jsonl with _execution

Update the source JSONL file with execution states:

```javascript
const updatedJsonl = tasks.map(task => JSON.stringify(task)).join('\n')
Write(planPath, updatedJsonl)
// Each task now has _execution: { status, executed_at, result }
```

**_execution State** (added to each task):

```javascript
{
  // ... original task fields ...
  _execution: {
    status: "completed" | "failed" | "skipped",
    executed_at: "ISO timestamp",
    result: {
      success: boolean,
      files_modified: string[],     // list of modified file paths
      summary: string,              // change description
      convergence_verified: boolean[],  // per criterion
      error: string                 // if failed
    }
  }
}
```

### Step 4.4: Post-Completion Options

```javascript
AskUserQuestion({
  questions: [{
    question: `Execution complete: ${completedTasks.size}/${tasks.length} succeeded (${Math.round(completedTasks.size / tasks.length * 100)}%).\nNext step:`,
    header: "Post-Execute",
    multiSelect: false,
    options: [
      { label: "Retry Failed", description: `Re-execute ${failedTasks.size} failed tasks` },
      { label: "View Events", description: "Display execution-events.md" },
      { label: "Create Issue", description: "Create issue from failed tasks" },
      { label: "Done", description: "End workflow" }
    ]
  }]
})
```

| Selection | Action |
|-----------|--------|
| Retry Failed | Filter tasks with `_execution.status === 'failed'`, re-execute, append `[RETRY]` events |
| View Events | Display execution-events.md content |
| Create Issue | `$issue:new` from failed task details |
| Done | Display artifact paths, end workflow |

---

## Error Handling & Recovery

| Situation | Action | Recovery |
|-----------|--------|----------|
| JSONL file not found | Report error with path | Check path, verify planning phase output |
| Invalid JSON line | Report line number and error | Fix JSONL file manually |
| Missing convergence | Report validation error | Add convergence fields to tasks |
| Circular dependency | Stop, report cycle path | Fix dependencies in JSONL |
| Task execution fails | Record in events, ask user | Retry, skip, accept, or abort |
| Convergence verification fails | Mark task failed, ask user | Fix code and retry, or accept |
| Verification command timeout | Mark as unverified | Manual verification needed |
| File conflict during execution | Document in events | Resolve in dependency order |
| All tasks fail | Report, suggest plan review | Re-analyze or manual intervention |

---

## Post-Completion

After execution completes, the workflow is finished.

- **TodoWrite**: Mark "Execution (unified-execute)" as completed
- **Summary**: Display execution statistics (succeeded/failed/skipped counts)
- **Artifacts**: Point user to execution.md and execution-events.md paths
