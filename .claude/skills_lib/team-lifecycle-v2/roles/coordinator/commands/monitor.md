# Monitor Command - Coordination Loop

**Purpose**: Monitor task progress, route messages, and handle checkpoints

**Invoked by**: Coordinator role.md Phase 4

**Output Tag**: `[coordinator]`

---

## Coordination Loop

> **设计原则**: 模型执行没有时间概念，禁止任何形式的轮询等待。
> 使用同步 `Task(run_in_background: false)` 调用作为等待机制。
> Worker 返回 = 阶段完成信号（天然回调），无需 sleep 轮询。

```javascript
Output("[coordinator] Entering coordination loop (Stop-Wait mode)...")

// Get all tasks and filter for pending work
const allTasks = TaskList()
const pendingTasks = allTasks.filter(t => t.status !== 'completed')

for (const task of pendingTasks) {
  // Check if all dependencies are met
  const allDepsMet = (task.blockedBy || []).every(depSubject => {
    const dep = allTasks.find(t => t.subject === depSubject)
    return dep && dep.status === 'completed'
  })

  if (!allDepsMet) {
    Output(`[coordinator] Task ${task.subject} blocked by dependencies, skipping`)
    continue
  }

  // Determine role from task subject prefix → TASK_METADATA lookup
  const taskMeta = TASK_METADATA[task.subject]
  const role = taskMeta ? taskMeta.role : task.owner

  Output(`[coordinator] Starting task: ${task.subject} (role: ${role})`)

  // Mark as in_progress
  TaskUpdate({ taskId: task.id, status: 'in_progress' })

  // ============================================================
  // Spawn worker using SKILL.md Coordinator Spawn Template
  // Key: worker MUST call Skill() to load role definition
  // ============================================================
  Task({
    subagent_type: "general-purpose",
    description: `Spawn ${role} worker for ${task.subject}`,
    team_name: teamName,
    name: role,
    prompt: `你是 team "${teamName}" 的 ${role.toUpperCase()}.

