# Command: monitor (v3 Enhanced)

Monitor team progress, handle callbacks, manage artifact registry, spawn next workers with priority scheduling.

## Handlers

| Handler | Trigger | Purpose |
|---------|---------|---------|
| handleCallback | Worker completion message | Process completion, validate artifacts, spawn next |
| handleCheck | User "check" command | Display current status |
| handleResume | User "resume" command | Advance pipeline |
| handleSpawnNext | Internal | Find ready tasks, priority sort, spawn workers |
| handleComplete | All tasks done | Trigger completion action |

---

## handleCallback

### Input
- Worker completion message via SendMessage
- Message contains: role, task_id, status, artifact_path

### Steps

1. **Parse Message**
   - Extract role, task_id, status from message
   - Load task via TaskGet

2. **Update Task Status**
   - TaskUpdate(status="completed")
   - Log completion to message bus

3. **Artifact Validation (v3 NEW)**
   - Check if artifact-manifest.json exists
   - If exists:
     - Read manifest
     - Check validation_status
     - Register artifact in artifact-registry.json
     - If validation_status == "failed":
       - Block downstream spawn
       - Create fix task
       - STOP
     - If validation_status == "pending":
       - Prompt user for manual validation
       - STOP
   - If not exists (backward compatible):
     - Continue without validation gating

4. **Checkpoint Detection**
   - If task_id == "QUALITY-001":
     - Display checkpoint output (see SKILL.md)
     - Pause for user command
     - STOP
   - If task_id == "PLAN-001" (v3 NEW):
     - **Dynamic IMPL Task Creation from Planner DAG**:
       1. Read `<session>/plan/plan.json` → extract `complexity` field
       2. Glob `<session>/plan/.task/TASK-*.json` → enumerate task files
       3. For each TASK file, read `depends_on` field to build DAG
       4. Determine complexity routing:
          - Low: no pre-IMPL tasks
          - Medium: create ORCH-001 (blockedBy PLAN-001)
          - High: create ARCH-001 (blockedBy PLAN-001) + ORCH-001 (blockedBy ARCH-001)
       5. For each TASK-N.json, create IMPL-00N:
          - `blockedBy`: map TASK-N `depends_on` → corresponding IMPL IDs + (PLAN-001 or ORCH-001)
          - `description`: include `Task file: <session>/plan/.task/TASK-N.json`
          - `Priority`: P0
       6. Collect all IMPL-* task IDs
       7. Create TEST-001 (tester, blockedBy all IMPL-*, P1)
       8. Create REVIEW-001 (reviewer, blockedBy all IMPL-*, P1)
       9. Apply dynamic role injection if specialist roles were identified
       10. Display routing decision + created task count
     - Continue to handleSpawnNext

5. **Spawn Next**
   - Call handleSpawnNext
   - STOP

---

## handleSpawnNext (v3 Enhanced)

### Steps

1. **Find Ready Tasks**
   - TaskList -> filter status="pending"
   - For each pending task:
     - Check blockedBy dependencies
     - All blockedBy tasks completed? -> ready

2. **Priority Sorting (v3 NEW)**
   - Sort ready tasks by priority:
     - P0 tasks first
     - P1 tasks second
     - P2 tasks last
   - Within same priority: FIFO (creation order)

3. **Parallel Grouping (v3 NEW)**
   - Group tasks by stage (same blockedBy set)
   - Tasks in same group can spawn in parallel
   - Example: IMPL-001 and DEV-FE-001 both blocked by PLAN-001 -> parallel group

4. **Artifact Discovery (v3 NEW)**
   - For each ready task:
     - Query artifact registry for upstream artifacts
     - Generate context-artifacts.json with artifact paths
     - Write to session folder for worker Phase 2 consumption

5. **Spawn Workers**
   - For each ready task (or parallel group):
     - Spawn team-worker agent with role-spec
     - Include priority in prompt
     - Include context-artifacts.json path
     - Log spawn to message bus

