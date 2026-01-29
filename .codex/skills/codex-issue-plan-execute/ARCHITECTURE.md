# Architecture Guide - Dual-Agent Pipeline System

## Overview

The Codex issue plan-execute workflow uses a **persistent dual-agent architecture** that separates planning from execution. Two long-running agents (Planning + Execution) receive issues and solutions sequentially via `send_input`, process them independently, and maintain context across multiple tasks without recreating themselves.

---

## System Architecture

### High-Level Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  Main Orchestrator (Claude Code Entry Point)                     │
│  • Loads issues from queue                                        │
│  • Spawns persistent agents (once)                                │
│  • Routes issues → Planning Agent → Execution Agent              │
│  • Manages pipeline state and results                             │
└──────────┬──────────────────────────────────────────────┬────────┘
           │ spawn_agent (Planning)                       │ spawn_agent (Execution)
           │ (创建一次，保持活跃)                         │ (创建一次，保持活跃)
           ▼                                              ▼
    ┌──────────────────────┐                    ┌──────────────────────┐
    │  Planning Agent      │                    │  Execution Agent     │
    │  (持久化)            │                    │  (持久化)            │
    │                      │                    │                      │
    │ • 接收 issue        │                    │ • 接收 solution     │
    │ • 分析需求          │                    │ • 执行所有任务      │
    │ • 设计方案          │                    │ • 运行测试          │
    │ • 返回 solution     │                    │ • 提交代码          │
    │                      │                    │ • 返回执行结果      │
    └──────┬───────────────┘                    └──────┬──────────────┘
           │                                           │
           └─── wait for completion ────────────────────┘
           │ (per issue)                       │ (per solution)
           └─── wait for completion ────────────────────┘
```

### Data Flow Stages

```
Stage 1: Initialize
  ├─ Create Planning Agent (persistent)
  ├─ Create Execution Agent (persistent)
  └─ Load issues from queue

Stage 2: Planning Pipeline (sequential)
  ├─ For each issue:
  │  ├─ send_input(issue) → Planning Agent
  │  ├─ wait for solution JSON response
  │  ├─ validate solution schema
  │  └─ save to planning-results.json
  └─ [Agent stays alive]

Stage 3: Execution Pipeline (sequential)
  ├─ For each planned solution:
  │  ├─ send_input(solution) → Execution Agent
  │  ├─ wait for execution results
  │  ├─ validate execution result
  │  └─ save to execution-results.json
  └─ [Agent stays alive]

Stage 4: Finalize
  ├─ Close Planning Agent
  ├─ Close Execution Agent
  └─ Generate final report
```

---

## Key Design Principles

### 1. Persistent Agent Architecture

**Why**: Avoid spawn/close overhead (n+2 times) by reusing agents

**Implementation**:
```javascript
// ❌ OLD: Create new agent per issue
for (const issue of issues) {
  const agentId = spawn_agent({ message: prompt });  // ← Expensive!
  const result = wait({ ids: [agentId] });
  close_agent({ id: agentId });                      // ← Expensive!
}

// ✅ NEW: Persistent agent with send_input
const agentId = spawn_agent({ message: initialPrompt });  // ← Once
for (const issue of issues) {
  send_input({ id: agentId, message: taskPrompt });      // ← Reuse
  const result = wait({ ids: [agentId] });
}
close_agent({ id: agentId });                            // ← Once
```

**Benefits**:
- Agent initialization cost: O(1) instead of O(n)
- Context maintained across tasks
- Agent state preserved between tasks

### 2. Unified Results Storage

**Pattern**: Single JSON file per phase (not per-issue files)

**Before** (scattered results):
```
solutions/
├── ISS-001-plan.json
├── ISS-001-execution.json
├── ISS-002-plan.json
├── ISS-002-execution.json
└── ... (2n files)
```

**After** (unified results):
```
planning-results.json
├── phase: "planning"
├── created_at: "ISO-8601"
└── results: [
    { issue_id, solution_id, status, solution, planned_at },
    { issue_id, solution_id, status, solution, planned_at },
    ...
  ]

execution-results.json
├── phase: "execution"
├── created_at: "ISO-8601"
└── results: [
    { issue_id, solution_id, status, commit_hash, files_modified, executed_at },
    ...
  ]
```

**Advantages**:
- Single query point for all results
- Easier to analyze batch performance
- Fewer file I/O operations
- Complete history in one file

### 3. Pipeline Flow Architecture

**Pattern**: Sequential processing through two phases

```
Phase 2: Planning Pipeline
─────────────────────────
Issue 1 ─→ Planning Agent ─→ Wait ─→ Solution 1 (save to planning-results.json)
Issue 2 ─→ Planning Agent ─→ Wait ─→ Solution 2 (save to planning-results.json)
Issue 3 ─→ Planning Agent ─→ Wait ─→ Solution 3 (save to planning-results.json)

Phase 3: Execution Pipeline
──────────────────────────
Solution 1 ─→ Execution Agent ─→ Wait ─→ Result 1 (save to execution-results.json)
Solution 2 ─→ Execution Agent ─→ Wait ─→ Result 2 (save to execution-results.json)
Solution 3 ─→ Execution Agent ─→ Wait ─→ Result 3 (save to execution-results.json)
```

**Why Sequential**:
- Ensures task dependencies respected
- Simplifies state management
- Makes debugging easier
- Prevents concurrent conflicts

### 4. Context Minimization via send_input

**Communication Protocol**:

```javascript
// ❌ OLD: Pass full context each time
spawn_agent({
  message: allProjectCode + allDocumentation + newIssue  // ← Huge context
});

