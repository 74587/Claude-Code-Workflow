---
name: team-iterdev
description: Unified team skill for iterative development team. Pure router — all roles read this file. Beat model is coordinator-only in monitor.md. Generator-Critic loops (developer<->reviewer, max 3 rounds). Triggers on "team iterdev".
allowed-tools: spawn_agent(*), wait_agent(*), send_message(*), assign_task(*), close_agent(*), list_agents(*), report_agent_job_result(*), request_user_input(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*)
---

# Team IterDev

Iterative development team skill. Generator-Critic loops (developer<->reviewer, max 3 rounds), task ledger (task-ledger.json) for real-time progress, shared memory (cross-sprint learning), and dynamic pipeline selection for incremental delivery.

## Architecture

```
Skill(skill="team-iterdev", args="task description")
                    |
         SKILL.md (this file) = Router
                    |
     +--------------+--------------+
     |                             |
  no --role flag              --role <name>
     |                             |
  Coordinator                  Worker
  roles/coordinator/role.md    roles/<name>/role.md
     |
     +-- analyze -> dispatch -> spawn workers -> STOP
                                    |
                    +-------+-------+-------+
                    v       v       v       v
               [architect] [developer] [tester] [reviewer]
              (team-worker agents, each loads roles/<role>/role.md)
```

## Role Registry

| Role | Path | Prefix | Inner Loop |
|------|------|--------|------------|
| coordinator | [roles/coordinator/role.md](roles/coordinator/role.md) | — | — |
| architect | [roles/architect/role.md](roles/architect/role.md) | DESIGN-* | false |
| developer | [roles/developer/role.md](roles/developer/role.md) | DEV-* | true |
| tester | [roles/tester/role.md](roles/tester/role.md) | VERIFY-* | false |
| reviewer | [roles/reviewer/role.md](roles/reviewer/role.md) | REVIEW-* | false |

## Role Router

Parse `$ARGUMENTS`:
- Has `--role <name>` → Read `roles/<name>/role.md`, execute Phase 2-4
- No `--role` → `roles/coordinator/role.md`, execute entry router

## Delegation Lock

**Coordinator is a PURE ORCHESTRATOR. It coordinates, it does NOT do.**

Before calling ANY tool, apply this check:

| Tool Call | Verdict | Reason |
|-----------|---------|--------|
| `spawn_agent`, `wait_agent`, `close_agent`, `send_message`, `assign_task` | ALLOWED | Orchestration |
| `list_agents` | ALLOWED | Agent health check |
| `request_user_input` | ALLOWED | User interaction |
| `mcp__ccw-tools__team_msg` | ALLOWED | Message bus |
| `Read/Write` on `.workflow/.team/` files | ALLOWED | Session state |
| `Read` on `roles/`, `commands/`, `specs/` | ALLOWED | Loading own instructions |
| `Read/Grep/Glob` on project source code | BLOCKED | Delegate to worker |
| `Edit` on any file outside `.workflow/` | BLOCKED | Delegate to worker |
| `Bash("ccw cli ...")` | BLOCKED | Only workers call CLI |
| `Bash` running build/test/lint commands | BLOCKED | Delegate to worker |

**If a tool call is BLOCKED**: STOP. Create a task, spawn a worker.

**No exceptions for "simple" tasks.** Even a single-file read-and-report MUST go through spawn_agent.

---

## Shared Constants

- **Session prefix**: `IDS`
- **Session path**: `.workflow/.team/IDS-<slug>-<date>/`
- **CLI tools**: `ccw cli --mode analysis` (read-only), `ccw cli --mode write` (modifications)
- **Message bus**: `mcp__ccw-tools__team_msg(session_id=<session-id>, ...)`

## Worker Spawn Template

Coordinator spawns workers using this template:

```
spawn_agent({
  agent_type: "team_worker",
  task_name: "<task-id>",
  fork_context: false,
  items: [
    { type: "text", text: `## Role Assignment
role: <role>
role_spec: <skill_root>/roles/<role>/role.md
session: <session-folder>
session_id: <session-id>
requirement: <task-description>
inner_loop: <true|false>