6. **Output Summary**
   - List spawned tasks with priorities
   - Show remaining pending count
   - STOP

### Spawn Template (v3 Enhanced)

```
Agent({
  subagent_type: "team-worker",
  description: "Spawn <role> worker",
  team_name: <team-name>,
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
skill: team-lifecycle-v3
session: <session-folder>
session_id: <session-id>
team_name: <team-name>
requirement: <task-description>
inner_loop: <true|false>
priority: <P0|P1|P2>
context_artifacts: <session-folder>/context-artifacts.json

Execute built-in Phase 1 (task discovery) -> skill routes to role Phase 2-4 -> built-in Phase 5 (report).`
})
```

---

## handleCheck

### Steps

1. **Load Session State**
   - Read team-session.json
   - TaskList -> count by status

2. **Display Status**
   - Session ID
   - Mode
   - Task counts: completed / in_progress / pending
   - Current running workers
   - Artifact registry summary (v3 NEW)
   - Priority queue status (v3 NEW)

3. **STOP** (no advancement)

---

## handleResume

### Steps

1. **Reconcile State**
   - TaskList -> find in_progress tasks
   - Check if workers still running
   - If worker missing:
     - Reset task to pending
     - Log orphan detection

2. **Fast-Advance Orphan Detection**
   - Check message bus for fast_advance logs
   - If fast_advance spawned wrong task:
     - Reconcile task chain
     - Respawn correct task

3. **Spawn Next**
   - Call handleSpawnNext
   - STOP

---

## handleComplete (v3 NEW)

### Trigger
- All tasks have status="completed"
- No tasks with status="pending" or "in_progress"

### Steps

1. **Generate Summary**
   - Count total tasks, duration
   - List deliverables with artifact paths
   - Generate artifact registry summary
   - Calculate quality metrics (discuss verdicts, review scores)

2. **Completion Action**
   - Read completion_action from team-config.json
   - If "interactive":
     - AskUserQuestion (see coordinator role.md Phase 5)
     - Execute user choice
   - If "auto_archive":
     - Update session status="completed"
     - TeamDelete
     - Archive artifacts
   - If "auto_keep":
     - Update session status="paused"
     - Output resume instructions

3. **Cleanup**
   - Write final session state
   - Log completion to message bus
   - STOP

---

## Artifact Registry Operations (v3 NEW)

### Register Artifact

```javascript
// Read existing registry
const registry = JSON.parse(Read("<session>/artifact-registry.json"))

// Add new artifact
registry.artifacts[artifact_id] = {
  manifest: <artifact-manifest>,
  discovered_at: new Date().toISOString(),
  consumed_by: []
}

// Write back
Write("<session>/artifact-registry.json", JSON.stringify(registry))
```

### Generate Context Artifacts

```javascript
// Query registry for upstream artifacts
const upstreamArtifacts = []
for (const dep of task.blockedBy) {
  const depTask = TaskGet(dep)
  const artifactId = findArtifactByTaskId(registry, depTask.id)
  if (artifactId) {
    upstreamArtifacts.push(registry.artifacts[artifactId].manifest)
  }
}

// Write context-artifacts.json for worker consumption
Write("<session>/context-artifacts.json", JSON.stringify({
  task_id: task.id,
  upstream_artifacts: upstreamArtifacts,
  generated_at: new Date().toISOString()
}))
```

---

## Error Handling

| Error | Resolution |
|-------|------------|
| Worker timeout | Mark task failed, ask user to retry |
| Artifact validation fails | Block downstream, create fix task |
| Artifact manifest missing | Continue without validation (backward compatible) |
| Priority conflict | P0 > P1 > P2, FIFO within same priority |
| Parallel spawn fails | Log error, spawn sequentially |
| Registry corruption | Rebuild from task artifacts |
| Completion action fails | Fallback to manual cleanup |
