# Command: execute

Spawn executor team-workers for IMPL tasks. All execution routes through executor role (has team interaction protocol). Coordinator only handles spawning — executor internally selects agent or CLI mode.

## Trigger

Called by `monitor.md handleSpawnNext` when IMPL-* tasks become ready.

## Spawn Logic

Each IMPL task = 1 executor team-worker. Coordinator passes task file + executor assignment, executor handles the rest.

```
Agent({
  subagent_type: "team-worker",
  run_in_background: true,
  description: "IMPL-00N: <task title>",
  prompt: "## Role Assignment
role: executor
skill: team-lifecycle-v3
session: <session-folder>
session_id: <session-id>
team_name: <team-name>
requirement: <task-description>
inner_loop: false
priority: P0

Task file: <task_file>
Executor: <agent|gemini|codex|qwen>
Session: <session-folder>"
})
```

## Parallel Spawn

When multiple IMPL tasks are ready simultaneously (same blockedBy set), spawn all in a **single message with multiple Agent() calls**:

```
// IMPL-001 (agent), IMPL-002 (codex), IMPL-003 (gemini) all ready
Agent({ subagent_type: "team-worker", description: "IMPL-001: ...", prompt: "...Executor: agent..." })
Agent({ subagent_type: "team-worker", description: "IMPL-002: ...", prompt: "...Executor: codex..." })
Agent({ subagent_type: "team-worker", description: "IMPL-003: ...", prompt: "...Executor: gemini..." })
```

**Rules**:
- Independent IMPL tasks (no mutual blockedBy) → parallel spawn
- Dependent IMPL tasks (TASK-B depends_on TASK-A) → sequential, spawn B after A completes
- Each worker is fully isolated — no shared context between IMPL agents

## Coordinator State Update

After spawning, log to message bus:

```
team_msg({
  operation: "log",
  session_id: "<session-id>",
  from: "coordinator",
  type: "impl_dispatched",
  summary: "Spawned N executor workers",
  data: {
    tasks: [
      { id: "IMPL-001", executor: "agent", task_file: "..." },
      { id: "IMPL-002", executor: "codex", task_file: "..." }
    ]
  }
})
```
