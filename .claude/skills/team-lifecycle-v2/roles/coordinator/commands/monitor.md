# Monitor Command - Async Step-by-Step Coordination

**Purpose**: Event-driven pipeline coordination with spawn-and-stop pattern. Three wake-up sources: worker callbacks (auto-advance), user `check` (status report), user `resume` (manual advance).

**Invoked by**: Coordinator role.md Phase 4, or user commands (`check`, `resume`)

**Output Tag**: `[coordinator]`

---

## Design Principle

> **Spawn-and-Stop + Callback**: Coordinator spawns worker(s) in background, outputs status, then STOPS.
> 三种唤醒源驱动流水线推进：
>
> 1. **Worker 回调**（自动）: Worker 完成后 SendMessage → coordinator 收到消息 → 自动推进
> 2. **User `check`**（手动）: 查看执行状态图，不做推进
> 3. **User `resume`**（手动）: 检查成员状态，推进流水线
>
> - ❌ 禁止: 阻塞循环 `Task(run_in_background: false)` 串行等待所有 worker
> - ❌ 禁止: `while` 循环 + `sleep` + 轮询
> - ✅ 采用: `Task(run_in_background: true)` 后台 spawn，立即返回
> - ✅ 采用: Worker SendMessage 回调触发下一步
> - ✅ 采用: 用户指令 (`check` / `resume`) 辅助推进
>
> **原理**: Coordinator 每次调用只做一步（spawn 或 advance），然后 STOP 交还控制权。
> Worker 完成后通过 SendMessage 回调自动唤醒 coordinator。
> 用户也可随时 `check` 查看状态或 `resume` 手动推进。

---

## Wake-up Sources

| Source | Trigger | Action |
|--------|---------|--------|
| **Worker 回调** | Worker SendMessage 到 coordinator（含 `[role]` 标识） | 检测完成的任务 → 自动推进 → spawn 下一批 → STOP |
| **User `check`** | `check`, `status`, `--check` | 输出执行状态图（pipeline graph），不做推进 → STOP |
| **User `resume`** | `resume`, `continue`, `next`, `--resume` | 检查所有成员状态 → 推进流水线 → spawn 下一批 → STOP |
| **Initial** | (无关键词，dispatch 后自动) | spawn 首批 ready task → STOP |

---

## Invocation Detection

```javascript
const args = $ARGUMENTS

// 1. Worker callback detection — 消息含 [role] 标识
const callbackMatch = args.match(/\[(\w[\w-]*)\]/)
const WORKER_ROLES = ['analyst','writer','discussant','planner','executor','tester','reviewer','explorer','architect','fe-developer','fe-qa']
const isCallback = callbackMatch && WORKER_ROLES.includes(callbackMatch[1])

// 2. User command detection
const isCheck = /\b(check|status|--check)\b/i.test(args)
const isResume = /\b(resume|continue|next|--resume|--continue)\b/i.test(args)

// 3. Route
if (isCallback) {
  handleCallback(callbackMatch[1], args)  // Worker 回调 → 自动推进
} else if (isCheck) {
  handleCheck()                           // 状态报告
} else if (isResume) {
  handleResume()                          // 手动推进
} else {
  handleSpawnNext()                       // 初始 spawn
}
```

---

## Pipeline Constants (aligned with dispatch.md)