## ⚠️ 首要指令（MUST）
你的所有工作必须通过调用 Skill 获取角色定义后执行，禁止自行发挥：
Skill(skill="team-lifecycle-v2", args="--role=${role}")
此调用会加载你的角色定义（role.md）、可用命令（commands/*.md）和完整执行逻辑。

当前任务: ${task.subject} - ${task.description}
Session: ${sessionFolder}

## 角色准则（强制）
- 你只能处理 ${taskMeta ? task.subject.split('-')[0] : ''}-* 前缀的任务，不得执行其他角色的工作
- 所有输出（SendMessage、team_msg）必须带 [${role}] 标识前缀
- 仅与 coordinator 通信，不得直接联系其他 worker
- 不得使用 TaskCreate 为其他角色创建任务

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

## 工作流程（严格按顺序）
1. 调用 Skill(skill="team-lifecycle-v2", args="--role=${role}") 获取角色定义和执行逻辑
2. 按 role.md 中的 5-Phase 流程执行（TaskList → 找到任务 → 执行 → 汇报）
3. team_msg log + SendMessage 结果给 coordinator（带 [${role}] 标识）
4. TaskUpdate completed → 检查下一个任务 → 回到步骤 1`,
    run_in_background: false
  })

  // Worker returned — check status
  const completedTask = TaskGet({ taskId: task.id })
  Output(`[coordinator] Task ${task.subject} status: ${completedTask.status}`)

  if (completedTask.status === "completed") {
    handleTaskComplete({ subject: task.subject, output: completedTask })
  }

  // Update session progress
  const session = Read(sessionFile)
  const allTasksNow = TaskList()
  session.tasks_completed = allTasksNow.filter(t => t.status === "completed").length
  Write(sessionFile, session)

  // Check if all tasks complete
  const remaining = allTasksNow.filter(t => t.status !== "completed")
  if (remaining.length === 0) {
    Output("[coordinator] All tasks completed!")
    break
  }
}

Output("[coordinator] Coordination loop complete")
```

---

## Message Handlers

### handleTaskComplete

```javascript
function handleTaskComplete(message) {
  const subject = message.subject

  Output(`[coordinator] Task completed: ${subject}`)

  // Check for dependent tasks
  const allTasks = TaskList()
  const dependentTasks = allTasks.filter(t =>
    (t.blockedBy || []).includes(subject) && t.status === 'pending'
  )

  Output(`[coordinator] Checking ${dependentTasks.length} dependent tasks`)

  for (const depTask of dependentTasks) {
    // Check if all dependencies are met
    const allDepsMet = (depTask.blockedBy || []).every(depSubject => {
      const dep = allTasks.find(t => t.subject === depSubject)
      return dep && dep.status === 'completed'
    })

    if (allDepsMet) {
      Output(`[coordinator] Unblocking task: ${depTask.subject} (${depTask.owner})`)
    }
  }

  // Special checkpoint: Spec phase complete before implementation
  if (subject === "DISCUSS-006" && (requirements.mode === "full-lifecycle" || requirements.mode === "full-lifecycle-fe")) {
    Output("[coordinator] Spec phase complete. Checkpoint before implementation.")
    handleSpecCompleteCheckpoint()
  }
}
```

---

### handleTaskBlocked

```javascript
function handleTaskBlocked(message) {
  const subject = message.subject
  const reason = message.reason

  Output(`[coordinator] Task blocked: ${subject}`)
  Output(`[coordinator] Reason: ${reason}`)

  // Check if block reason is dependency-related
  if (reason.includes("dependency")) {
    Output("[coordinator] Dependency block detected. Waiting for predecessor tasks.")
    return
  }

  // Check if block reason is ambiguity-related
  if (reason.includes("ambiguous") || reason.includes("unclear")) {
    Output("[coordinator] Ambiguity detected. Routing to analyst for research.")
    handleAmbiguityBlock(subject, reason)
    return
  }

  // Unknown block reason - escalate to user
  Output("[coordinator] Unknown block reason. Escalating to user.")
  const userDecision = AskUserQuestion({
    question: `Task ${subject} is blocked: ${reason}. How to proceed?`,
    choices: [
      "retry - Retry the task",
      "skip - Skip this task",
      "abort - Abort entire workflow",
      "manual - Provide manual input"
    ]
  })

  switch (userDecision) {
    case "retry":
      // Task will be retried in next coordination loop iteration
      break

    case "skip":
      const task = TaskList().find(t => t.subject === subject)
      if (task) TaskUpdate({ taskId: task.id, status: "completed" })
      Output(`[coordinator] Task ${subject} skipped by user`)
      break

    case "abort":
      Output("[coordinator] Workflow aborted by user")
      loopActive = false
      break

    case "manual":
      const manualInput = AskUserQuestion({
        question: `Provide manual input for task ${subject}:`,
        type: "text"
      })
      const taskToComplete = TaskList().find(t => t.subject === subject)
      if (taskToComplete) TaskUpdate({ taskId: taskToComplete.id, status: "completed" })
      Output(`[coordinator] Task ${subject} completed with manual input`)
      break
  }
}

// Route ambiguity to analyst (explorer as fallback)
function handleAmbiguityBlock(subject, reason) {
  Output(`[coordinator] Creating research task for ambiguity in ${subject}`)

  // Spawn analyst on-demand to research the ambiguity
  Task({
    subagent_type: "general-purpose",
    description: `Spawn analyst for ambiguity research`,
    team_name: teamName,
    name: "analyst",
    prompt: `你是 team "${teamName}" 的 ANALYST.

## ⚠️ 首要指令（MUST）
Skill(skill="team-lifecycle-v2", args="--role=analyst")

## 紧急研究任务
被阻塞任务: ${subject}
阻塞原因: ${reason}
Session: ${sessionFolder}

请调查并通过 SendMessage 汇报研究结果给 coordinator。`,
    run_in_background: false
  })

  Output(`[coordinator] Ambiguity research complete for ${subject}`)
}
```

---

### handleDiscussionNeeded

```javascript
function handleDiscussionNeeded(message) {
  const subject = message.subject
  const question = message.question
  const context = message.context

  Output(`[coordinator] Discussion needed for task: ${subject}`)
  Output(`[coordinator] Question: ${question}`)

  // Route to user
  const userResponse = AskUserQuestion({
    question: `Task ${subject} needs clarification:\n\n${question}\n\nContext: ${context}`,
    type: "text"
  })

  Output(`[coordinator] User response received for ${subject}`)
}
```

---

## Checkpoint Handlers

### handleSpecCompleteCheckpoint

```javascript
function handleSpecCompleteCheckpoint() {
  Output("[coordinator] ========================================")
  Output("[coordinator] SPEC PHASE COMPLETE - CHECKPOINT")
  Output("[coordinator] ========================================")

  // Ask user to review
  const userDecision = AskUserQuestion({
    question: "Spec phase complete (DISCUSS-006 done). Review specifications before proceeding to implementation?",
    choices: [
      "proceed - Proceed to implementation (PLAN-001)",
      "review - Review spec artifacts in session folder",
      "revise - Request spec revision",
      "stop - Stop here (spec-only)"
    ]
  })

  switch (userDecision) {
    case "proceed":
      Output("[coordinator] Proceeding to implementation phase (PLAN-001)")
      break

    case "review":
      Output("[coordinator] Spec artifacts are in: " + sessionFolder + "/spec/")
      Output("[coordinator] Please review and then re-invoke to continue.")
      handleSpecCompleteCheckpoint()
      break

    case "revise":
      const revisionScope = AskUserQuestion({
        question: "Which spec artifacts need revision? (e.g., DRAFT-002 requirements, DRAFT-003 architecture)",
        type: "text"
      })
      Output(`[coordinator] Revision requested: ${revisionScope}`)
      handleSpecCompleteCheckpoint()
      break

    case "stop":
      Output("[coordinator] Stopping at spec phase (user request)")
      loopActive = false
      break
  }
}
```

---

## Message Routing Tables

### Spec Phase Messages

| Message Type | Sender Role | Trigger | Coordinator Action |
|--------------|-------------|---------|-------------------|
| `research_ready` | analyst | RESEARCH-* done | Update session, unblock DISCUSS-001 |
| `discussion_ready` | discussant | DISCUSS-* done | Unblock next DRAFT-* or QUALITY-* |
| `draft_ready` | writer | DRAFT-* done | Unblock next DISCUSS-* |
| `quality_result` | reviewer | QUALITY-* done | Unblock DISCUSS-006 |
| `error` | any worker | Task failed | Log error, escalate to user |

### Impl Phase Messages

| Message Type | Sender Role | Trigger | Coordinator Action |
|--------------|-------------|---------|-------------------|
| `plan_ready` | planner | PLAN-001 done | Unblock IMPL-001 (+ DEV-FE-001 for fullstack) |
| `impl_complete` | executor | IMPL-001 done | Unblock TEST-001 + REVIEW-001 |
| `test_result` | tester | TEST-001 done | Log results |
| `review_result` | reviewer | REVIEW-001 done | Log results |
| `dev_fe_complete` | fe-developer | DEV-FE-* done | Unblock QA-FE-* |
| `qa_fe_result` | fe-qa | QA-FE-* done | Check verdict, maybe create GC round |
| `error` | any worker | Task failed | Log error, escalate to user |

---

## Progress Tracking

```javascript
function logProgress() {
  const session = Read(sessionFile)
  const completedCount = session.tasks_completed
  const totalCount = session.tasks_total
  const percentage = Math.round((completedCount / totalCount) * 100)

  Output(`[coordinator] Progress: ${completedCount}/${totalCount} tasks (${percentage}%)`)
  Output(`[coordinator] Current phase: ${session.current_phase}`)
}
```

---

## Output Format

All outputs from this command use the `[coordinator]` tag:

```
[coordinator] Entering coordination loop (Stop-Wait mode)...
[coordinator] Starting task: RESEARCH-001 (role: analyst)
[coordinator] Task RESEARCH-001 status: completed
[coordinator] Checking 1 dependent tasks
[coordinator] Unblocking task: DISCUSS-001 (discussant)
[coordinator] Progress: 1/12 tasks (8%)
```
