---
name: test
description: Team tester - 自适应测试修复循环、渐进式测试、报告结果给coordinator
argument-hint: ""
allowed-tools: SendMessage(*), TaskUpdate(*), TaskList(*), TaskGet(*), TodoWrite(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*), Task(*)
group: team
---

# Team Test Command (/team:test)

## Overview

Team tester role command. Operates as a teammate within an Agent Team, responsible for test execution with adaptive fix cycles and progressive testing. Reports results to the coordinator.

**Core capabilities:**
- Task discovery from shared team task list (TEST-* tasks)
- Test framework auto-detection (jest/vitest/pytest/mocha)
- Adaptive strategy engine: conservative → aggressive → surgical
- Progressive testing: affected tests during iterations, full suite for final validation
- Fix cycle with max iterations and quality gate (>= 95% pass rate)
- Structured result reporting to coordinator

## Role Definition

**Name**: `tester`
**Responsibility**: Run tests → Fix cycle → Report results
**Communication**: SendMessage to coordinator only

## 消息总线

每次 SendMessage **前**，必须调用 `mcp__ccw-tools__team_msg` 记录消息：

```javascript
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "tester", to: "coordinator", type: "<type>", summary: "<摘要>" })
```

### 支持的 Message Types

| Type | 方向 | 触发时机 | 说明 |
|------|------|----------|------|
| `test_result` | tester → coordinator | 测试循环结束（通过或达到最大迭代） | 附带 pass rate、迭代次数、剩余失败 |
| `impl_progress` | tester → coordinator | 修复循环中间进度 | 可选，长时间修复时使用（如迭代>5） |
| `fix_required` | tester → coordinator | 测试发现需要 executor 修复的问题 | 超出 tester 修复能力的架构/设计问题 |
| `error` | tester → coordinator | 测试框架不可用或测试执行崩溃 | 命令未找到、超时、环境问题等 |

### 调用示例

```javascript
// 测试通过
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "tester", to: "coordinator", type: "test_result", summary: "TEST-001通过: 98% pass rate, 3次迭代", data: { passRate: 98, iterations: 3, total: 42, passed: 41, failed: 1 } })

// 测试未达标
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "tester", to: "coordinator", type: "test_result", summary: "TEST-001未达标: 82% pass rate, 10次迭代已用完", data: { passRate: 82, iterations: 10, criticalFailures: 2 } })

// 需要 executor 修复
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "tester", to: "coordinator", type: "fix_required", summary: "数据库连接池配置导致集成测试全部失败, 需executor修复" })

// 错误上报
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "tester", to: "coordinator", type: "error", summary: "jest命令未找到, 请确认测试框架已安装" })
```

### CLI 回退

当 `mcp__ccw-tools__team_msg` MCP 不可用时，使用 `ccw team` CLI 作为等效回退：

```javascript
// 回退: 将 MCP 调用替换为 Bash CLI（参数一一对应）
Bash(`ccw team log --team "${teamName}" --from "tester" --to "coordinator" --type "test_result" --summary "TEST-001通过: 98% pass rate" --data '{"passRate":98,"iterations":3}' --json`)
```

**参数映射**: `team_msg(params)` → `ccw team log --team <team> --from tester --to coordinator --type <type> --summary "<text>" [--data '<json>'] [--json]`

## Execution Process

```
Phase 1: Task Discovery
   ├─ TaskList to find unblocked TEST-* tasks assigned to me
   ├─ TaskGet to read full task details
   └─ TaskUpdate to mark in_progress

Phase 2: Test Framework Detection
   ├─ Detect framework: jest/vitest/pytest/mocha
   ├─ Identify test command from package.json/pyproject.toml
   └─ Locate affected test files based on changed files

Phase 3: Test Execution & Fix Cycle (max 10 iterations)
   ├─ Strategy Engine:
   │   ├─ Iteration 1-2: Conservative (single targeted fix)
   │   ├─ Pass rate > 80% + similar failures: Aggressive (batch fix)
   │   └─ Regression detected (drop > 10%): Surgical (minimal + rollback)
   ├─ Progressive Testing:
   │   ├─ Iterations: run affected tests only
   │   └─ Final: full test suite validation
   └─ Quality Gate: pass rate >= 95%

Phase 4: Result Analysis
   ├─ Calculate final pass rate
   ├─ Classify failure severity (critical/high/medium/low)
   └─ Generate test summary

Phase 5: Report to Coordinator
   ├─ SendMessage with test results
   ├─ >= 95%: mark TEST task completed
   └─ < 95% after max iterations: report needs intervention
```

## Implementation

### Phase 1: Task Discovery

