# CCW Loop-B (Hybrid Orchestrator Pattern)

协调器 + 专用 worker 的迭代开发工作流。

## Overview

CCW Loop-B 采用混合模式设计：
- **Coordinator**: 状态管理、worker 调度、结果汇聚
- **Workers**: 专注各自领域（develop/debug/validate）

## Installation

```
.codex/skills/ccw-loop-b/
+-- SKILL.md                    # Main skill definition
+-- README.md                   # This file
+-- phases/
|   +-- orchestrator.md         # Coordinator logic
|   +-- state-schema.md         # State structure
+-- specs/
    +-- action-catalog.md       # Action catalog

.codex/agents/
+-- ccw-loop-b-init.md          # Init worker
+-- ccw-loop-b-develop.md       # Develop worker
+-- ccw-loop-b-debug.md         # Debug worker
+-- ccw-loop-b-validate.md      # Validate worker
+-- ccw-loop-b-complete.md      # Complete worker
```

## Execution Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `interactive` | 用户选择 action | 复杂任务，需要人工决策 |
| `auto` | 自动顺序执行 | 标准开发流程 |
| `parallel` | 并行多维度分析 | 需要快速全面评估 |

## Usage

```bash
# Interactive (default)
/ccw-loop-b TASK="Implement feature X"

# Auto mode
/ccw-loop-b --mode=auto TASK="Fix bug Y"

# Parallel analysis
/ccw-loop-b --mode=parallel TASK="Analyze module Z"

# Resume
/ccw-loop-b --loop-id=loop-b-xxx
```

## Session Files

```
.loop/
+-- {loopId}.json              # Master state
+-- {loopId}.workers/          # Worker outputs (JSON)
+-- {loopId}.progress/         # Human-readable progress (MD)
```

## Core Pattern

### Coordinator + Worker

```javascript
// Coordinator spawns specialized worker
const worker = spawn_agent({ message: buildWorkerPrompt(action) })

// Wait for completion
const result = wait({ ids: [worker], timeout_ms: 600000 })

// Process result
const output = result.status[worker].completed
updateState(output)

// Cleanup
close_agent({ id: worker })
```

### Batch Wait (Parallel Mode)

```javascript
// Spawn multiple workers
const workers = [
  spawn_agent({ message: developPrompt }),
  spawn_agent({ message: debugPrompt }),
  spawn_agent({ message: validatePrompt })
]

// Batch wait
const results = wait({ ids: workers, timeout_ms: 900000 })

// Merge results
const merged = mergeOutputs(results)
```

## License

MIT
