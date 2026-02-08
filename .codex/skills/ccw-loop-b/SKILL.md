---
name: ccw-loop-b
description: Hybrid orchestrator pattern for iterative development. Coordinator + specialized workers with batch wait, parallel split, and two-phase clarification. Triggers on "ccw-loop-b".
allowed-tools: spawn_agent, wait, send_input, close_agent, AskUserQuestion, Read, Write, Edit, Bash, Glob, Grep
---

# CCW Loop-B - Hybrid Orchestrator Pattern

协调器 + 专用 worker 的迭代开发工作流。支持三种执行模式（Interactive / Auto / Parallel），每个 action 由独立 worker agent 执行，协调器负责调度、状态管理和结果汇聚。

## Architecture Overview

```
+------------------------------------------------------------+
|                    Main Coordinator                         |
|  职责: 状态管理 + worker 调度 + 结果汇聚 + 用户交互        |
+------------------------------------------------------------+
          |                    |                    |
          v                    v                    v
+----------------+   +----------------+   +----------------+
| Worker-Develop |   | Worker-Debug   |   | Worker-Validate|
| 专注: 代码实现 |   | 专注: 问题诊断 |   | 专注: 测试验证 |
+----------------+   +----------------+   +----------------+
          |                    |                    |
          v                    v                    v
   .workers/              .workers/             .workers/
   develop.output.json    debug.output.json     validate.output.json
```

### Subagent API

| API | 作用 | 注意事项 |
|-----|------|----------|
| `spawn_agent({ message })` | 创建 worker，返回 `agent_id` | 首条 message 加载角色 |
| `wait({ ids, timeout_ms })` | 等待结果 | **唯一取结果入口**，非 close |
| `send_input({ id, message })` | 继续交互/追问 | `interrupt=true` 慎用 |
| `close_agent({ id })` | 关闭回收 | 不可逆，确认不再交互后才关闭 |

## Key Design Principles

1. **协调器保持轻量**: 只做调度和状态管理，具体工作交给 worker
2. **Worker 职责单一**: 每个 worker 专注一个领域（develop/debug/validate）
3. **角色路径传递**: Worker 自己读取角色文件，主流程不传递内容
4. **延迟 close_agent**: 确认不再需要交互后才关闭 worker
5. **两阶段工作流**: 复杂任务先澄清后执行，减少返工
6. **批量等待优化**: 并行模式用 `wait({ ids: [...] })` 批量等待
7. **结果标准化**: Worker 输出遵循统一 WORKER_RESULT 格式
8. **灵活模式切换**: 根据任务复杂度选择 interactive/auto/parallel

## Arguments

| Arg | Required | Description |
|-----|----------|-------------|
| TASK | One of TASK or --loop-id | Task description (for new loop) |
| --loop-id | One of TASK or --loop-id | Existing loop ID to continue |
| --mode | No | `interactive` (default) / `auto` / `parallel` |

## Execution Modes

### Mode: Interactive (default)

协调器展示菜单，用户选择 action，spawn 对应 worker 执行。

```
Coordinator -> Show menu -> User selects -> spawn worker -> wait -> Display result -> Loop
```

### Mode: Auto

自动按预设顺序执行，worker 完成后协调器决定下一步。

```
Init -> Develop -> [if issues] Debug -> Validate -> [if fail] Loop back -> Complete
```

### Mode: Parallel

并行 spawn 多个 worker，batch wait 汇聚结果，协调器综合决策。

```
Coordinator -> spawn [develop, debug, validate] in parallel -> wait({ ids: all }) -> Merge -> Decide
```

## Execution Flow