```javascript
const TASK_METADATA = {
  // Spec pipeline (12 tasks)
  "RESEARCH-001": { role: "analyst",    deps: [] },
  "DISCUSS-001":  { role: "discussant", deps: ["RESEARCH-001"] },
  "DRAFT-001":    { role: "writer",     deps: ["DISCUSS-001"] },
  "DISCUSS-002":  { role: "discussant", deps: ["DRAFT-001"] },
  "DRAFT-002":    { role: "writer",     deps: ["DISCUSS-002"] },
  "DISCUSS-003":  { role: "discussant", deps: ["DRAFT-002"] },
  "DRAFT-003":    { role: "writer",     deps: ["DISCUSS-003"] },
  "DISCUSS-004":  { role: "discussant", deps: ["DRAFT-003"] },
  "DRAFT-004":    { role: "writer",     deps: ["DISCUSS-004"] },
  "DISCUSS-005":  { role: "discussant", deps: ["DRAFT-004"] },
  "QUALITY-001":  { role: "reviewer",   deps: ["DISCUSS-005"] },
  "DISCUSS-006":  { role: "discussant", deps: ["QUALITY-001"] },
  // Impl pipeline
  "PLAN-001":   { role: "planner",  deps: [] },
  "IMPL-001":   { role: "executor", deps: ["PLAN-001"] },
  "TEST-001":   { role: "tester",   deps: ["IMPL-001"] },
  "REVIEW-001": { role: "reviewer", deps: ["IMPL-001"] },
  // Frontend pipeline
  "DEV-FE-001": { role: "fe-developer", deps: ["PLAN-001"] },
  "QA-FE-001":  { role: "fe-qa",        deps: ["DEV-FE-001"] },
  "DEV-FE-002": { role: "fe-developer", deps: ["QA-FE-001"] },
  "QA-FE-002":  { role: "fe-qa",        deps: ["DEV-FE-002"] }
}

function getExpectedChain(mode) {
  const SPEC = ["RESEARCH-001","DISCUSS-001","DRAFT-001","DISCUSS-002","DRAFT-002","DISCUSS-003","DRAFT-003","DISCUSS-004","DRAFT-004","DISCUSS-005","QUALITY-001","DISCUSS-006"]
  const IMPL = ["PLAN-001","IMPL-001","TEST-001","REVIEW-001"]
  const FE = ["DEV-FE-001","QA-FE-001"]
  const FULLSTACK = ["PLAN-001","IMPL-001","DEV-FE-001","TEST-001","QA-FE-001","REVIEW-001"]

  switch (mode) {
    case "spec-only": return SPEC
    case "impl-only": return IMPL
    case "fe-only": return ["PLAN-001", ...FE]
    case "fullstack": return FULLSTACK
    case "full-lifecycle": return [...SPEC, ...IMPL]
    case "full-lifecycle-fe": return [...SPEC, ...FULLSTACK]
    default: return [...SPEC, ...IMPL]
  }
}
```

---

## Handler: handleCallback

> Worker 回调触发。检测哪个任务完成，更新状态，自动推进到下一步。

```javascript
function handleCallback(senderRole, messageContent) {
  const session = Read(sessionFile)
  const allTasks = TaskList()

  Output(`[coordinator] Received callback from [${senderRole}]`)

  // Find completed task from this role
  const activeWorkers = session.active_workers || []
  const callbackWorker = activeWorkers.find(w => w.role === senderRole)

  if (callbackWorker) {
    const task = allTasks.find(t => t.subject === callbackWorker.task_subject)

    if (task && task.status === 'completed') {
      Output(`[coordinator] ✓ ${callbackWorker.task_subject} confirmed complete`)

      // Remove from active workers
      session.active_workers = activeWorkers.filter(w => w !== callbackWorker)
      session.tasks_completed = allTasks.filter(t => t.status === 'completed').length
      Write(sessionFile, session)

      // Handle checkpoints
      handleCheckpoints(callbackWorker.task_subject, session)

      // Auto-advance: spawn next ready tasks
      handleSpawnNext()
    } else {
      // Task not yet marked complete — worker sent progress message
      Output(`[coordinator] ${callbackWorker.task_subject} progress update from ${senderRole}`)
      Output("[coordinator] Waiting for task completion...")
      // STOP — don't advance yet
    }
  } else {
    // Callback from unknown/already-completed worker
    Output(`[coordinator] Info: message from ${senderRole} (no active task tracked)`)

    // Still check if any active workers completed
    const doneWorkers = activeWorkers.filter(w => {
      const t = allTasks.find(t2 => t2.subject === w.task_subject)
      return t && t.status === 'completed'
    })

    if (doneWorkers.length > 0) {
      for (const w of doneWorkers) {
        Output(`[coordinator] ✓ ${w.task_subject} completed (${w.role})`)
        handleCheckpoints(w.task_subject, session)
      }
      session.active_workers = activeWorkers.filter(w => !doneWorkers.includes(w))
      session.tasks_completed = allTasks.filter(t => t.status === 'completed').length
      Write(sessionFile, session)
      handleSpawnNext()
    }
    // STOP
  }
}
```

