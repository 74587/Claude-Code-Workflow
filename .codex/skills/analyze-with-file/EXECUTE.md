# Analyze Quick Execute

> **Trigger**: User selects "Quick Execute" after Phase 4 completion
> **Prerequisites**: `conclusions.json` + `explorations.json`/`perspectives.json` already exist
> **Core Principle**: No additional agent exploration - analysis phase has already gathered sufficient context

## Execution Flow

```
conclusions.json → quick-plan.json → User Confirmation → Serial Execution → execution-log.md
```

---

## Step 1: Generate quick-plan.json

Convert `conclusions.json` recommendations directly into executable tasks.

**Conversion Logic**:
```javascript
const quickPlan = {
  session_id: sessionId,
  source: "analysis",
  source_file: `${sessionFolder}/conclusions.json`,
  generated_at: new Date().toISOString(),

  tasks: conclusions.recommendations.map((rec, index) => ({
    id: `TASK-${String(index + 1).padStart(3, '0')}`,
    title: rec.action,
    description: rec.rationale,
    priority: rec.priority,  // high/medium/low
    status: "pending",
    files_to_modify: extractFilesFromEvidence(rec, explorations),
    depends_on: [],  // Serial execution - no dependencies needed
    context: {
      source_conclusions: conclusions.key_conclusions,
      evidence: explorations.relevant_files || perspectives.aggregated_findings
    }
  })),

  execution_mode: "serial",
  total_tasks: conclusions.recommendations.length
}
```

**File Extraction Logic**:
- Parse evidence from `explorations.json` or `perspectives.json`
- Match recommendation action keywords to relevant_files
- If no specific files, use pattern matching from findings

**Output**: `${sessionFolder}/quick-plan.json`

---

## Step 2: User Confirmation

Present generated plan for user approval before execution.

**Confirmation Display**:
- Total tasks to execute
- Task list with IDs, titles, priorities
- Files to be modified
- Execution mode: Serial

**User Options** (ASK_USER - single select):

| Option | Action |
|--------|--------|
| **Start Execution** | Proceed with serial execution |
| **Adjust Tasks** | Allow user to modify/remove tasks |
| **Cancel** | Cancel execution, keep quick-plan.json |

**Adjustment Mode** (if selected):
- Display task list with checkboxes
- User can deselect tasks to skip
- User can reorder priorities
- Regenerate quick-plan.json with adjustments

---

## Step 3: Serial Task Execution

Execute tasks one by one without spawning subagents.

**IMPORTANT**: This phase does NOT use spawn_agent. Main process executes tasks directly via CLI.

**Execution Loop**:
```
For each task in quick-plan.tasks:
  ├─ Update task status: "in_progress"
  ├─ Execute via CLI (synchronous)
  ├─ Record result to execution-log.md
  ├─ Update task status: "completed" | "failed"
  └─ Continue to next task
```

**CLI Execution Pattern**:
```bash
ccw cli -p "PURPOSE: Execute task from analysis
TASK ID: ${task.id}
TASK: ${task.title}
DESCRIPTION: ${task.description}
FILES: ${task.files_to_modify.join(', ')}
CONTEXT: ${JSON.stringify(task.context)}
MODE: write
EXPECTED: Task completed, files modified as specified
" --tool codex --mode write
```

**Execution Behavior**:
- One task at a time (serial, no parallel agents)
- Wait for CLI completion before next task
- Record result immediately after completion
- Stop on critical failure (user can choose to continue)

---

## Step 4: Record Execution Log

Maintain `execution-log.md` as unified execution history.

**Output**: `${sessionFolder}/execution-log.md`

**execution-log.md Structure**:

```markdown
# Execution Log

## Session Info
- **Session ID**: ${sessionId}
- **Plan Source**: quick-plan.json (from analysis)
- **Started**: ${startTime}
- **Mode**: Serial Execution

## Task Execution Timeline

### ${timestamp} - TASK-001: ${title}
- **Status**: completed | failed
- **Duration**: ${duration}s
- **Files Modified**: ${files.join(', ')}
- **Summary**: ${resultSummary}
- **Notes**: ${issues or discoveries}

### ${timestamp} - TASK-002: ${title}
...

## Execution Summary
- **Total Tasks**: ${total}
- **Completed**: ${completed}
- **Failed**: ${failed}
- **Success Rate**: ${rate}%
- **Total Duration**: ${duration}
```

**Log Entry Fields**:

| Field | Content |
|-------|---------|
| Timestamp | ISO format execution time |
| Task ID | TASK-XXX identifier |
| Title | Task title from plan |
| Status | completed / failed |
| Duration | Execution time in seconds |
| Files Modified | List of changed files |
| Summary | Brief result description |
| Notes | Issues discovered or special conditions |

---

## Step 5: Update quick-plan.json

After each task, update plan with execution results.

**Task Status Updates**:
```javascript
task.status = "completed" | "failed"
task.executed_at = timestamp
task.duration = seconds
task.result = {
  success: boolean,
  files_modified: string[],
  summary: string,
  error: string | null
}
```

---

## Step 6: Completion Summary

Present final execution results.

**Summary Display**:
- Session ID and folder path
- Execution statistics (completed/failed/total)
- Success rate percentage
- Failed tasks requiring attention (if any)
- Link to execution-log.md for details

**Post-Execution Options** (ASK_USER - single select):

| Option | Action |
|--------|--------|
| **Retry Failed** | Re-execute only failed tasks |
| **View Log** | Display execution-log.md content |
| **Create Issue** | Create issue from failed tasks |
| **Done** | End workflow |

**Retry Logic**:
- Filter tasks with status: "failed"
- Re-execute in original order
- Append retry results to execution-log.md

---

## Output Structure

When Quick Execute is activated, session folder expands with:

```
{projectRoot}/.workflow/.analysis/ANL-{slug}-{date}/
├── ...                          # Phase 1-4 artifacts
├── quick-plan.json              # Executable task plan
└── execution-log.md             # Execution history
```

---

## Error Handling

| Situation | Action | Recovery |
|-----------|--------|----------|
| Task execution fails | Record failure in execution-log.md, ask user | Retry, skip, or abort remaining tasks |
| CLI timeout | Mark task as failed with timeout reason | User can retry or skip |
| No recommendations in conclusions | Cannot generate quick-plan.json | Inform user, suggest using lite-plan instead |
| File conflict during execution | Document in execution-log.md | Resolve manually or adjust task order |

---

## Success Criteria

- All tasks executed (or explicitly skipped)
- `quick-plan.json` updated with final statuses
- `execution-log.md` contains complete history
- User informed of results and next steps