```
Input Parsing:
   └─ Parse arguments (TASK | --loop-id + --mode)
   └─ Convert to structured context (loopId, state, mode)

Phase 1: Session Initialization
   └─ Ref: phases/01-session-init.md
      ├─ Create new loop OR resume existing loop
      ├─ Initialize state file and directory structure
      └─ Output: loopId, state, progressDir, mode

Phase 2: Orchestration Loop
   └─ Ref: phases/02-orchestration-loop.md
      ├─ Mode dispatch: interactive / auto / parallel
      ├─ Worker spawn with structured prompt (Goal/Scope/Context/Deliverables)
      ├─ Wait + timeout handling + result parsing
      ├─ State update per iteration
      └─ close_agent on loop exit
```

**Phase Reference Documents** (read on-demand when phase executes):

| Phase | Document | Purpose |
|-------|----------|---------|
| 1 | [phases/01-session-init.md](phases/01-session-init.md) | Argument parsing, state creation/resume, directory init |
| 2 | [phases/02-orchestration-loop.md](phases/02-orchestration-loop.md) | 3-mode orchestration, worker spawn, batch wait, result merge |

## Data Flow

```
User Input (TASK | --loop-id + --mode)
    ↓
[Parse Arguments]
    ↓ loopId, state, mode

Phase 1: Session Initialization
    ↓ loopId, state (initialized/resumed), progressDir

Phase 2: Orchestration Loop
    ↓
    ┌─── Interactive Mode ──────────────────────────────────┐
    │ showMenu → user selects → spawn worker → wait →       │
    │ parseResult → updateState → close worker → loop       │
    └───────────────────────────────────────────────────────┘
    ┌─── Auto Mode ─────────────────────────────────────────┐
    │ selectNext → spawn worker → wait → parseResult →      │
    │ updateState → close worker → [loop_back?] → next      │
    └───────────────────────────────────────────────────────┘
    ┌─── Parallel Mode ─────────────────────────────────────┐
    │ spawn [develop, debug, validate] → batch wait →       │
    │ mergeOutputs → coordinator decides → close all        │
    └───────────────────────────────────────────────────────┘
    ↓
return finalState
```

## Session Structure

```
{projectRoot}/.workflow/.loop/
├── {loopId}.json                    # Master state (API + Skill shared)
├── {loopId}.workers/                # Worker structured outputs
│   ├── init.output.json
│   ├── develop.output.json
│   ├── debug.output.json
│   ├── validate.output.json
│   └── complete.output.json
└── {loopId}.progress/               # Human-readable progress
    ├── develop.md
    ├── debug.md
    ├── validate.md
    └── summary.md
```

## State Management

Master state file: `{projectRoot}/.workflow/.loop/{loopId}.json`

```json
{
  "loop_id": "loop-b-20260122-abc123",
  "title": "Task title",
  "description": "Full task description",
  "mode": "interactive | auto | parallel",
  "status": "running | paused | completed | failed",
  "current_iteration": 0,
  "max_iterations": 10,
  "created_at": "ISO8601",
  "updated_at": "ISO8601",

  "skill_state": {
    "phase": "init | develop | debug | validate | complete",
    "action_index": 0,
    "workers_completed": [],
    "parallel_results": null,
    "pending_tasks": [],
    "completed_tasks": [],
    "findings": []
  }
}
```

**Control Signal Checking**: 协调器在每次 spawn worker 前检查 `state.status`:
- `running` → continue
- `paused` → exit gracefully, wait for resume
- `failed` → terminate

**Recovery**: If state corrupted, rebuild from `.progress/` markdown files and `.workers/*.output.json`.

## Worker Catalog

| Worker | Role File | Purpose | Output Files |
|--------|-----------|---------|--------------|
| [init](workers/worker-init.md) | ccw-loop-b-init.md | 会话初始化、任务解析 | init.output.json |
| [develop](workers/worker-develop.md) | ccw-loop-b-develop.md | 代码实现、重构 | develop.output.json, develop.md |
| [debug](workers/worker-debug.md) | ccw-loop-b-debug.md | 问题诊断、假设验证 | debug.output.json, debug.md |
| [validate](workers/worker-validate.md) | ccw-loop-b-validate.md | 测试执行、覆盖率 | validate.output.json, validate.md |
| [complete](workers/worker-complete.md) | ccw-loop-b-complete.md | 总结收尾 | complete.output.json, summary.md |