---

## Handler: handleCheck

> 读取当前状态，输出执行状态图（pipeline graph），不做任何推进动作。

```javascript
function handleCheck() {
  // 1. Load session
  const session = Read(sessionFile)
  const allTasks = TaskList()

  const completed = allTasks.filter(t => t.status === 'completed')
  const inProgress = allTasks.filter(t => t.status === 'in_progress')
  const pending = allTasks.filter(t => t.status === 'pending')
  const expectedChain = getExpectedChain(session.mode)

  // 2. Header
  Output("[coordinator] ═══════════════════════════════════")
  Output("[coordinator] Pipeline Status")
  Output("[coordinator] ═══════════════════════════════════")
  Output(`[coordinator] Mode: ${session.mode} | Progress: ${completed.length}/${expectedChain.length} (${Math.round(completed.length/expectedChain.length*100)}%)`)
  Output("")

  // 3. Execution Status Graph — 可视化流水线执行点
  Output("[coordinator] Execution Graph:")
  Output("")
  renderPipelineGraph(expectedChain, allTasks, session)
  Output("")

  // 4. Active workers detail
  if (inProgress.length > 0) {
    Output("[coordinator] Active Workers:")
    for (const t of inProgress) {
      const worker = (session.active_workers || []).find(w => w.task_subject === t.subject)
      const elapsed = worker ? timeSince(worker.spawned_at) : 'unknown'
      Output(`  ▸ ${t.subject} (${t.owner}) — running ${elapsed}`)
    }
    Output("")
  }

  // 5. Next ready
  if (pending.length > 0) {
    const nextReady = pending.filter(t => {
      const meta = TASK_METADATA[t.subject]
      return meta && meta.deps.every(dep => completed.some(c => c.subject === dep))
    })
    if (nextReady.length > 0) {
      Output(`[coordinator] Ready to spawn: ${nextReady.map(t => t.subject).join(', ')}`)
    }
  }

  Output("")
  Output("[coordinator] Commands: 'resume' to advance | 'check' to refresh")

  // STOP — no further action
}

// Render pipeline graph with execution point markers
function renderPipelineGraph(chain, allTasks, session) {
  // Status icon mapping
  function icon(subject) {
    const task = allTasks.find(t => t.subject === subject)
    if (!task) return '·'           // not created
    if (task.status === 'completed') return '✓'
    if (task.status === 'in_progress') return '▶'
    return '○'                       // pending
  }

  // Detect pipeline segments for visual grouping
  const specTasks = chain.filter(s => s.startsWith('RESEARCH') || s.startsWith('DISCUSS') || s.startsWith('DRAFT') || s.startsWith('QUALITY'))
  const implTasks = chain.filter(s => s.startsWith('PLAN') || s.startsWith('IMPL') || s.startsWith('TEST') || s.startsWith('REVIEW'))
  const feTasks = chain.filter(s => s.startsWith('DEV-FE') || s.startsWith('QA-FE'))

  // Render each segment
  if (specTasks.length > 0) {
    Output("  Spec Phase:")
    const specLine = specTasks.map(s => `[${icon(s)} ${s}]`).join(' → ')
    Output(`    ${specLine}`)
  }

  if (implTasks.length > 0 || feTasks.length > 0) {
    Output("  Impl Phase:")

    // Check for parallel branches (fullstack)
    const hasParallel = implTasks.length > 0 && feTasks.length > 0

    if (hasParallel) {
      // Show PLAN first
      const plan = implTasks.find(s => s.startsWith('PLAN'))
      if (plan) Output(`    [${icon(plan)} ${plan}]`)

      // Parallel branches
      const backendTasks = implTasks.filter(s => !s.startsWith('PLAN'))
      const beLine = backendTasks.map(s => `[${icon(s)} ${s}]`).join(' → ')
      const feLine = feTasks.map(s => `[${icon(s)} ${s}]`).join(' → ')

      Output(`      ├─ BE: ${beLine}`)
      Output(`      └─ FE: ${feLine}`)
    } else {
      // Sequential
      const allImpl = [...implTasks, ...feTasks]
      const implLine = allImpl.map(s => `[${icon(s)} ${s}]`).join(' → ')
      Output(`    ${implLine}`)
    }
  }

  // Legend
  Output("")
  Output("  ✓=done  ▶=running  ○=pending  ·=not created")
}

function timeSince(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins/60)}h${mins%60}m`
}
```

---

## Handler: handleResume

> 检查活跃 worker 是否完成，处理结果，推进流水线。

```javascript
function handleResume() {
  const session = Read(sessionFile)
  const allTasks = TaskList()
  const activeWorkers = session.active_workers || []

  // Case 1: No active workers → just spawn next
  if (activeWorkers.length === 0) {
    handleSpawnNext()
    return
  }

  // Case 2: Check each active worker's completion
  const doneWorkers = []
  const runningWorkers = []

  for (const worker of activeWorkers) {
    const task = allTasks.find(t => t.subject === worker.task_subject)
    if (task && task.status === 'completed') {
      Output(`[coordinator] ✓ ${worker.task_subject} completed (${worker.role})`)
      doneWorkers.push(worker)
    } else if (task && task.status === 'in_progress') {
      Output(`[coordinator] ⋯ ${worker.task_subject} still running (${worker.role})`)
      runningWorkers.push(worker)
    } else {
      // Worker returned abnormally
      Output(`[coordinator] ✗ ${worker.task_subject} status: ${task?.status || 'unknown'} (${worker.role})`)
      handleWorkerFailure(task, worker, session)
      // Don't add to either list — will be re-evaluated
    }
  }

  // Update session with remaining active workers
  session.active_workers = runningWorkers
  session.tasks_completed = allTasks.filter(t => t.status === 'completed').length
  Write(sessionFile, session)

  // Handle checkpoints for completed workers
  for (const worker of doneWorkers) {
    handleCheckpoints(worker.task_subject, session)
  }

  // Advance pipeline
  if (doneWorkers.length > 0) {
    // Some workers completed → try to spawn next batch
    handleSpawnNext()
  } else if (runningWorkers.length > 0) {
    // All still running
    Output("")
    Output(`[coordinator] ${runningWorkers.length} worker(s) still executing.`)
    Output("[coordinator] Use 'check' to monitor or 'resume' again later.")
    // STOP
  } else {
    // Edge case: all failed → try to spawn next anyway
    handleSpawnNext()
  }
}
```

---

## Handler: handleSpawnNext

> 查找所有就绪任务，批量 spawn，保存状态，STOP。

```javascript
function handleSpawnNext() {
  const session = Read(sessionFile)
  const allTasks = TaskList()

  const completedSubjects = allTasks.filter(t => t.status === 'completed').map(t => t.subject)
  const inProgressSubjects = allTasks.filter(t => t.status === 'in_progress').map(t => t.subject)
  const expectedChain = getExpectedChain(session.mode)

  // Find ALL ready tasks (deps met, not completed, not in_progress)
  const readySubjects = expectedChain.filter(subject => {
    if (completedSubjects.includes(subject)) return false
    if (inProgressSubjects.includes(subject)) return false
    const meta = TASK_METADATA[subject]
    if (!meta) return false
    // Full-lifecycle: PLAN-001 deps override to include DISCUSS-006
    let deps = meta.deps
    if (subject === "PLAN-001" && (session.mode === "full-lifecycle" || session.mode === "full-lifecycle-fe")) {
      deps = ["DISCUSS-006"]
    }
    return deps.every(dep => completedSubjects.includes(dep))
  })

  // Case 1: Nothing ready, but work in progress
  if (readySubjects.length === 0 && inProgressSubjects.length > 0) {
    Output(`[coordinator] Waiting for: ${inProgressSubjects.join(', ')}`)
    Output("[coordinator] Use 'check' to monitor or 'resume' after completion.")
    // STOP
    return
  }

  // Case 2: All done
  if (readySubjects.length === 0 && inProgressSubjects.length === 0) {
    Output("[coordinator] ✓ All pipeline tasks completed!")
    session.status = "completed"
    session.completed_at = new Date().toISOString()
    session.active_workers = []
    Write(sessionFile, session)
    // → goto Phase 5 (report)
    return "PIPELINE_COMPLETE"
  }

  // Case 3: Spawn ready tasks
  const newWorkers = []

  for (const subject of readySubjects) {
    const meta = TASK_METADATA[subject]
    const task = allTasks.find(t => t.subject === subject)

    // Mark as in_progress
    TaskUpdate({ taskId: task.id, status: 'in_progress' })

    // Log to message bus
    mcp__ccw-tools__team_msg({
      operation: "log", team: teamName, from: "coordinator",
      to: meta.role, type: "task_unblocked",
      summary: `[coordinator] Spawning: ${subject} → ${meta.role}`
    })

    // Spawn worker in background — NON-BLOCKING
    Task({
      subagent_type: "general-purpose",
      description: `Spawn ${meta.role} worker for ${subject}`,
      team_name: teamName,
      name: meta.role,
      prompt: buildWorkerPrompt(task, meta, session),
      run_in_background: true  // ← Spawn-and-Stop: 后台执行，立即返回
    })

    newWorkers.push({
      task_subject: subject,
      role: meta.role,
      spawned_at: new Date().toISOString()
    })

    Output(`[coordinator] ▸ Spawned: ${meta.role} → ${subject}`)
  }

  // Save state
  const existingWorkers = session.active_workers || []
  session.active_workers = [...existingWorkers, ...newWorkers]
  session.tasks_completed = completedSubjects.length
  Write(sessionFile, session)

  // Status summary
  Output("")
  Output(`[coordinator] ${newWorkers.length} agent(s) spawned.`)
  Output(`[coordinator] Pipeline: ${completedSubjects.length}/${expectedChain.length} completed`)
  Output("")
  Output("[coordinator] Type 'check' to see status, 'resume' to advance after completion.")
  // STOP — coordinator finishes output, control returns to user
}
```

---

## Worker Prompt Builder

```javascript
function buildWorkerPrompt(task, meta, session) {
  const prefix = task.subject.split('-')[0]

  return `你是 team "${teamName}" 的 ${meta.role.toUpperCase()}.

## ⚠️ 首要指令（MUST）
你的所有工作必须通过调用 Skill 获取角色定义后执行，禁止自行发挥：
Skill(skill="team-lifecycle-v2", args="--role=${meta.role}")
此调用会加载你的角色定义（role.md）、可用命令（commands/*.md）和完整执行逻辑。

当前任务: ${task.subject} - ${task.description}
Session: ${session.sessionFolder || sessionFolder}

## 角色准则（强制）
- 你只能处理 ${prefix}-* 前缀的任务，不得执行其他角色的工作
- 所有输出（SendMessage、team_msg）必须带 [${meta.role}] 标识前缀
- 仅与 coordinator 通信，不得直接联系其他 worker
- 不得使用 TaskCreate 为其他角色创建任务

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

## 工作流程（严格按顺序）
1. 调用 Skill(skill="team-lifecycle-v2", args="--role=${meta.role}") 获取角色定义和执行逻辑
2. 按 role.md 中的 5-Phase 流程执行（TaskList → 找到任务 → 执行 → 汇报）
3. team_msg log + SendMessage 结果给 coordinator（带 [${meta.role}] 标识）
4. TaskUpdate completed → 检查下一个任务 → 回到步骤 1`
}
```

---

## Checkpoint Handlers

```javascript
function handleCheckpoints(subject, session) {
  // Spec → Impl transition checkpoint
  if (subject === "DISCUSS-006" && (session.mode === "full-lifecycle" || session.mode === "full-lifecycle-fe")) {
    Output("")
    Output("[coordinator] ════════════════════════════════════════")
    Output("[coordinator] SPEC PHASE COMPLETE — CHECKPOINT")
    Output("[coordinator] ════════════════════════════════════════")
    Output("[coordinator] Spec artifacts ready in session folder.")
    Output("[coordinator] 'resume' to proceed to implementation phase (PLAN-001).")
    Output("[coordinator] Review spec in session folder before continuing.")
    // STOP — let user review before advancing to impl
  }
}
```

---

## Worker Failure Handler

```javascript
function handleWorkerFailure(task, worker, session) {
  Output(`[coordinator] Worker failure: ${worker.task_subject} (${worker.role})`)

  // Reset task to pending for retry
  if (task) {
    TaskUpdate({ taskId: task.id, status: 'pending' })
  }

  mcp__ccw-tools__team_msg({
    operation: "log", team: teamName, from: "coordinator",
    to: "user", type: "error",
    summary: `[coordinator] Worker ${worker.role} failed on ${worker.task_subject}, reset to pending`
  })

  Output(`[coordinator] Task ${worker.task_subject} reset to pending. Will retry on next 'resume'.`)
}
```

---

## Session State: active_workers

```json
{
  "active_workers": [
    {
      "task_subject": "TEST-001",
      "role": "tester",
      "spawned_at": "2026-02-26T10:00:00Z"
    },
    {
      "task_subject": "REVIEW-001",
      "role": "reviewer",
      "spawned_at": "2026-02-26T10:00:00Z"
    }
  ]
}
```

---

## Output Format

### check 状态图示例

```
[coordinator] ═══════════════════════════════════
[coordinator] Pipeline Status
[coordinator] ═══════════════════════════════════
[coordinator] Mode: fullstack | Progress: 3/6 (50%)

