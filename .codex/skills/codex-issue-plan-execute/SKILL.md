---
name: codex-issue-plan-execute
description: Autonomous issue planning and execution workflow for Codex. Supports batch issue processing with integrated planning, queuing, and execution stages. Triggers on "codex-issue", "plan execute issue", "issue workflow".
allowed-tools: Task, AskUserQuestion, Read, Write, Bash, Glob, Grep
---

# Codex Issue Plan-Execute Workflow

Streamlined autonomous workflow for Codex that integrates issue planning, queue management, and solution execution in a single stateful Skill. Supports batch processing with minimal queue overhead and dual-agent execution strategy.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Main Orchestrator (Claude Code Entry Point)                        │
│  • Loads issues                                                      │
│  • Spawns persistent agents                                          │
│  • Manages pipeline flow                                             │
└──────┬──────────────────────────────────────┬──────────────────────┘
       │ spawn_agent(planning-system-prompt)  │ spawn_agent(execution-system-prompt)
       │ (创建一次)                            │ (创建一次)
       ▼                                       ▼
┌─────────────────────────────┐     ┌────────────────────────────────┐
│   Planning Agent            │     │   Execution Agent              │
│   (持久化 - 不关闭)         │     │   (持久化 - 不关闭)            │
│                             │     │                                │
│ Loop: receive issue →       │     │ Loop: receive solution →       │
│       analyze & design      │     │       implement & test         │
│       return solution       │     │       return results           │
└────────┬────────────────────┘     └────────┬─────────────────────┘
         │ send_input(issue)                  │ send_input(solution)
         │ wait for response                  │ wait for response
         │ (逐个 issue)                       │ (逐个 solution)
         ▼                                    ▼
   Planning Results                    Execution Results
   (unified JSON)                      (unified JSON)
```


## Key Design Principles

1. **Persistent Agent Architecture**: Two long-running agents (Planning + Execution) that never close until all work completes
2. **Pipeline Flow**: Main orchestrator feeds issues sequentially to Planning Agent via `send_input`, then feeds solutions to Execution Agent via `send_input`
3. **Unified Results Storage**: Single JSON files (`planning-results.json`, `execution-results.json`) accumulate all results instead of per-issue files
4. **Context Preservation**: Agents maintain context across multiple tasks without being recreated
5. **Efficient Communication**: Uses `send_input()` mechanism to communicate with agents without spawn/close overhead

---

## ⚠️ Mandatory Prerequisites (强制前置条件)

> **⛔ 禁止跳过**: 在执行任何操作之前，**必须**完整阅读以下文档。未阅读规范直接执行将导致输出不符合质量标准。

### 规范文档 (必读)

| Document | Purpose | Priority |
|----------|---------|----------|
| [specs/issue-handling.md](specs/issue-handling.md) | Issue 处理规范和数据结构 | **P0 - 最高** |
| [specs/solution-schema.md](specs/solution-schema.md) | 解决方案数据结构和验证规则 | **P0 - 最高** |
| [specs/quality-standards.md](specs/quality-standards.md) | 质量标准和验收条件 | P1 |

### 参考文档 (背景知识)

| Document | Purpose |
|----------|---------|
| [../issue-plan.md](../../.codex/prompts/issue-plan.md) | Codex Issue Plan 原始实现 |
| [../issue-execute.md](../../.codex/prompts/issue-execute.md) | Codex Issue Execute 原始实现 |
| [../codex SUBAGENT 策略补充.md](../../workflow/.scratchpad/codex%20SUBAGENT%20策略补充.md) | Codex Subagent 使用指南 |

---

## Execution Flow

### Phase 1: Initialize Persistent Agents
→ Spawn Planning Agent with `planning-agent-system.md` prompt (stays alive)
→ Spawn Execution Agent with `execution-agent-system.md` prompt (stays alive)

### Phase 2: Planning Pipeline
For each issue sequentially:
1. Send issue to Planning Agent via `send_input()` with planning request
2. Wait for Planning Agent to return solution JSON
3. Store result in unified `planning-results.json` array
4. Continue to next issue (agent stays alive)

### Phase 3: Execution Pipeline
For each successful planning result sequentially:
1. Send solution to Execution Agent via `send_input()` with execution request
2. Wait for Execution Agent to complete implementation and testing
3. Store result in unified `execution-results.json` array
4. Continue to next solution (agent stays alive)

### Phase 4: Finalize
→ Close Planning Agent (after all issues planned)
→ Close Execution Agent (after all solutions executed)
→ Generate final report with statistics

### State Schema

```json
{
  "status": "pending|running|completed",
  "phase": "init|listing|planning|executing|complete",
  "issues": {
    "{issue_id}": {
      "id": "ISS-xxx",
      "status": "registered|planning|planned|executing|completed",
      "solution_id": "SOL-xxx-1",
      "planned_at": "ISO-8601",
      "executed_at": "ISO-8601"
    }
  },
  "queue": [
    {
      "item_id": "S-1",
      "issue_id": "ISS-xxx",
      "solution_id": "SOL-xxx-1",
      "status": "pending|executing|completed"
    }
  ],
  "context": {
    "work_dir": ".workflow/.scratchpad/...",
    "total_issues": 0,
    "completed_count": 0,
    "failed_count": 0
  },
  "errors": []
}
```

---

## Directory Setup

```javascript
const timestamp = new Date().toISOString().slice(0,19).replace(/[-:T]/g, '');
const workDir = `.workflow/.scratchpad/codex-issue-${timestamp}`;

