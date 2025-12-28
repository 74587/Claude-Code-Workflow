---
description: Execute solution from issue queue with git commit after each task
argument-hint: "<solution-id> [--dry-run]"
---

# Issue Execute (Codex Version)

## Core Principle

**Solution-Aware Execution**: Receive a complete solution with all its tasks, execute tasks sequentially within the solution (implement → test → commit per task), then report solution completion. This aligns with the Queue's Solution-Level design.

## Execution Flow

```
INIT: Receive solution ID (S-N) from orchestrator

FOR solution:
  1. Fetch full solution via: ccw issue detail <solution-id>
  2. Iterate through solution.tasks sequentially:
     FOR each task in solution.tasks:
       - IMPLEMENT: Follow task.implementation steps
       - TEST: Run task.test commands
       - VERIFY: Check task.acceptance criteria
       - COMMIT: Stage files, commit with task.commit.message_template
  3. Report solution completion: ccw issue done <solution-id>

OUTPUT: Final summary with all commits
```

## Step 1: Fetch Solution

Run this command to get the full solution:

```bash
ccw issue detail <solution-id>
```

This returns JSON with the complete solution definition:
- `item_id`: Solution identifier in queue (e.g., "S-1")
- `issue_id`: Parent issue ID (e.g., "ISS-20251227-001")
- `solution_id`: Solution ID (e.g., "SOL-20251227-001")
- `solution`: Full solution with all tasks
- `execution_hints`: Timing and executor hints

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
    "approach": "Description of solution approach",
    "tasks": [
      {
        "id": "T1",
        "title": "Task title",
        "scope": "src/module/",
        "action": "Create|Modify|Fix|Refactor",
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
          "unit": "Unit test requirements",
          "integration": "Integration test requirements (optional)"
        },
        "acceptance": [
          "Criterion 1: Must pass",
          "Criterion 2: Must verify"
        ],
        "commit": {
          "message_template": "feat(scope): description"
        }
      }
    ],
    "exploration_context": {
      "relevant_files": ["path/to/reference.ts"],
      "patterns": "Follow existing pattern in xxx"
    }
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

1. Read all `exploration_context.relevant_files` to understand existing patterns
2. Follow `task.implementation` steps in order
3. Apply changes to `task.modification_points` files
4. Follow `exploration_context.patterns` for code style consistency

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

Check all `task.acceptance` criteria are met:

```
## Verifying: [task.title]

**Acceptance Criteria**:
- [x] Criterion 1: Verified
- [x] Criterion 2: Verified
...

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

## Step 4: Report Solution Completion

After ALL tasks in the solution are complete, report to queue system:

```bash
ccw issue done <solution-id> --result '{
  "summary": "[What was accomplished]",
  "files_modified": ["path1", "path2", ...],
  "tasks_completed": N,
  "commits": [
    { "task_id": "T1", "hash": "abc123" },
    { "task_id": "T2", "hash": "def456" }
  ]
}'
```

**If any task failed and cannot be fixed:**

```bash
ccw issue done <solution-id> --fail --reason "Task [task.id] failed: [details]"
```

## Final Summary

When all tasks in solution are complete:

```markdown
## Solution Execution Complete

**Solution**: [solution_id]
**Issue**: [issue_id]
**Tasks Executed**: N/N

**All Commits**:
| # | Task ID | Task Title | Commit |
|---|---------|------------|--------|
| 1 | T1 | Task title | abc123 |
| 2 | T2 | Task title | def456 |

**Files Modified**:
- path/to/file1.ts
- path/to/file2.ts

**Summary**:
[Overall what was accomplished for this solution]
```

## Execution Rules

1. **Solution-aware** - Receive complete solution, iterate tasks internally
2. **Sequential within solution** - Complete each task (including commit) before moving to next
3. **Tests MUST pass** - Do not proceed to commit if tests fail
4. **Commit after each task** - Each task gets its own commit
5. **Self-verify** - All acceptance criteria must pass before commit
6. **Report accurately** - Use `ccw issue done` after all tasks complete
7. **Handle failures gracefully** - If a task fails, report via `ccw issue done --fail`

## Error Handling

| Situation | Action |
|-----------|--------|
| Solution not found | Report error, abort |
| Tests fail | Fix code, re-run tests |
| Verification fails | Go back to implement phase |
| Git commit fails | Check staging, retry commit |
| Unrecoverable error | Call `ccw issue done --fail`, report details |

## CLI Command Reference

| Command | Purpose |
|---------|---------|
| `ccw issue detail <id>` | Fetch full solution (READ-ONLY) |
| `ccw issue done <id>` | Mark solution complete |
| `ccw issue done <id> --fail` | Mark solution failed |

## Start Execution

When invoked by orchestrator with solution ID:

```bash
ccw issue detail <solution-id>
```

Then follow the task lifecycle for each task in `solution.tasks` until all complete.
