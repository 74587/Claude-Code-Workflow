# Command: Monitor

Handle all coordinator monitoring events: worker callbacks, status checks, pipeline advancement, and completion.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Session state | <session>/session.json | Yes |
| Task list | TaskList() | Yes |
| Trigger event | From Entry Router detection | Yes |
| Pipeline definition | From SKILL.md | Yes |

1. Load session.json for current state and fix cycle count
2. Run TaskList() to get current task statuses
3. Identify trigger event type from Entry Router

## Phase 3: Event Handlers

### handleCallback

Triggered when a worker sends completion message.

1. Parse message to identify role and task ID
2. Mark task as completed:

```
TaskUpdate({ taskId: "<task-id>", status: "completed" })
```

3. Record completion in session state
4. Check if checkpoint feedback is configured for this stage:

| Completed Task | Checkpoint | Action |
|---------------|------------|--------|
| PROFILE-001 | CP-1 | Notify user: bottleneck report ready for review |
| STRATEGY-001 | CP-2 | Notify user: optimization plan ready for review |
| BENCH-001 or REVIEW-001 | CP-3 | Check verdicts (see Review-Fix Cycle below) |

5. Proceed to handleSpawnNext

### handleSpawnNext

Find and spawn the next ready tasks.

1. Scan task list for tasks where:
   - Status is "pending"
   - All blockedBy tasks have status "completed"

2. For each ready task, spawn team-worker:

```
Task({
  subagent_type: "team-worker",
  description: "Spawn <role> worker for <task-id>",
  team_name: "perf-opt",
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: .claude/skills/team-perf-opt/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: perf-opt
requirement: <task-description>
inner_loop: <true|false>

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 -> role-spec Phase 2-4 -> built-in Phase 5.`
})
```

3. For Stage 4 (BENCH-001 + REVIEW-001): spawn both in parallel since both block on IMPL-001
4. STOP after spawning -- wait for next callback

### Review-Fix Cycle (CP-3)

When both BENCH-001 and REVIEW-001 are completed:

1. Read benchmark verdict from shared-memory (benchmarker namespace)
2. Read review verdict from shared-memory (reviewer namespace)

| Bench Verdict | Review Verdict | Action |
|--------------|----------------|--------|
| PASS | APPROVE | -> handleComplete |
| PASS | REVISE | Create FIX task with review feedback |
| FAIL | APPROVE | Create FIX task with benchmark feedback |
| FAIL | REVISE/REJECT | Create FIX task with combined feedback |
| Any | REJECT | Create FIX task + flag for strategist re-evaluation |

3. Check fix cycle count:

| Cycle Count | Action |
|-------------|--------|
| < 3 | Create FIX task, increment cycle count |
| >= 3 | Escalate to user with summary of remaining issues |

4. Create FIX task if needed:

```
TaskCreate({
  subject: "FIX-<N>",
  description: "PURPOSE: Fix issues identified by review/benchmark | Success: All flagged issues resolved
TASK:
  - Address review findings: <specific-findings>
  - Fix benchmark regressions: <specific-regressions>
  - Re-validate after fixes
CONTEXT:
  - Session: <session-folder>
  - Upstream artifacts: review-report.md, benchmark-results.json
  - Shared memory: <session>/wisdom/shared-memory.json
EXPECTED: Fixed source files | All flagged issues addressed
CONSTRAINTS: Targeted fixes only | Do not introduce new changes
---
InnerLoop: true",
  blockedBy: [],
  status: "pending"
})
```

5. Create new BENCH and REVIEW tasks blocked on FIX task
6. Proceed to handleSpawnNext (spawns optimizer for FIX task)

### handleCheck

Output current pipeline status without advancing.

1. Build status graph from task list:

```
Pipeline Status:
  [DONE]  PROFILE-001  (profiler)    -> bottleneck-report.md
  [DONE]  STRATEGY-001 (strategist)  -> optimization-plan.md
  [RUN]   IMPL-001     (optimizer)   -> implementing...
  [WAIT]  BENCH-001    (benchmarker) -> blocked by IMPL-001
  [WAIT]  REVIEW-001   (reviewer)    -> blocked by IMPL-001

Fix Cycles: 0/3
Session: <session-id>
```

2. Output status -- do NOT advance pipeline

### handleResume

Resume pipeline after user pause or interruption.

1. Audit task list for inconsistencies:
   - Tasks stuck in "in_progress" -> reset to "pending"
   - Tasks with completed blockers but still "pending" -> include in spawn list
2. Proceed to handleSpawnNext

### handleConsensus

Handle consensus_blocked signals from discuss rounds.

| Severity | Action |
|----------|--------|
| HIGH | Pause pipeline, notify user with findings summary |
| MEDIUM | Create revision task for the blocked role |
| LOW | Log finding, continue pipeline |

### handleComplete

Triggered when all pipeline tasks are completed and no fix cycles remain.

1. Verify all tasks have status "completed":

```
TaskList()
```

2. If any tasks not completed, return to handleSpawnNext
3. If all completed, transition to coordinator Phase 5 (Report + Completion Action)

### handleRevise

Triggered by user "revise <TASK-ID> [feedback]" command.

1. Parse target task ID and optional feedback
2. Create revision task with same role but updated requirements
3. Set blockedBy to empty (immediate execution)
4. Cascade: create new downstream tasks that depend on the revised task
5. Proceed to handleSpawnNext

### handleFeedback

Triggered by user "feedback <text>" command.

1. Analyze feedback text to determine impact scope
2. Identify which pipeline stage and role should handle the feedback
3. Create targeted revision task
4. Proceed to handleSpawnNext

## Phase 4: State Persistence

After every handler execution:

1. Update session.json with current state (active tasks, fix cycle count, last event)
2. Verify task list consistency
3. STOP and wait for next event
