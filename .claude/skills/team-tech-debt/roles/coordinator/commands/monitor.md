# Command: monitor

> 阶段驱动的协调循环。按 pipeline 阶段顺序等待 worker 完成，路由消息，处理 Fix-Verify 循环，检测完成。

## When to Use

- Phase 4 of Coordinator
- 任务链已创建并分发
- 需要持续监控直到所有任务完成

**Trigger conditions**:
- dispatch 完成后立即启动
- Fix-Verify 循环创建新任务后重新进入

## Strategy

### Delegation Mode

**Mode**: Stage-driven（按阶段顺序等待，非轮询）

### 设计原则

> **模型执行没有时间概念**。禁止空转 while 循环检查状态。
> 使用固定 sleep 间隔 + 最大轮询次数，避免无意义的 API 调用浪费。

### Decision Logic

```javascript
// 消息路由表
const routingTable = {
  // Scanner 完成
  'scan_complete':        { action: 'Mark TDSCAN complete, unblock TDEVAL' },
  'debt_items_found':     { action: 'Mark TDSCAN complete with items, unblock TDEVAL' },
  // Assessor 完成
  'assessment_complete':  { action: 'Mark TDEVAL complete, unblock TDPLAN' },
  // Planner 完成
  'plan_ready':           { action: 'Mark TDPLAN complete, unblock TDFIX' },
  'plan_revision':        { action: 'Plan revised, re-evaluate dependencies' },
  // Executor 完成
  'fix_complete':         { action: 'Mark TDFIX complete, unblock TDVAL' },
  'fix_progress':         { action: 'Log progress, continue waiting' },
  // Validator 完成
  'validation_complete':  { action: 'Mark TDVAL complete, evaluate quality gate', special: 'quality_gate' },
  'regression_found':     { action: 'Evaluate regression, decide Fix-Verify loop', special: 'fix_verify_decision' },
  // 错误
  'error':                { action: 'Assess severity, retry or escalate', special: 'error_handler' }
}
```

### 等待策略常量

```javascript
const POLL_INTERVAL_SEC = 300  // 每次检查间隔 5 分钟
const MAX_POLLS_PER_STAGE = 6  // 单阶段最多等待 6 次（~30 分钟）
const SLEEP_CMD = process.platform === 'win32'
  ? `timeout /t ${POLL_INTERVAL_SEC} /nobreak >nul 2>&1`
  : `sleep ${POLL_INTERVAL_SEC}`

// 统一 auto mode 检测
const autoYes = /\b(-y|--yes)\b/.test(args)
```

## Execution Steps

### Step 1: Context Preparation

```javascript
// 从 shared memory 获取上下文
const sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))

let fixVerifyIteration = 0
const MAX_FIX_VERIFY_ITERATIONS = 3

// 获取 pipeline 阶段列表
const allTasks = TaskList()
const pipelineTasks = allTasks
  .filter(t => t.owner && t.owner !== 'coordinator')
  .sort((a, b) => Number(a.id) - Number(b.id))
```

### Step 2: Stage-Driven Execution

> **核心**: 按 pipeline 阶段顺序，逐阶段等待完成。
> 每个阶段：sleep → 检查消息 → 确认任务状态 → 处理结果 → 下一阶段。

```javascript
for (const stageTask of pipelineTasks) {
  let stageComplete = false
  let pollCount = 0

  while (!stageComplete && pollCount < MAX_POLLS_PER_STAGE) {
    Bash(SLEEP_CMD)
    pollCount++

    // 1. 检查消息总线
    const messages = mcp__ccw-tools__team_msg({
      operation: "list",
      team: teamName,
      last: 5
    })

    // 2. 路由消息
    for (const msg of messages) {
      const handler = routingTable[msg.type]
      if (!handler) continue
      processMessage(msg, handler)
    }

    // 3. 确认任务状态
    const currentTask = TaskGet({ taskId: stageTask.id })
    stageComplete = currentTask.status === 'completed' || currentTask.status === 'deleted'
  }

  // 阶段超时处理
  if (!stageComplete) {
    const elapsedMin = Math.round(pollCount * POLL_INTERVAL_SEC / 60)

    if (autoYes) {
      mcp__ccw-tools__team_msg({
        operation: "log", team: teamName, from: "coordinator",
        to: "user", type: "error",
        summary: `[coordinator] [auto] 阶段 ${stageTask.subject} 超时 (${elapsedMin}min)，自动跳过`
      })
      TaskUpdate({ taskId: stageTask.id, status: 'deleted' })
      continue
    }

    const decision = AskUserQuestion({
      questions: [{
        question: `阶段 "${stageTask.subject}" 已等待 ${elapsedMin} 分钟仍未完成。如何处理？`,
        header: "Stage Wait",
        multiSelect: false,
        options: [
          { label: "继续等待", description: `再等 ${MAX_POLLS_PER_STAGE} 轮` },
          { label: "跳过此阶段", description: "标记为跳过，继续后续流水线" },
          { label: "终止流水线", description: "停止整个流程，汇报当前结果" }
        ]
      }]
    })

    const answer = decision["Stage Wait"]
    if (answer === "跳过此阶段") {
      TaskUpdate({ taskId: stageTask.id, status: 'deleted' })
      continue
    } else if (answer === "终止流水线") {
      mcp__ccw-tools__team_msg({
        operation: "log", team: teamName, from: "coordinator",
        to: "user", type: "shutdown",
        summary: `[coordinator] 用户终止流水线，当前阶段: ${stageTask.subject}`
      })
      break
    }
  }
}
```

