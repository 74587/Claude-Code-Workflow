# Command: monitor

> 阶段驱动的协调循环。按 pipeline 阶段顺序等待 worker 完成，路由消息，触发 GC 循环，执行质量门控。

## When to Use

- Phase 4 of Coordinator
- 任务链已创建并分发
- 需要持续监控直到所有任务完成

**Trigger conditions**:
- dispatch 完成后立即启动
- GC 循环创建新任务后重新进入

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
  // Scout 完成
  'scan_ready':      { action: 'Mark SCOUT complete, unblock QASTRAT' },
  'issues_found':    { action: 'Mark SCOUT complete with issues, unblock QASTRAT' },
  // Strategist 完成
  'strategy_ready':  { action: 'Mark QASTRAT complete, unblock QAGEN' },
  // Generator 完成
  'tests_generated': { action: 'Mark QAGEN complete, unblock QARUN' },
  'tests_revised':   { action: 'Mark QAGEN-fix complete, unblock QARUN-gc' },
  // Executor 完成
  'tests_passed':    { action: 'Mark QARUN complete, check coverage, unblock next', special: 'check_coverage' },
  'tests_failed':    { action: 'Evaluate failures, decide GC loop or continue', special: 'gc_decision' },
  // Analyst 完成
  'analysis_ready':  { action: 'Mark QAANA complete, evaluate quality gate', special: 'quality_gate' },
  'quality_report':  { action: 'Quality report received, prepare final report', special: 'finalize' },
  // 错误
  'error':           { action: 'Assess severity, retry or escalate', special: 'error_handler' }
}
```

### 等待策略常量

```javascript
const POLL_INTERVAL_SEC = 300  // 每次检查间隔 5 分钟（测试执行可能很慢）
const MAX_POLLS_PER_STAGE = 6  // 单阶段最多等待 6 次（~30 分钟）
const SLEEP_CMD = process.platform === 'win32'
  ? `timeout /t ${POLL_INTERVAL_SEC} /nobreak >nul 2>&1`
  : `sleep ${POLL_INTERVAL_SEC}`

// ★ 统一 auto mode 检测：-y/--yes 从 $ARGUMENTS 或 ccw 传播
const autoYes = /\b(-y|--yes)\b/.test(args)
```

## Execution Steps

### Step 1: Context Preparation

```javascript
// 从 shared memory 获取覆盖率目标
const sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))
const strategy = sharedMemory.test_strategy || {}
const coverageTargets = {}
for (const layer of (strategy.layers || [])) {
  coverageTargets[layer.level] = layer.target_coverage
}

let gcIteration = 0
const MAX_GC_ITERATIONS = 3

// 获取 pipeline 阶段列表（来自 dispatch 创建的任务链）
const allTasks = TaskList()
const pipelineTasks = allTasks
  .filter(t => t.owner && t.owner !== 'coordinator')
  .sort((a, b) => Number(a.id) - Number(b.id))
