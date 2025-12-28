---
description: Execute all solutions from issue queue with git commit after each task
argument-hint: ""
---

# Issue Execute (Codex Version)

## Core Principle

**Serial Execution**: Execute solutions ONE BY ONE from the issue queue via `ccw issue next`. For each solution, complete all tasks sequentially (implement → test → commit per task). Continue autonomously until queue is empty.

## Execution Flow

```
INIT: Fetch first solution via ccw issue next

WHILE solution exists:
  1. Receive solution JSON from ccw issue next
  2. Execute all tasks in solution.tasks sequentially:
     FOR each task:
       - IMPLEMENT: Follow task.implementation steps
       - TEST: Run task.test commands
       - VERIFY: Check task.acceptance criteria
       - COMMIT: Stage files, commit with task.commit.message_template
  3. Report completion via ccw issue done <item_id>
  4. Fetch next solution via ccw issue next

WHEN queue empty:
  Output final summary
```

## Step 1: Fetch First Solution

Run this command to get your first solution:

```bash
ccw issue next
```

This returns JSON with the full solution definition:
- `item_id`: Solution identifier in queue (e.g., "S-1")
- `issue_id`: Parent issue ID (e.g., "ISS-20251227-001")
- `solution_id`: Solution ID (e.g., "SOL-20251227-001")
- `solution`: Full solution with all tasks
- `execution_hints`: Timing and executor hints

If response contains `{ "status": "empty" }`, all solutions are complete - skip to final summary.

## Step 2: Parse Solution Response

Expected solution structure:

```json
{
  "item_id": "S-1",
  "issue_id": "ISS-20251227-001",
  "solution_id": "SOL-20251227-001",
  "status": "pending",
  "solution": {
    "id": "SOL-20251227-001",
    "description": "Description of solution approach",
    "tasks": [
      {
        "id": "T1",
        "title": "Task title",
        "scope": "src/module/",
        "action": "Create|Modify|Fix|Refactor|Add",
        "description": "What to do",
        "modification_points": [
          { "file": "path/to/file.ts", "target": "function name", "change": "description" }
        ],
        "implementation": [
          "Step 1: Do this",
          "Step 2: Do that"
        ],
        "test": {
          "commands": ["npm test -- --filter=xxx"],
          "unit": ["Unit test requirement 1", "Unit test requirement 2"]
        },
        "regression": ["Verify existing tests still pass"],
        "acceptance": {
          "criteria": ["Criterion 1: Must pass", "Criterion 2: Must verify"],
          "verification": ["Run test command", "Manual verification step"]
        },
        "commit": {
          "type": "feat|fix|test|refactor",
          "scope": "module",
          "message_template": "feat(scope): description"
        },
        "depends_on": [],
        "estimated_minutes": 30,
        "priority": 1
      }
    ],
    "exploration_context": {
      "relevant_files": ["path/to/reference.ts"],
      "patterns": "Follow existing pattern in xxx",
      "integration_points": "Used by other modules"
    },
    "analysis": {
      "risk": "low|medium|high",
      "impact": "low|medium|high",
      "complexity": "low|medium|high"
    },
    "score": 0.95,
    "is_bound": true
  },
  "execution_hints": {
    "executor": "codex",
    "estimated_minutes": 180
  }
}
```

## Step 3: Execute Tasks Sequentially

Iterate through `solution.tasks` array and execute each task:

### Phase A: IMPLEMENT

1. Read all `solution.exploration_context.relevant_files` to understand existing patterns
2. Follow `task.implementation` steps in order
3. Apply changes to `task.modification_points` files
4. Follow `solution.exploration_context.patterns` for code style consistency
5. Run `task.regression` checks if specified to ensure no breakage

**Output format:**
```
## Implementing: [task.title] (Task [N]/[Total])

**Scope**: [task.scope]
**Action**: [task.action]

**Steps**:
1. ✓ [implementation step 1]
2. ✓ [implementation step 2]
...

**Files Modified**:
- path/to/file1.ts
- path/to/file2.ts
```

### Phase B: TEST

1. Run all commands in `task.test.commands`
2. Verify unit tests pass (`task.test.unit`)
3. Run integration tests if specified (`task.test.integration`)