### Step 2.1: Message Processing (processMessage)

```javascript
function processMessage(msg, handler) {
  switch (handler.special) {
    case 'quality_gate': {
      const latestMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))
      const debtBefore = latestMemory.debt_score_before || 0
      const debtAfter = latestMemory.debt_score_after || 0
      const improved = debtAfter < debtBefore

      let status = 'PASS'
      if (!improved && latestMemory.validation_results?.regressions > 0) status = 'FAIL'
      else if (!improved) status = 'CONDITIONAL'

      mcp__ccw-tools__team_msg({
        operation: "log", team: teamName, from: "coordinator",
        to: "user", type: "quality_gate",
        summary: `[coordinator] 质量门控: ${status} (债务分 ${debtBefore} → ${debtAfter})`
      })
      break
    }

    case 'fix_verify_decision': {
      const regressions = msg.data?.regressions || 0
      if (regressions > 0 && fixVerifyIteration < MAX_FIX_VERIFY_ITERATIONS) {
        fixVerifyIteration++
        mcp__ccw-tools__team_msg({
          operation: "log", team: teamName, from: "coordinator",
          to: "executor", type: "task_unblocked",
          summary: `[coordinator] Fix-Verify #${fixVerifyIteration}: 发现 ${regressions} 个回归，请修复`,
          data: { iteration: fixVerifyIteration, regressions }
        })
        // 创建 Fix-Verify 修复任务（参见 dispatch.md createFixVerifyTasks）
      } else {
        mcp__ccw-tools__team_msg({
          operation: "log", team: teamName, from: "coordinator",
          to: "user", type: "quality_gate",
          summary: `[coordinator] Fix-Verify 循环已达上限(${MAX_FIX_VERIFY_ITERATIONS})，接受当前结果`
        })
      }
      break
    }

    case 'error_handler': {
      const severity = msg.data?.severity || 'medium'
      if (severity === 'critical') {
        SendMessage({
          content: `## [coordinator] Critical Error from ${msg.from}\n\n${msg.summary}`,
          summary: `[coordinator] Critical error: ${msg.summary}`
        })
      }
      break
    }
  }
}
```

### Step 3: Result Processing

```javascript
// 汇总所有结果
const finalSharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))
const allFinalTasks = TaskList()
const workerTasks = allFinalTasks.filter(t => t.owner && t.owner !== 'coordinator')
const summary = {
  total_tasks: workerTasks.length,
  completed_tasks: workerTasks.filter(t => t.status === 'completed').length,
  fix_verify_iterations: fixVerifyIteration,
  debt_score_before: finalSharedMemory.debt_score_before,
  debt_score_after: finalSharedMemory.debt_score_after
}
```

## Output Format

```
## Coordination Summary

### Pipeline Status: COMPLETE
### Tasks: [completed]/[total]
### Fix-Verify Iterations: [count]
### Debt Score: [before] → [after]

### Message Log (last 10)
- [timestamp] [from] → [to]: [type] - [summary]
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Message bus unavailable | Fall back to TaskList polling only |
| Stage timeout (交互模式) | AskUserQuestion: 继续等待 / 跳过 / 终止 |
| Stage timeout (自动模式 `-y`/`--yes`) | 自动跳过，记录日志 |
| Teammate unresponsive (2x no response) | Respawn teammate with same task |
| Deadlock detected | Identify cycle, manually unblock |
| Quality gate FAIL | Report to user, suggest targeted re-run |
| Fix-Verify loop stuck >3 iterations | Accept current state, continue pipeline |
