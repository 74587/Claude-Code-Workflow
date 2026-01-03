---
description: Execute all solutions from issue queue with git commit after each task
argument-hint: "[--worktree] [--queue <queue-id>]"
---

# Issue Execute (Codex Version)

## Core Principle

**Serial Execution**: Execute solutions ONE BY ONE from the issue queue via `ccw issue next`. For each solution, complete all tasks sequentially (implement → test → commit per task). Continue autonomously until queue is empty.

## Worktree Mode (Recommended for Parallel Execution)

When `--worktree` is specified, create a separate git worktree to isolate work.

**⚠️ IMPORTANT**: `ccw issue` commands MUST run from the **main repo directory**, NOT inside the worktree. The `.workflow/issues/` directory only exists in the main repo.

```bash
# Step 0: Setup worktree before starting (run from MAIN REPO)

# Use absolute paths to avoid issues when running from subdirectories
REPO_ROOT=$(git rev-parse --show-toplevel)
WORKTREE_BASE="${REPO_ROOT}/.ccw/worktrees"
WORKTREE_NAME="issue-exec-$(date +%Y%m%d-%H%M%S)"
WORKTREE_PATH="${WORKTREE_BASE}/${WORKTREE_NAME}"

# Ensure worktree base directory exists (gitignored)
mkdir -p "${WORKTREE_BASE}"

# Prune stale worktrees from previous interrupted executions
git worktree prune

# Create worktree from current branch
git worktree add "${WORKTREE_PATH}" -b "${WORKTREE_NAME}"

# Setup cleanup trap for graceful failure handling
cleanup_worktree() {
  echo "Cleaning up worktree due to interruption..."
  cd "${REPO_ROOT}" 2>/dev/null || true
  git worktree remove "${WORKTREE_PATH}" --force 2>/dev/null || true
  # Keep branch for debugging failed executions
  echo "Worktree removed. Branch '${WORKTREE_NAME}' kept for inspection."
}
trap cleanup_worktree EXIT INT TERM

# IMPORTANT: Fetch solution BEFORE entering worktree (ccw needs .workflow/)
SOLUTION_JSON=$(ccw issue next)

# NOW change to worktree directory for implementation
cd "${WORKTREE_PATH}"

# Execute implementation in isolated worktree...
```

**Worktree Execution Pattern**:
```
1. [MAIN REPO] ccw issue next → get solution JSON
2. [MAIN REPO] cd to worktree
3. [WORKTREE]  Implement all tasks, run tests, git commit
4. [WORKTREE]  cd back to main repo
5. [MAIN REPO] ccw issue done <item_id> → report completion
6. Repeat from step 1
```

**Note**: Add `.ccw/worktrees/` to `.gitignore` to prevent tracking worktree contents.

**Benefits:**
- Parallel executors don't conflict with each other
- Main working directory stays clean
- Easy cleanup after execution

**Completion - User Choice:**

When all solutions are complete, ask user what to do with the worktree branch:

```javascript
AskUserQuestion({
  questions: [{
    question: "All solutions completed in worktree. What would you like to do with the changes?",
    header: "Merge",
    multiSelect: false,
    options: [
      {
        label: "Merge to main",
        description: "Merge worktree branch into main branch and cleanup"
      },
      {
        label: "Create PR",
        description: "Push branch and create a pull request for review"
      },
      {
        label: "Keep branch",
        description: "Keep the branch for manual handling, cleanup worktree only"
      }
    ]
  }]
})
```

**Based on user selection:**

```bash
# Disable cleanup trap before intentional cleanup
trap - EXIT INT TERM

# Return to main repo first (use REPO_ROOT from setup)
cd "${REPO_ROOT}"

# Validate main repo state before merge (prevents conflicts)
validate_main_clean() {
  if [[ -n $(git status --porcelain) ]]; then
    echo "⚠️ Warning: Main repo has uncommitted changes."
    echo "Cannot auto-merge. Falling back to 'Create PR' option."
    return 1
  fi
  return 0
}

# Option 1: Merge to main (only if main is clean)
if validate_main_clean; then
  git merge "${WORKTREE_NAME}" --no-ff -m "Merge issue queue execution: ${WORKTREE_NAME}"
  git worktree remove "${WORKTREE_PATH}"
  git branch -d "${WORKTREE_NAME}"
else
  # Fallback to PR if main is dirty
  git push -u origin "${WORKTREE_NAME}"
  gh pr create --title "Issue Queue: ${WORKTREE_NAME}" --body "Automated issue queue execution (main had uncommitted changes)"
  git worktree remove "${WORKTREE_PATH}"
fi

# Option 2: Create PR (Recommended for parallel execution)
git push -u origin "${WORKTREE_NAME}"
gh pr create --title "Issue Queue: ${WORKTREE_NAME}" --body "Automated issue queue execution"
git worktree remove "${WORKTREE_PATH}"
# Branch kept on remote

# Option 3: Keep branch
git worktree remove "${WORKTREE_PATH}"
# Branch kept locally for manual handling
echo "Branch '${WORKTREE_NAME}' kept. Merge manually when ready."
```

