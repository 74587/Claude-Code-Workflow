# Command: monitor

> 消息总线轮询与协调循环。持续监控 worker 进度，路由消息，触发 GC 循环，执行质量门控。

## When to Use

- Phase 4 of Coordinator
- 任务链已创建并分发
- 需要持续监控直到所有任务完成

**Trigger conditions**:
- dispatch 完成后立即启动
- GC 循环创建新任务后重新进入

## Strategy

### Delegation Mode

**Mode**: Direct（coordinator 直接轮询和路由）

### Decision Logic

```javascript
// 消息路由表
const routingTable = {
  // Scout 完成
  'scan_ready': {
    action: 'Mark SCOUT complete, unblock QASTRAT',
    next: 'strategist'
  },
  'issues_found': {
    action: 'Mark SCOUT complete with issues, unblock QASTRAT',
    next: 'strategist'
  },

  // Strategist 完成
  'strategy_ready': {
    action: 'Mark QASTRAT complete, unblock QAGEN',
    next: 'generator'
  },

  // Generator 完成
  'tests_generated': {
    action: 'Mark QAGEN complete, unblock QARUN',
    next: 'executor'
  },
  'tests_revised': {
    action: 'Mark QAGEN-fix complete, unblock QARUN-gc',
    next: 'executor'
  },

  // Executor 完成
  'tests_passed': {
    action: 'Mark QARUN complete, check coverage, unblock next',
    next: 'check_coverage'
  },
  'tests_failed': {
    action: 'Evaluate failures, decide GC loop or continue',
    next: 'gc_decision'
  },

  // Analyst 完成
  'analysis_ready': {
    action: 'Mark QAANA complete, evaluate quality gate',
    next: 'quality_gate'
  },
  'quality_report': {
    action: 'Quality report received, prepare final report',
    next: 'finalize'
  },

  // 错误
  'error': {
    action: 'Assess severity, retry or escalate',
    next: 'error_handler'
  }
}
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
```

### Step 2: Execute Strategy

```javascript
let allComplete = false

while (!allComplete) {
  // 1. Poll message bus
  const messages = mcp__ccw-tools__team_msg({
    operation: "list",
    team: teamName,
    last: 10
  })

  // 2. Route each unprocessed message
  for (const msg of messages) {
    const handler = routingTable[msg.type]
    if (!handler) continue

    switch (handler.next) {
      case 'check_coverage': {
        // 读取执行结果
        const coverage = msg.data?.coverage || 0
        const targetLayer = msg.data?.layer || 'L1'
        const target = coverageTargets[targetLayer] || 80

        if (coverage >= target) {
          // 覆盖率达标，继续流水线
          // 解锁下一个任务（QAANA 或下一层级）
        } else {
          // 转入 GC 决策
          handler.next = 'gc_decision'
        }
        break
      }

      case 'gc_decision': {
        const coverage = msg.data?.coverage || 0
        const targetLayer = msg.data?.layer || 'L1'

        if (gcIteration < MAX_GC_ITERATIONS) {
          gcIteration++
          // 触发 GC 循环
          mcp__ccw-tools__team_msg({
            operation: "log", team: teamName, from: "coordinator",
            to: "generator", type: "gc_loop_trigger",
            summary: `[coordinator] GC循环 #${gcIteration}: 覆盖率 ${coverage}% 未达标，请修复`,
            data: { iteration: gcIteration, layer: targetLayer, coverage }
          })

          // 创建 GC 修复任务（参见 dispatch.md createGCLoopTasks）
          // createGCLoopTasks(gcIteration, targetLayer, sessionFolder)
        } else {
          // 超过最大迭代次数，接受当前覆盖率
          mcp__ccw-tools__team_msg({
            operation: "log", team: teamName, from: "coordinator",
            to: "user", type: "quality_gate",
            summary: `[coordinator] GC循环已达上限(${MAX_GC_ITERATIONS})，接受当前覆盖率 ${coverage}%`
          })
          // 继续流水线，解锁 QAANA
        }
        break
      }

      case 'quality_gate': {
        const qualityScore = sharedMemory.quality_score || 0
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
        const fromRole = msg.from
        const severity = msg.data?.severity || 'medium'

        if (severity === 'critical') {
          // 通知用户
          SendMessage({
            content: `## [coordinator] Critical Error from ${fromRole}\n\n${msg.summary}`,
            summary: `[coordinator] Critical error: ${msg.summary}`
          })
        } else {
          // 标记任务失败，尝试重试
        }
        break
      }
    }
  }

  // 3. Check TaskList for overall completion
  const tasks = TaskList()
  const pendingWorkerTasks = tasks.filter(t =>
    t.owner !== 'coordinator' &&
    t.status !== 'completed' &&
    t.status !== 'deleted'
  )

  allComplete = pendingWorkerTasks.length === 0

  // 4. 如果没有完成，等待片刻再轮询
  if (!allComplete) {
    // 短暂等待（在实际执行中 coordinator 会在 subagent 返回后继续）
  }
}
```

### Step 3: Result Processing

```javascript
// 汇总所有结果
const finalSharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`))
const summary = {
  total_tasks: TaskList().filter(t => t.owner !== 'coordinator').length,
  completed_tasks: TaskList().filter(t => t.status === 'completed' && t.owner !== 'coordinator').length,
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
| Teammate unresponsive (2x no response) | Respawn teammate with same task |
| Deadlock detected (tasks blocked indefinitely) | Identify cycle, manually unblock |
| Quality gate FAIL | Report to user, suggest targeted re-run |
| Agent/CLI failure | Retry once, then fallback to inline execution |
| Timeout (>5 min) | Report partial results, notify coordinator |