[coordinator] Execution Graph:

  Impl Phase:
    [✓ PLAN-001]
      ├─ BE: [✓ IMPL-001] → [▶ TEST-001] → [○ REVIEW-001]
      └─ FE: [✓ DEV-FE-001] → [▶ QA-FE-001]

  ✓=done  ▶=running  ○=pending  ·=not created

[coordinator] Active Workers:
  ▸ TEST-001 (tester) — running 3m
  ▸ QA-FE-001 (fe-qa) — running 2m

[coordinator] Commands: 'resume' to advance | 'check' to refresh
```

### callback 自动推进示例

```
[coordinator] Received callback from [tester]
[coordinator] ✓ TEST-001 confirmed complete
[coordinator] ▸ Spawned: reviewer → REVIEW-001
[coordinator] Pipeline: 4/6 completed
[coordinator] Type 'check' to see status, 'resume' to advance after completion.
```

### resume 手动推进示例

```
[coordinator] ✓ PLAN-001 completed (planner)
[coordinator] ⋯ IMPL-001 still running (executor)
[coordinator] ▸ Spawned: fe-developer → DEV-FE-001
[coordinator] 2 agent(s) active.
[coordinator] Pipeline: 1/6 completed
[coordinator] Type 'check' to see status, 'resume' to advance after completion.
```

---

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Worker 未完成（resume 检测到） | 重置任务为 pending，下次 resume 重新 spawn |
| 所有 worker 仍在执行 | 报告状态，建议稍后再 resume |
| 无就绪任务，有进行中任务 | 报告等待中，建议 check 监控 |
| Pipeline 完成 | 返回 PIPELINE_COMPLETE，跳转 Phase 5 |
| Session 文件不存在 | 报错，建议重新初始化 |