**Parallel Execution Safety**: For parallel executors, "Create PR" is the safest option as it avoids race conditions during merge. Multiple PRs can be reviewed and merged sequentially.

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

Run this command to get your first solution (**must run from main repo**):

```javascript
// Fetch solution from main repo (not worktree)
const result = shell_command({
  command: "ccw issue next",
  workdir: REPO_ROOT  // Main repo path, NOT worktree
})
```

This returns JSON with the full solution definition:
- `item_id`: Solution identifier in queue (e.g., "S-1")
- `issue_id`: Parent issue ID (e.g., "ISS-20251227-001")
- `solution_id`: Solution ID (e.g., "SOL-ISS-20251227-001-1")
- `solution`: Full solution with all tasks
- `execution_hints`: Timing and executor hints

If response contains `{ "status": "empty" }`, all solutions are complete - skip to final summary.

## Step 2: Parse Solution Response

Expected solution structure:

```json
{
  "item_id": "S-1",
  "issue_id": "ISS-20251227-001",
  "solution_id": "SOL-ISS-20251227-001-1",
  "status": "pending",
  "solution": {
    "id": "SOL-ISS-20251227-001-1",
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

## Step 2.5: Initialize Task Tracking

After parsing solution, use `update_plan` to track each task:

```javascript
// Initialize plan with all tasks from solution
update_plan({
  explanation: `Starting solution ${item_id}`,
  plan: solution.tasks.map(task => ({
    step: `${task.id}: ${task.title}`,
    status: "pending"
  }))
})
```

**Note**: Codex uses `update_plan` tool for task tracking (not TodoWrite).

## Step 3: Execute Tasks Sequentially

Iterate through `solution.tasks` array and execute each task.

**Before starting each task**, mark it as in_progress:
```javascript
// Update current task status
update_plan({
  explanation: `Working on ${task.id}: ${task.title}`,
  plan: tasks.map(t => ({
    step: `${t.id}: ${t.title}`,
    status: t.id === task.id ? "in_progress" : (t.completed ? "completed" : "pending")
  }))
})
```

**After completing each task** (commit done), mark it as completed:
```javascript
// Mark task as completed
update_plan({
  explanation: `Completed ${task.id}: ${task.title}`,
  plan: tasks.map(t => ({
    step: `${t.id}: ${t.title}`,
    status: t.id === task.id ? "completed" : t.status
  }))
})
```

### Phase A: IMPLEMENT

1. **Read context files in parallel** using `multi_tool_use.parallel`:
```javascript
// Read all relevant files in parallel for context
multi_tool_use.parallel({
  tool_uses: solution.exploration_context.relevant_files.map(file => ({
    recipient_name: "functions.read_file",
    parameters: { path: file }
  }))
})
```

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

After ALL tasks in the solution are complete, report to queue system (**must run from main repo**):

```javascript
// Report completion from main repo (not worktree)
shell_command({
  command: `ccw issue done ${item_id} --result '${JSON.stringify({
    files_modified: ["path1", "path2"],
    tests_passed: true,
    acceptance_passed: true,
    committed: true,
    commits: [
      { task_id: "T1", hash: "abc123" },
      { task_id: "T2", hash: "def456" }
    ],
    summary: "[What was accomplished]"
  })}'`,
  workdir: REPO_ROOT  // Main repo path, NOT worktree
})
```

**If solution failed and cannot be fixed:**

```javascript
// Report failure from main repo
shell_command({
  command: `ccw issue done ${item_id} --fail --reason '{"task_id": "TX", "error_type": "test_failure", "message": "..."}'`,
  workdir: REPO_ROOT
})
```

## Step 5: Continue to Next Solution

Fetch next solution (**must run from main repo**):

```javascript
// Fetch next solution from main repo
const result = shell_command({
  command: "ccw issue next",
  workdir: REPO_ROOT
})
```

**Output progress:**
```
✓ [N/M] Completed: [item_id] - [solution.approach]
→ Fetching next solution...
```

**DO NOT STOP.** Return to Step 2 and continue until queue is empty.

## Final Summary

When `ccw issue next` returns `{ "status": "empty" }`:

**If running in worktree mode**: Prompt user for merge/PR/keep choice (see "Completion - User Choice" above) before outputting summary.

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
9. **Track with update_plan** - Use update_plan tool for task progress tracking
10. **Worktree ccw commands** - Run `ccw issue next/done` from main repo, NOT worktree

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
| `ccw issue next` | Fetch next solution from queue (auto-selects from active queues) |
| `ccw issue next --queue QUE-xxx` | Fetch from specific queue |
| `ccw issue done <id>` | Mark solution complete with result (auto-detects queue) |
| `ccw issue done <id> --fail --reason "..."` | Mark solution failed with structured reason |
| `ccw issue retry --queue QUE-xxx` | Reset failed items in specific queue |

## Start Execution

Begin by running:

```bash
ccw issue next
```

Then follow the solution lifecycle for each solution until queue is empty.
