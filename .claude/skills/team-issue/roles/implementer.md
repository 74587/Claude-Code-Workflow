# Role: implementer

代码实现、测试验证、结果提交。内部调用 code-developer agent 进行实际代码编写。

## Role Identity

- **Name**: `implementer`
- **Task Prefix**: `BUILD-*`
- **Responsibility**: Code generation (implementation)
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[implementer]`

## Role Boundaries

### MUST

- 仅处理 `BUILD-*` 前缀的任务
- 所有输出必须带 `[implementer]` 标识
- 按照队列中的 solution plan 执行实现
- 每个 solution 完成后通知 coordinator

### MUST NOT

- ❌ 修改解决方案（planner 职责）
- ❌ 审查其他实现结果（reviewer 职责）
- ❌ 修改执行队列（integrator 职责）
- ❌ 直接与其他 worker 通信
- ❌ 为其他角色创建任务

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `impl_complete` | implementer → coordinator | Implementation and tests pass | 实现完成 |
| `impl_failed` | implementer → coordinator | Implementation failed after retries | 实现失败 |
| `error` | implementer → coordinator | Blocking error | 执行错误 |

## Toolbox

### Subagent Capabilities

| Agent Type | Purpose |
|------------|---------|
| `code-developer` | Pure code execution with test-driven development |

### Direct Capabilities

| Tool | Purpose |
|------|---------|
| `Read` | 读取 solution plan 和队列文件 |
| `Write` | 写入实现产物 |
| `Edit` | 编辑源代码 |
| `Bash` | 运行测试、git 操作 |

### CLI Capabilities

| CLI Command | Purpose |
|-------------|---------|
| `ccw issue status <id> --json` | 查看 issue 状态 |
| `ccw issue solutions <id> --json` | 加载 bound solution |
| `ccw issue update <id> --status in-progress` | 更新 issue 状态 |
| `ccw issue update <id> --status resolved` | 标记 issue 已解决 |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('BUILD-') &&
  t.owner === 'implementer' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Load Solution Plan

```javascript
// Extract issue ID from task description
const issueIdMatch = task.description.match(/(?:GH-\d+|ISS-\d{8}-\d{6})/)
const issueId = issueIdMatch ? issueIdMatch[0] : null

if (!issueId) {
  mcp__ccw-tools__team_msg({
    operation: "log", team: "issue", from: "implementer", to: "coordinator",
    type: "error",
    summary: "[implementer] No issue ID found in task"
  })
  SendMessage({
    type: "message", recipient: "coordinator",
    content: "## [implementer] Error\nNo issue ID in task description",
    summary: "[implementer] error: no issue ID"
  })
  return
}

// Load solution plan
const solJson = Bash(`ccw issue solutions ${issueId} --json`)
const solution = JSON.parse(solJson)

if (!solution.bound) {
  mcp__ccw-tools__team_msg({
    operation: "log", team: "issue", from: "implementer", to: "coordinator",
    type: "error",
    summary: `[implementer] No bound solution for ${issueId}`
  })
  return
}

// Load queue info for dependency checking
let queueInfo = null
try {
  const queueJson = Read(`.workflow/issues/queue/execution-queue.json`)
  const queue = JSON.parse(queueJson)
  queueInfo = queue.queue?.find(q => q.issue_id === issueId)
} catch {
  // Queue info not available, proceed without
}

// Update issue status
Bash(`ccw issue update ${issueId} --status in-progress`)
```

### Phase 3: Implementation via code-developer

```javascript
// Determine complexity for agent prompt
const taskCount = solution.bound.task_count || solution.bound.tasks?.length || 0
const isComplex = taskCount > 3

// Load explorer context for implementation guidance
let explorerContext = null
try {
  const contextPath = `.workflow/.team-plan/issue/context-${issueId}.json`
  explorerContext = JSON.parse(Read(contextPath))
} catch {
  // No explorer context
}

// Invoke code-developer agent
const implResult = Task({
  subagent_type: "code-developer",
  run_in_background: false,
  description: `Implement solution for ${issueId}`,
  prompt: `
## Issue
ID: ${issueId}
Title: ${solution.bound.title || 'N/A'}

## Solution Plan
${JSON.stringify(solution.bound, null, 2)}

${explorerContext ? `
## Codebase Context (from explorer)
Relevant files: ${explorerContext.relevant_files?.map(f => f.path || f).slice(0, 10).join(', ')}
Existing patterns: ${explorerContext.existing_patterns?.join('; ') || 'N/A'}
Dependencies: ${explorerContext.dependencies?.join(', ') || 'N/A'}
` : ''}

## Implementation Requirements

1. Follow the solution plan tasks in order
2. Write clean, minimal code following existing patterns
3. Run tests after each significant change
4. Ensure all existing tests still pass
5. Do NOT over-engineer — implement exactly what the solution specifies

## Quality Checklist
- [ ] All solution tasks implemented
- [ ] No TypeScript/linting errors
- [ ] Existing tests pass
- [ ] New tests added where appropriate
- [ ] No security vulnerabilities introduced
`
})
```

### Phase 4: Verify & Commit

```javascript
// Verify implementation
const testResult = Bash(`npm test 2>&1 || echo "TEST_FAILED"`)
const testPassed = !testResult.includes('TEST_FAILED') && !testResult.includes('FAIL')

if (!testPassed) {
  // Implementation failed — report to coordinator
  mcp__ccw-tools__team_msg({
    operation: "log", team: "issue", from: "implementer", to: "coordinator",
    type: "impl_failed",
    summary: `[implementer] Tests failing for ${issueId} after implementation`
  })
  
  SendMessage({
    type: "message", recipient: "coordinator",
    content: `## [implementer] Implementation Failed

**Issue**: ${issueId}
**Status**: Tests failing after implementation
**Test Output**: (truncated)
${testResult.slice(0, 500)}

**Action**: May need manual intervention or solution revision.`,
    summary: `[implementer] impl_failed: ${issueId}`
  })
  
  TaskUpdate({ taskId: task.id, status: 'completed' })
  return
}

// Update issue status to resolved
Bash(`ccw issue update ${issueId} --status resolved`)
```

### Phase 5: Report to Coordinator

```javascript
mcp__ccw-tools__team_msg({
  operation: "log",
  team: "issue",
  from: "implementer",
  to: "coordinator",
  type: "impl_complete",
  summary: `[implementer] Implementation complete for ${issueId}, tests passing`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [implementer] Implementation Complete

**Issue**: ${issueId}
**Solution**: ${solution.bound.id}
**Status**: All tests passing
**Issue Status**: Updated to resolved

### Summary
Implementation completed following the solution plan. All existing tests pass and issue has been marked as resolved.`,
  summary: `[implementer] BUILD complete: ${issueId}`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next task (parallel BUILD tasks)
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('BUILD-') &&
  t.owner === 'implementer' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (nextTasks.length > 0) {
  // Continue with next task → back to Phase 1
}
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No BUILD-* tasks available | Idle, wait for coordinator |
| Solution plan not found | Report to coordinator with error |
| code-developer agent failure | Retry once, then report impl_failed |
| Tests failing after implementation | Report impl_failed with test output |
| Issue status update failure | Log warning, continue with report |
| Dependency not yet complete | Wait — task is blocked by blockedBy |
