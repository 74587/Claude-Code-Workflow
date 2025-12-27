---
description: Execute issue queue tasks sequentially with git commit after each task
argument-hint: "[--dry-run]"
---

# Issue Execute (Codex Version)

## Core Principle

**Serial Execution**: Execute tasks ONE BY ONE from the issue queue. Complete each task fully (implement → test → commit) before moving to next. Continue autonomously until ALL tasks complete or queue is empty.

## Execution Flow

```
INIT: Fetch first task via ccw issue next

WHILE task exists:
  1. Receive task JSON from ccw issue next
  2. Execute full lifecycle:
     - IMPLEMENT: Follow task.implementation steps
     - TEST: Run task.test commands
     - VERIFY: Check task.acceptance criteria
     - COMMIT: Stage files, commit with task.commit.message_template
  3. Report completion via ccw issue complete <item_id>
  4. Fetch next task via ccw issue next

WHEN queue empty:
  Output final summary
```

## Step 1: Fetch First Task

Run this command to get your first task:

```bash
ccw issue next
```

This returns JSON with the full task definition:
- `item_id`: Unique task identifier in queue (e.g., "T-1")
- `issue_id`: Parent issue ID (e.g., "ISSUE-20251227-001")
- `task`: Full task definition with implementation steps
- `context`: Relevant files and patterns
- `execution_hints`: Timing and executor hints

If response contains `{ "status": "empty" }`, all tasks are complete - skip to final summary.

## Step 2: Parse Task Response

Expected task structure:

```json
{
  "item_id": "T-1",
  "issue_id": "ISSUE-20251227-001",
  "solution_id": "SOL-001",
  "task": {
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
  },
  "context": {
    "relevant_files": ["path/to/reference.ts"],
    "patterns": "Follow existing pattern in xxx"
  }
}
```

## Step 3: Execute Task Lifecycle

### Phase A: IMPLEMENT

1. Read all `context.relevant_files` to understand existing patterns
2. Follow `task.implementation` steps in order
3. Apply changes to `task.modification_points` files
4. Follow `context.patterns` for code style consistency

**Output format:**
```
## Implementing: [task.title]

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

After all phases pass, commit the changes:

```bash
# Stage all modified files
git add path/to/file1.ts path/to/file2.ts ...

# Commit with task message template
git commit -m "$(cat <<'EOF'
[task.commit.message_template]

Item-ID: [item_id]
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

## Step 4: Report Completion

After commit succeeds, report to queue system:

```bash
ccw issue complete [item_id] --result '{
  "files_modified": ["path1", "path2"],
  "tests_passed": true,
  "acceptance_passed": true,
  "committed": true,
  "commit_hash": "[actual hash]",
  "summary": "[What was accomplished]"
}'
```

**If task failed and cannot be fixed:**

```bash
ccw issue fail [item_id] --reason "Phase [X] failed: [details]"
```

## Step 5: Continue to Next Task

Immediately fetch the next task:

```bash
ccw issue next
```

**Output progress:**
```
✓ [N/M] Completed: [item_id] - [task.title]
→ Fetching next task...
```

**DO NOT STOP.** Return to Step 2 and continue until queue is empty.

## Final Summary

When `ccw issue next` returns `{ "status": "empty" }`:

```markdown
## Issue Queue Execution Complete

**Total Tasks Executed**: N
**All Commits**:
| # | Item ID | Task | Commit |
|---|---------|------|--------|
| 1 | T-1 | Task title | abc123 |
| 2 | T-2 | Task title | def456 |

**Files Modified**:
- path/to/file1.ts
- path/to/file2.ts

**Summary**:
[Overall what was accomplished]
```

## Execution Rules

1. **Never stop mid-queue** - Continue until queue is empty
2. **One task at a time** - Fully complete (including commit) before moving on
3. **Tests MUST pass** - Do not proceed to commit if tests fail
4. **Commit after each task** - Each task gets its own commit
5. **Self-verify** - All acceptance criteria must pass before commit
6. **Report accurately** - Use ccw issue complete/fail after each task
7. **Handle failures gracefully** - If a task fails, report via ccw issue fail and continue to next

## Error Handling

| Situation | Action |
|-----------|--------|
| ccw issue next returns empty | All done - output final summary |
| Tests fail | Fix code, re-run tests |
| Verification fails | Go back to implement phase |
| Git commit fails | Check staging, retry commit |
| ccw issue complete fails | Log error, continue to next task |
| Unrecoverable error | Call ccw issue fail, continue to next |

## Start Execution

Begin by running:

```bash
ccw issue next
```

Then follow the lifecycle for each task until queue is empty.