### Worker Dependencies

| Worker | Depends On | Leads To |
|--------|------------|----------|
| init | - | develop (auto) / menu (interactive) |
| develop | init | validate / debug |
| debug | init | develop / validate |
| validate | develop or debug | complete / develop (if fail) |
| complete | - | Terminal |

### Worker Sequences

```
Simple Task (Auto):     init → develop → validate → complete
Complex Task (Auto):    init → develop → validate (fail) → debug → develop → validate → complete
Bug Fix (Auto):         init → debug → develop → validate → complete
Analysis (Parallel):    init → [develop ‖ debug ‖ validate] → complete
Interactive:            init → menu → user selects → worker → menu → ...
```

## Worker Prompt Protocol

### Spawn Message Structure (§7.1)

```javascript
function buildWorkerPrompt(action, loopId, state) {
  return `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/ccw-loop-b-${action}.md (MUST read first)
2. Read: ${projectRoot}/.workflow/project-tech.json
3. Read: ${projectRoot}/.workflow/project-guidelines.json

---

Goal: ${goalForAction(action, state)}

Scope:
- 可做: ${allowedScope(action)}
- 不可做: ${forbiddenScope(action)}
- 目录限制: ${directoryScope(action, state)}

Context:
- Loop ID: ${loopId}
- State: ${projectRoot}/.workflow/.loop/${loopId}.json
- Output: ${projectRoot}/.workflow/.loop/${loopId}.workers/${action}.output.json
- Progress: ${projectRoot}/.workflow/.loop/${loopId}.progress/${action}.md

Deliverables:
- 按 WORKER_RESULT 格式输出
- 写入 output.json 和 progress.md

Quality bar:
- ${qualityCriteria(action)}
`
}
```

**关键**: 角色文件由 worker 自己读取，主流程只传递路径。不嵌入角色内容。

### Worker Output Format (WORKER_RESULT)

```
WORKER_RESULT:
- action: {action_name}
- status: success | failed | needs_input
- summary: <brief summary>
- files_changed: [list]
- next_suggestion: <suggested next action>
- loop_back_to: <action name if needs loop back, or null>

DETAILED_OUTPUT:
<action-specific structured output>
```

### Two-Phase Clarification (§5.2)

Worker 遇到模糊需求时采用两阶段模式:

```
阶段 1: Worker 输出 CLARIFICATION_NEEDED + Open questions
阶段 2: 协调器收集用户回答 → send_input → Worker 继续执行
```