**If tests fail**: Fix the code and re-run. Do NOT proceed until tests pass.

**Output format:**
```
## Testing: [task.title]

**Test Results**:
- [x] Unit tests: PASSED
- [x] Integration tests: PASSED (or N/A)
```

### Phase C: VERIFY

Check all `task.acceptance.criteria` are met using `task.acceptance.verification` steps:

```
## Verifying: [task.title]

**Acceptance Criteria**:
- [x] Criterion 1: Verified
- [x] Criterion 2: Verified
...

**Verification Steps**:
- [x] Run test command
- [x] Manual verification step

All criteria met: YES
```

**If any criterion fails**: Go back to IMPLEMENT phase and fix.

### Phase D: COMMIT

After all phases pass, commit the changes for this task:

```bash
# Stage all modified files
git add path/to/file1.ts path/to/file2.ts ...

# Commit with task message template
git commit -m "$(cat <<'EOF'
[task.commit.message_template]

Solution-ID: [solution_id]
Issue-ID: [issue_id]
Task-ID: [task.id]
EOF
)"
```

**Output format:**
```
## Committed: [task.title]

**Commit**: [commit hash]
**Message**: [commit message]
**Files**: N files changed
```

### Repeat for Next Task

Continue to next task in `solution.tasks` array until all tasks are complete.

## Step 4: Report Completion

After ALL tasks in the solution are complete, report to queue system:

```bash
ccw issue done <item_id> --result '{
  "files_modified": ["path1", "path2"],
  "tests_passed": true,
  "acceptance_passed": true,
  "committed": true,
  "commits": [
    { "task_id": "T1", "hash": "abc123" },
    { "task_id": "T2", "hash": "def456" }
  ],
  "summary": "[What was accomplished]"
}'
```

**If solution failed and cannot be fixed:**

```bash
ccw issue done <item_id> --fail --reason "Task [task.id] failed: [details]"
```

## Step 5: Continue to Next Solution

Immediately fetch the next solution:

```bash
ccw issue next
```

**Output progress:**
```
✓ [N/M] Completed: [item_id] - [solution.approach]
→ Fetching next solution...
```

**DO NOT STOP.** Return to Step 2 and continue until queue is empty.

## Final Summary

When `ccw issue next` returns `{ "status": "empty" }`:

```markdown
## Issue Queue Execution Complete

**Total Solutions Executed**: N
**Total Tasks Executed**: M

**All Commits**:
| # | Solution | Task | Commit |
|---|----------|------|--------|
| 1 | S-1 | T1 | abc123 |
| 2 | S-1 | T2 | def456 |
| 3 | S-2 | T1 | ghi789 |

**Files Modified**:
- path/to/file1.ts
- path/to/file2.ts

**Summary**:
[Overall what was accomplished]
```

## Execution Rules

1. **Never stop mid-queue** - Continue until queue is empty
2. **One solution at a time** - Fully complete (all tasks + report) before moving on
3. **Sequential within solution** - Complete each task (including commit) before next
4. **Tests MUST pass** - Do not proceed to commit if tests fail
5. **Commit after each task** - Each task gets its own commit
6. **Self-verify** - All acceptance criteria must pass before commit
7. **Report accurately** - Use `ccw issue done` after each solution
8. **Handle failures gracefully** - If a solution fails, report via `ccw issue done --fail` and continue to next

## Error Handling

| Situation | Action |
|-----------|--------|
| `ccw issue next` returns empty | All done - output final summary |
| Tests fail | Fix code, re-run tests |
| Verification fails | Go back to implement phase |
| Git commit fails | Check staging, retry commit |
| `ccw issue done` fails | Log error, continue to next solution |
| Unrecoverable error | Call `ccw issue done --fail`, continue to next |

## CLI Command Reference

| Command | Purpose |
|---------|---------|
| `ccw issue next` | Fetch next solution from queue |
| `ccw issue done <id>` | Mark solution complete with result |
| `ccw issue done <id> --fail` | Mark solution failed with reason |

## Start Execution

Begin by running:

```bash
ccw issue next
```

Then follow the solution lifecycle for each solution until queue is empty.