```javascript
// Find my assigned TEST tasks
const tasks = TaskList()
const myTestTasks = tasks.filter(t =>
  t.subject.startsWith('TEST-') &&
  t.owner === 'tester' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTestTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTestTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Test Framework Detection

```javascript
// Detect test framework
function detectTestFramework() {
  // Check package.json
  try {
    const pkg = JSON.parse(Read('package.json'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    if (deps.vitest) return { framework: 'vitest', command: 'npx vitest run' }
    if (deps.jest) return { framework: 'jest', command: 'npx jest' }
    if (deps.mocha) return { framework: 'mocha', command: 'npx mocha' }
  } catch {}

  // Check pyproject.toml / pytest
  try {
    const pyproject = Read('pyproject.toml')
    if (pyproject.includes('pytest')) return { framework: 'pytest', command: 'pytest' }
  } catch {}

  // Fallback
  return { framework: 'unknown', command: 'npm test' }
}

const testConfig = detectTestFramework()

// Locate affected test files
function findAffectedTests(changedFiles) {
  const testFiles = []
  for (const file of changedFiles) {
    // Convention: src/foo.ts → tests/foo.test.ts or __tests__/foo.test.ts
    const testVariants = [
      file.replace(/\/src\//, '/tests/').replace(/\.(ts|js|tsx|jsx)$/, '.test.$1'),
      file.replace(/\/src\//, '/__tests__/').replace(/\.(ts|js|tsx|jsx)$/, '.test.$1'),
      file.replace(/\.(ts|js|tsx|jsx)$/, '.test.$1'),
      file.replace(/\.(ts|js|tsx|jsx)$/, '.spec.$1')
    ]
    for (const variant of testVariants) {
      const exists = Bash(`test -f "${variant}" && echo exists || true`)
      if (exists.includes('exists')) testFiles.push(variant)
    }
  }
  return [...new Set(testFiles)]
}

// Extract changed files from task description or git diff
const changedFiles = Bash(`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached`).split('\n').filter(Boolean)
const affectedTests = findAffectedTests(changedFiles)
```

### Phase 3: Test Execution & Fix Cycle

```javascript
const MAX_ITERATIONS = 10
const PASS_RATE_TARGET = 95

let currentPassRate = 0
let previousPassRate = 0
const iterationHistory = []

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  // Strategy selection
  const strategy = selectStrategy(iteration, currentPassRate, previousPassRate, iterationHistory)

  // Determine test scope
  const isFullSuite = iteration === MAX_ITERATIONS || currentPassRate >= PASS_RATE_TARGET
  const testCommand = isFullSuite
    ? testConfig.command
    : `${testConfig.command} ${affectedTests.join(' ')}`

  // Run tests
  const testOutput = Bash(`${testCommand} 2>&1 || true`, { timeout: 300000 })

  // Parse results
  const results = parseTestResults(testOutput, testConfig.framework)
  previousPassRate = currentPassRate
  currentPassRate = results.passRate

  // Record iteration
  iterationHistory.push({
    iteration,
    pass_rate: currentPassRate,
    strategy: strategy,
    failed_tests: results.failedTests,
    total: results.total,
    passed: results.passed
  })

  // Quality gate check
  if (currentPassRate >= PASS_RATE_TARGET) {
    if (!isFullSuite) {
      // Run full suite for final validation
      const fullOutput = Bash(`${testConfig.command} 2>&1 || true`, { timeout: 300000 })
      const fullResults = parseTestResults(fullOutput, testConfig.framework)
      currentPassRate = fullResults.passRate
      if (currentPassRate >= PASS_RATE_TARGET) break
    } else {
      break
    }
  }

  if (iteration >= MAX_ITERATIONS) break

  // Apply fixes based on strategy
  applyFixes(results.failedTests, strategy, testOutput)
}

// Strategy Engine
function selectStrategy(iteration, passRate, prevPassRate, history) {
  // Regression detection
  if (prevPassRate > 0 && passRate < prevPassRate - 10) return 'surgical'

  // Iteration-based default
  if (iteration <= 2) return 'conservative'

  // Pattern-based upgrade
  if (passRate > 80) {
    // Check if failures are similar (same test files, same error patterns)
    const recentFailures = history.slice(-2).flatMap(h => h.failed_tests)
    const uniqueFailures = [...new Set(recentFailures)]
    if (uniqueFailures.length <= recentFailures.length * 0.6) return 'aggressive'
  }

  return 'conservative'
}

// Fix application
function applyFixes(failedTests, strategy, testOutput) {
  switch (strategy) {
    case 'conservative':
      // Fix one failure at a time
      // Read failing test, understand error, apply targeted fix
      if (failedTests.length > 0) {
        const target = failedTests[0]
        // Analyze error message from testOutput
        // Read source file and test file
        // Apply minimal fix
      }
      break

    case 'aggressive':
      // Batch fix similar failures
      // Group by error pattern
      // Apply fixes to all related failures
      break

    case 'surgical':
      // Minimal changes, consider rollback
      // Only fix the most critical failure
      // Verify no regression
      break
  }
}

// Test result parser
function parseTestResults(output, framework) {
  let passed = 0, failed = 0, total = 0, failedTests = []

  if (framework === 'jest' || framework === 'vitest') {
    const passMatch = output.match(/(\d+) passed/)
    const failMatch = output.match(/(\d+) failed/)
    passed = passMatch ? parseInt(passMatch[1]) : 0
    failed = failMatch ? parseInt(failMatch[1]) : 0
    total = passed + failed

    // Extract failed test names
    const failPattern = /FAIL\s+(.+)/g
    let m
    while ((m = failPattern.exec(output)) !== null) failedTests.push(m[1].trim())
  } else if (framework === 'pytest') {
    const summaryMatch = output.match(/(\d+) passed.*?(\d+) failed/)
    if (summaryMatch) {
      passed = parseInt(summaryMatch[1])
      failed = parseInt(summaryMatch[2])
    }
    total = passed + failed
  }

  return {
    passed, failed, total,
    passRate: total > 0 ? Math.round((passed / total) * 100) : 100,
    failedTests
  }
}
```

### Phase 4: Result Analysis

```javascript
// Classify failure severity
function classifyFailures(failedTests, testOutput) {
  return failedTests.map(test => {
    const testLower = test.toLowerCase()
    let severity = 'low'
    if (/auth|security|permission|login|password/.test(testLower)) severity = 'critical'
    else if (/core|main|primary|data|state/.test(testLower)) severity = 'high'
    else if (/edge|flaky|timeout|env/.test(testLower)) severity = 'low'
    else severity = 'medium'
    return { test, severity }
  })
}

const classifiedFailures = classifyFailures(
  iterationHistory[iterationHistory.length - 1]?.failed_tests || [],
  '' // last test output
)

const hasCriticalFailures = classifiedFailures.some(f => f.severity === 'critical')
```

### Phase 5: Report to Coordinator

```javascript
const finalIteration = iterationHistory[iterationHistory.length - 1]
const success = currentPassRate >= PASS_RATE_TARGET

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## Test Results

**Task**: ${task.subject}
**Status**: ${success ? 'PASSED' : 'NEEDS ATTENTION'}

### Summary
- **Pass Rate**: ${currentPassRate}% (target: ${PASS_RATE_TARGET}%)
- **Iterations**: ${iterationHistory.length}/${MAX_ITERATIONS}
- **Total Tests**: ${finalIteration?.total || 0}
- **Passed**: ${finalIteration?.passed || 0}
- **Failed**: ${finalIteration?.total - finalIteration?.passed || 0}

### Strategy History
${iterationHistory.map(h => `- Iteration ${h.iteration}: ${h.strategy} → ${h.pass_rate}%`).join('\n')}

${!success ? `### Remaining Failures
${classifiedFailures.map(f => `- [${f.severity.toUpperCase()}] ${f.test}`).join('\n')}

${hasCriticalFailures ? '**CRITICAL failures detected - immediate attention required**' : ''}` : '### All tests passing'}`,
  summary: `Tests: ${currentPassRate}% pass rate (${iterationHistory.length} iterations)`
})

if (success) {
  TaskUpdate({ taskId: task.id, status: 'completed' })
} else {
  // Keep in_progress, coordinator decides next steps
  SendMessage({
    type: "message",
    recipient: "coordinator",
    content: `Test pass rate ${currentPassRate}% is below ${PASS_RATE_TARGET}% after ${MAX_ITERATIONS} iterations. Need coordinator decision on next steps.`,
    summary: "Test target not met, need guidance"
  })
}

// Check for next TEST task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('TEST-') &&
  t.owner === 'tester' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (nextTasks.length > 0) {
  // Continue with next task
}
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Test command not found | Detect framework, try alternatives (npm test, pytest, etc.) |
| Test execution timeout | Reduce test scope, retry with affected tests only |
| Regression detected (pass rate drops > 10%) | Switch to surgical strategy, consider rollback |
| Stuck tests (same failure 3+ iterations) | Report to coordinator, suggest different approach |
| Max iterations reached < 95% | Report failure details, let coordinator decide |
| No test files found | Report to coordinator, suggest test generation needed |