```javascript
// 解析 worker 是否需要澄清
if (output.includes('CLARIFICATION_NEEDED')) {
  const userAnswers = await collectUserAnswers(output)
  send_input({
    id: workerId,
    message: `## CLARIFICATION ANSWERS\n${userAnswers}\n\n## CONTINUE EXECUTION`
  })
  const finalResult = wait({ ids: [workerId], timeout_ms: 600000 })
}
```

## Parallel Split Strategy (§6)

### Strategy 1: 按职责域拆分（推荐）

| Worker | 职责 | 交付物 | 禁止事项 |
|--------|------|--------|----------|
| develop | 定位入口、调用链、实现方案 | 变更点清单 | 不做测试 |
| debug | 问题诊断、风险评估 | 问题清单+修复建议 | 不写代码 |
| validate | 测试策略、覆盖分析 | 测试结果+质量报告 | 不改实现 |

### Strategy 2: 按模块域拆分

```
Worker 1: src/auth/**     → 认证模块变更
Worker 2: src/api/**      → API 层变更
Worker 3: src/database/** → 数据层变更
```

### 拆分原则

1. **文件隔离**: 避免多个 worker 同时修改同一文件
2. **职责单一**: 每个 worker 只做一件事
3. **边界清晰**: 超出范围用 `CLARIFICATION_NEEDED` 请求确认
4. **最小上下文**: 只传递完成任务所需的最小信息

## Result Merge (Parallel Mode)

```javascript
function mergeWorkerOutputs(outputs) {
  return {
    develop: parseWorkerResult(outputs.develop),
    debug: parseWorkerResult(outputs.debug),
    validate: parseWorkerResult(outputs.validate),
    conflicts: detectConflicts(outputs),  // 检查 worker 间建议冲突
    merged_at: getUtc8ISOString()
  }
}
```

**冲突检测**: 当多个 worker 建议修改同一文件时，协调器标记冲突，由用户决定。

## TodoWrite Pattern

### Phase-Level Tracking (Attached)

```json
[
  {"content": "Phase 1: Session Initialization", "status": "completed"},
  {"content": "Phase 2: Orchestration Loop (auto mode)", "status": "in_progress"},
  {"content": "  → Worker: init", "status": "completed"},
  {"content": "  → Worker: develop (task 2/5)", "status": "in_progress"},
  {"content": "  → Worker: validate", "status": "pending"},
  {"content": "  → Worker: complete", "status": "pending"}
]
```

### Parallel Mode Tracking

```json
[
  {"content": "Phase 1: Session Initialization", "status": "completed"},
  {"content": "Phase 2: Parallel Analysis", "status": "in_progress"},
  {"content": "  → Worker: develop (parallel)", "status": "in_progress"},
  {"content": "  → Worker: debug (parallel)", "status": "in_progress"},
  {"content": "  → Worker: validate (parallel)", "status": "in_progress"},
  {"content": "  → Merge results", "status": "pending"}
]
```

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, then Phase 1 execution
2. **Progressive Phase Loading**: Read phase docs ONLY when that phase is about to execute
3. **Parse Every Output**: Extract WORKER_RESULT from worker output for next decision
4. **Worker 生命周期**: spawn → wait → [send_input if needed] → close，不长期保留 worker
5. **结果持久化**: Worker 输出写入 `{projectRoot}/.workflow/.loop/{loopId}.workers/`
6. **状态同步**: 每次 worker 完成后更新 master state
7. **超时处理**: send_input 请求收敛，再超时则使用已有结果继续
8. **DO NOT STOP**: Continuous execution until completed, paused, or max iterations

## Error Handling

| Error Type | Recovery |
|------------|----------|
| Worker timeout | send_input 请求收敛 → 再超时则跳过 |
| Worker failed | Log error, 协调器决策是否重试 |
| Batch wait partial timeout | 使用已完成结果继续 |
| State corrupted | 从 progress 文件和 worker output 重建 |
| Conflicting worker results | 标记冲突，由用户决定 |
| Max iterations reached | 生成总结，记录未完成项 |

## Coordinator Checklist

### Before Each Phase

- [ ] Read phase reference document
- [ ] Check current state and control signals
- [ ] Update TodoWrite with phase tasks

### After Each Worker

- [ ] Parse WORKER_RESULT from output
- [ ] Persist output to `.workers/{action}.output.json`
- [ ] Update master state file
- [ ] close_agent (确认不再需要交互)
- [ ] Determine next action (continue / loop back / complete)

## Reference Documents

| Document | Purpose |
|----------|---------|
| [workers/](workers/) | Worker 定义 (init, develop, debug, validate, complete) |

## Usage

```bash
# Interactive mode (default)
/ccw-loop-b TASK="Implement user authentication"

# Auto mode
/ccw-loop-b --mode=auto TASK="Fix login bug"

# Parallel analysis mode
/ccw-loop-b --mode=parallel TASK="Analyze and improve payment module"

# Resume existing loop
/ccw-loop-b --loop-id=loop-b-20260122-abc123
```