```

### Step 2: Stage-Driven Execution

> **核心改动**: 不再使用 while 轮询循环。按 pipeline 阶段顺序，逐阶段等待完成。
> 每个阶段：sleep → 检查消息 → 确认任务状态 → 处理结果 → 下一阶段。

```javascript
// 按依赖顺序处理每个阶段
for (const stageTask of pipelineTasks) {
  // --- 等待当前阶段完成 ---
  let stageComplete = false
  let pollCount = 0

  while (!stageComplete && pollCount < MAX_POLLS_PER_STAGE) {
    // ★ 固定等待：sleep 30s，让 worker 有执行时间
    Bash(SLEEP_CMD)
    pollCount++

    // 1. 检查消息总线（主要信号源）
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

    // 3. 确认任务状态（兜底）
    const currentTask = TaskGet({ taskId: stageTask.id })
    stageComplete = currentTask.status === 'completed' || currentTask.status === 'deleted'
  }

  // --- 阶段超时处理 ---
  if (!stageComplete) {
    const elapsedMin = Math.round(pollCount * POLL_INTERVAL_SEC / 60)

    if (autoYes) {
      // 自动模式：记录日志，自动跳过
      mcp__ccw-tools__team_msg({
        operation: "log", team: teamName, from: "coordinator",
        to: "user", type: "error",
        summary: `[coordinator] [auto] 阶段 ${stageTask.subject} 超时 (${elapsedMin}min)，自动跳过`
      })
      TaskUpdate({ taskId: stageTask.id, status: 'deleted' })
      continue
    }

    // 交互模式：由用户决定
    const decision = AskUserQuestion({
      questions: [{
        question: `阶段 "${stageTask.subject}" 已等待 ${elapsedMin} 分钟仍未完成。如何处理？`,
        header: "Stage Wait",
        multiSelect: false,
        options: [
          { label: "继续等待", description: `再等 ${MAX_POLLS_PER_STAGE} 轮（~${Math.round(MAX_POLLS_PER_STAGE * POLL_INTERVAL_SEC / 60)}min）` },
          { label: "跳过此阶段", description: "标记为跳过，继续后续流水线" },
          { label: "终止流水线", description: "停止整个 QA 流程，汇报当前结果" }
        ]
      }]
    })

    const answer = decision["Stage Wait"]

    if (answer === "继续等待") {
      // 重置计数器，继续等待当前阶段
      pollCount = 0
      // 重新进入当前阶段的等待循环（需要用 while 包裹，此处用 goto 语义）
      continue // 注意：实际执行中需要将 for 改为可重入的逻辑
    } else if (answer === "跳过此阶段") {
      mcp__ccw-tools__team_msg({
        operation: "log", team: teamName, from: "coordinator",
        to: "user", type: "error",
        summary: `[coordinator] 用户选择跳过阶段 ${stageTask.subject}`
      })
      TaskUpdate({ taskId: stageTask.id, status: 'deleted' })
      continue
    } else {
      // 终止流水线
      mcp__ccw-tools__team_msg({
        operation: "log", team: teamName, from: "coordinator",
        to: "user", type: "shutdown",
        summary: `[coordinator] 用户终止流水线，当前阶段: ${stageTask.subject}`
      })
      break // 跳出 for 循环，进入 Step 3 汇报
    }
  }
}
```

### Step 2.1: Message Processing (processMessage)

```javascript
function processMessage(msg, handler) {
  switch (handler.special) {
    case 'check_coverage': {
      const coverage = msg.data?.coverage || 0
      const targetLayer = msg.data?.layer || 'L1'
      const target = coverageTargets[targetLayer] || 80

      if (coverage < target) {
        handleGCDecision(coverage, targetLayer)
      }
      // 覆盖率达标则不做额外处理，流水线自然流转
      break
    }

    case 'gc_decision': {
      const coverage = msg.data?.coverage || 0
      const targetLayer = msg.data?.layer || 'L1'
      handleGCDecision(coverage, targetLayer)
      break
    }

    case 'quality_gate': {
      // 重新读取最新 shared memory
      const latestMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))
      const qualityScore = latestMemory.quality_score || 0
      let status = 'PASS'
      if (qualityScore < 60) status = 'FAIL'
      else if (qualityScore < 80) status = 'CONDITIONAL'

      mcp__ccw-tools__team_msg({
        operation: "log", team: teamName, from: "coordinator",
        to: "user", type: "quality_gate",
        summary: `[coordinator] 质量门控: ${status} (score: ${qualityScore})`
      })
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

function handleGCDecision(coverage, targetLayer) {
  if (gcIteration < MAX_GC_ITERATIONS) {
    gcIteration++
    mcp__ccw-tools__team_msg({
      operation: "log", team: teamName, from: "coordinator",
      to: "generator", type: "gc_loop_trigger",
      summary: `[coordinator] GC循环 #${gcIteration}: 覆盖率 ${coverage}% 未达标，请修复`,
      data: { iteration: gcIteration, layer: targetLayer, coverage }
    })
    // 创建 GC 修复任务（参见 dispatch.md createGCLoopTasks）
  } else {
    mcp__ccw-tools__team_msg({
      operation: "log", team: teamName, from: "coordinator",
      to: "user", type: "quality_gate",
      summary: `[coordinator] GC循环已达上限(${MAX_GC_ITERATIONS})，接受当前覆盖率 ${coverage}%`
    })
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
  gc_iterations: gcIteration,
  quality_score: finalSharedMemory.quality_score,
  coverage: finalSharedMemory.execution_results?.coverage
}
```

## Output Format

```
## Coordination Summary

### Pipeline Status: COMPLETE
### Tasks: [completed]/[total]
### GC Iterations: [count]
### Quality Score: [score]/100
### Coverage: [percent]%

### Message Log (last 10)
- [timestamp] [from] → [to]: [type] - [summary]
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Message bus unavailable | Fall back to TaskList polling only |
| Stage timeout (交互模式) | AskUserQuestion：继续等待 / 跳过 / 终止流水线 |
| Stage timeout (自动模式 `-y`/`--yes`，`autoYes`) | 自动跳过，记录日志，继续流水线 |
| Teammate unresponsive (2x no response) | Respawn teammate with same task |
| Deadlock detected (tasks blocked indefinitely) | Identify cycle, manually unblock |
| Quality gate FAIL | Report to user, suggest targeted re-run |
| GC loop stuck >3 iterations | Accept current coverage, continue pipeline |