Bash(`mkdir -p "${workDir}"`);
Bash(`mkdir -p "${workDir}/solutions"`);
Bash(`mkdir -p "${workDir}/snapshots"`);
```

## Output Structure

```
.workflow/.scratchpad/codex-issue-{timestamp}/
├── planning-results.json               # All planning results in single file
│   ├── phase: "planning"
│   ├── created_at: "ISO-8601"
│   └── results: [
│       { issue_id, solution_id, status, solution, planned_at }
│     ]
├── execution-results.json              # All execution results in single file
│   ├── phase: "execution"
│   ├── created_at: "ISO-8601"
│   └── results: [
│       { issue_id, solution_id, status, commit_hash, files_modified, executed_at }
│     ]
└── final-report.md                     # Summary statistics and report
```

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| [phases/orchestrator.md](phases/orchestrator.md) | Orchestrator 编排器逻辑 |
| [phases/actions/action-list.md](phases/actions/action-list.md) | List Issues 动作 |
| [phases/actions/action-plan.md](phases/actions/action-plan.md) | Plan Solutions 动作 |
| [phases/actions/action-execute.md](phases/actions/action-execute.md) | Execute Solutions 动作 |
| [phases/actions/action-complete.md](phases/actions/action-complete.md) | Complete 动作 |
| [phases/state-schema.md](phases/state-schema.md) | 状态结构定义和验证 |
| [specs/issue-handling.md](specs/issue-handling.md) | Issue 处理规范 |
| [specs/solution-schema.md](specs/solution-schema.md) | 解决方案数据结构 |
| [specs/quality-standards.md](specs/quality-standards.md) | 质量标准 |
| [specs/subagent-roles.md](specs/subagent-roles.md) | Subagent 角色定义 |

---

## Usage Examples

### Batch Process Specific Issues

```bash
codex -p "@.codex/prompts/codex-issue-plan-execute ISS-001,ISS-002,ISS-003"
```

### Interactive Selection

```bash
codex -p "@.codex/prompts/codex-issue-plan-execute"
# Then select issues from the list
```

### Resume from Snapshot

```bash
codex -p "@.codex/prompts/codex-issue-plan-execute --resume snapshot-path"
```

---

*Skill Version: 1.0*
*Execution Mode: Autonomous*
*Status: Ready for Customization*