// ✅ NEW: Minimal context via send_input
const agentId = spawn_agent({ message: systemPrompt });  // ← Initial setup
send_input({
  id: agentId,
  message: { issue_id, title, description }             // ← Minimal task
});
```

**Benefits**:
- System prompt sent once
- Each task: minimal context
- Agent uses internal knowledge accumulated
- Token usage: O(1) per task not O(n)

### 5. Path Resolution for Global Installation

**When skill installed globally** (not just in project):

| Path Type | Example | Usage |
|-----------|---------|-------|
| Skill-internal | `prompts/planning-agent.md` | Read from skill directory |
| Project files | `.workflow/project-tech.json` | Read from project root |
| User home | `~/.codex/agents/issue-plan-agent.md` | Read from home directory |
| Relative | `../../shared-config.json` | Relative to current location |

**Note**: All paths resolve relative to project root when skill executes

---

## Component Responsibilities

### Main Orchestrator

**Responsibilities**:
1. Load issues from queue
2. Create persistent agents (once each)
3. Route issues to Planning Agent (sequential)
4. Route solutions to Execution Agent (sequential)
5. Manage state transitions
6. Generate final report
7. Close agents

**State Management**:
- Tracks issues and their status
- Tracks solutions and their bindings
- Accumulates results in unified JSON files
- Maintains error log

### Planning Agent

**Input**: Issue details
```json
{
  "issue_id": "ISS-001",
  "title": "Add authentication",
  "description": "Implement JWT-based auth",
  "project_context": { /* tech stack, guidelines */ }
}
```

**Output**: Solution JSON
```json
{
  "solution_id": "SOL-ISS-001-1",
  "tasks": [ /* task definitions */ ],
  "acceptance": { /* criteria */ },
  "score": 0.95
}
```

**Lifecycle**:
- Receive issue via `send_input`
- Explore codebase to understand context
- Design solution and break into tasks
- Validate against schema
- Return solution JSON
- Wait for next issue

### Execution Agent

**Input**: Solution JSON + project context
```json
{
  "solution_id": "SOL-ISS-001-1",
  "issue_id": "ISS-001",
  "solution": { /* full solution object */ }
}
```

**Output**: Execution results
```json
{
  "execution_result_id": "EXR-ISS-001-1",
  "tasks_completed": 3,
  "files_modified": 5,
  "commits": 3,
  "verification": { /* test results */ }
}
```

**Lifecycle**:
- Receive solution via `send_input`
- Implement each task in order
- Run tests after each task
- Create commits
- Return execution results
- Wait for next solution

---

## State Schema

### Issue State

```javascript
issue: {
  id: "ISS-001",
  title: "Issue title",
  description: "Issue description",
  status: "registered|planning|planned|executing|completed|failed",
  solution_id: "SOL-ISS-001-1",
  planned_at: "ISO-8601 timestamp",
  executed_at: "ISO-8601 timestamp",
  error: "Error message if failed"
}
```

### Queue Entry

```javascript
queue_item: {
  item_id: "S-1",
  issue_id: "ISS-001",
  solution_id: "SOL-ISS-001-1",
  status: "pending|executing|completed|failed"
}
```

### Results Storage

```javascript
// planning-results.json
{
  "phase": "planning",
  "created_at": "2025-01-29T12:00:00Z",
  "results": [
    {
      "issue_id": "ISS-001",
      "solution_id": "SOL-ISS-001-1",
      "status": "completed",
      "solution": { /* full solution JSON */ },
      "planned_at": "2025-01-29T12:05:00Z"
    }
  ]
}

// execution-results.json
{
  "phase": "execution",
  "created_at": "2025-01-29T12:20:00Z",
  "results": [
    {
      "issue_id": "ISS-001",
      "solution_id": "SOL-ISS-001-1",
      "status": "completed",
      "commit_hash": "abc123def",
      "files_modified": ["src/auth.ts"],
      "executed_at": "2025-01-29T12:30:00Z"
    }
  ]
}
```

---

## Benefits Summary

| Aspect | Benefit |
|--------|---------|
| **Performance** | Agent creation/destruction overhead only once (not n times) |
| **Context** | Agent maintains context across multiple tasks |
| **Storage** | Unified JSON files, easy to query and analyze |
| **Communication** | via send_input implements efficient data passing |
| **Maintainability** | Clear pipeline structure, easy to debug |
| **Scalability** | Supports batch processing of N issues |
| **Fault Isolation** | Planning failures don't affect execution, vice versa |
| **Observability** | All results in single file per phase for analysis |

---

## Detailed Phase Descriptions

For detailed execution logic for each phase, see:

- **Phase 1 (Init)**: `phases/actions/action-init.md`
- **Phase 2 (Planning)**: `phases/actions/action-plan.md`
- **Phase 3 (Execution)**: `phases/actions/action-execute.md`
- **Phase 4 (Complete)**: `phases/actions/action-complete.md`

For orchestrator pseudocode and implementation details, see:

- **Core Logic**: `phases/orchestrator.md`
- **State Schema**: `phases/state-schema.md`

For agent role definitions, see:

- **Agent Roles**: `specs/agent-roles.md`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2025-01-29 | Consolidated ARCHITECTURE.md, unified prompts |
| 1.0 | 2024-12-29 | Initial dual-agent architecture |

---

**Document Version**: 2.0  
**Last Updated**: 2025-01-29  
**Maintained By**: Codex Issue Plan-Execute Team