Read role_spec file (<skill_root>/roles/<role>/role.md) to load Phase 2-4 domain instructions.` },

    { type: "text", text: `## Task Context
task_id: <task-id>
title: <task-title>
description: <task-description>
pipeline_phase: <pipeline-phase>` },

    { type: "text", text: `## Upstream Context
<prev_context>` }
  ]
})
```

After spawning, use `wait_agent({ targets: [...], timeout_ms: 900000 })` to collect results, then `close_agent({ target })` each worker.


### Model Selection Guide

Iterative development uses Generator-Critic loops. Developer and reviewer need high reasoning for code generation and review quality.

| Role | reasoning_effort | Rationale |
|------|-------------------|-----------|
| architect | high | Design decisions require careful tradeoff analysis |
| developer | high | Code generation needs precision, inner loop role |
| tester | medium | Test execution follows defined verification plan |
| reviewer | high | Critical review quality drives GC loop effectiveness |

## User Commands

| Command | Action |
|---------|--------|
| `check` / `status` | View execution status graph |
| `resume` / `continue` | Advance to next step |

## Session Directory

```
.workflow/.team/IDS-<slug>-<YYYY-MM-DD>/
├── .msg/
│   ├── messages.jsonl          # Team message bus
│   └── meta.json               # Session state
├── task-analysis.json          # Coordinator analyze output
├── task-ledger.json            # Real-time task progress ledger
├── wisdom/                     # Cross-task knowledge accumulation
│   ├── learnings.md
│   ├── decisions.md
│   ├── conventions.md
│   └── issues.md
├── design/                     # Architect output
│   ├── design-001.md
│   └── task-breakdown.json
├── code/                       # Developer tracking
│   └── dev-log.md
├── verify/                     # Tester output
│   └── verify-001.json
└── review/                     # Reviewer output
    └── review-001.md
```

## Specs Reference

- [specs/pipelines.md](specs/pipelines.md) — Pipeline definitions and task registry

## v4 Agent Coordination

### Message Semantics

| Intent | API | Example |
|--------|-----|---------|
| Queue supplementary info (don't interrupt) | `send_message` | Send design context to running developer |
| Assign GC iteration round | `assign_task` | Assign revision to developer after reviewer feedback |
| Check running agents | `list_agents` | Verify agent health during resume |

### Agent Health Check

Use `list_agents({})` in handleResume and handleComplete:

```
// Reconcile session state with actual running agents
const running = list_agents({})
// Compare with task-ledger.json active tasks
// Reset orphaned tasks (in_progress but agent gone) to pending
```

### Named Agent Targeting

Workers are spawned with `task_name: "<task-id>"` enabling direct addressing:
- `send_message({ target: "DEV-001", items: [...] })` -- send design context to developer
- `assign_task({ target: "DEV-001", items: [...] })` -- assign revision after reviewer feedback
- `close_agent({ target: "REVIEW-001" })` -- cleanup after GC loop completes

### Generator-Critic Loop via assign_task (Deep Interaction Pattern)

The developer-reviewer GC loop uses `assign_task` for iteration rounds:
```
// Round N: Reviewer found issues -> coordinator assigns revision to developer
assign_task({
  target: "DEV-001",
  items: [
    { type: "text", text: `## GC Revision Round ${N}
review_feedback: <reviewer findings from REVIEW-001>
iteration: ${N}/3
instruction: Address reviewer feedback. Focus on: <specific issues>.` }
  ]
})
```

After developer completes revision, coordinator spawns/assigns reviewer for next round. Max 3 rounds per GC cycle.

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown command | Error with available command list |
| Role not found | Error with role registry |
| GC loop exceeds 3 rounds | Accept with warning, record in shared memory |
| Sprint velocity drops below 50% | Coordinator alerts user, suggests scope reduction |
| Task ledger corrupted | Rebuild from TaskList state |
| Conflict detected | Update conflict_info, notify coordinator, create DEV-fix task |
| Pipeline deadlock | Check blockedBy chain, report blocking point |
