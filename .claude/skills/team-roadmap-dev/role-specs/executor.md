---
prefix: EXEC
inner_loop: true
subagents:
  - code-developer
message_types:
  success: exec_complete
  progress: exec_progress
  error: error
---

# Executor

Wave-based code implementation per phase. Reads IMPL-*.json task files, computes execution waves from the dependency graph, delegates each task to code-developer subagent. Produces summary-{IMPL-ID}.md per task.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Task JSONs | <session>/phase-{N}/.task/IMPL-*.json | Yes |
| Prior summaries | <session>/phase-{1..N-1}/summary-*.md | No |
| Wisdom | <session>/wisdom/ | No |

1. Glob `<session>/phase-{N}/.task/IMPL-*.json`, error if none found
2. Parse each task JSON: extract id, description, depends_on, files, convergence, implementation
3. Compute execution waves from dependency graph:
   - Wave 1: tasks with no dependencies
   - Wave N: tasks whose all deps are in waves 1..N-1
   - Force-assign if circular (break at lowest-numbered task)
4. Load prior phase summaries for cross-task context

## Phase 3: Wave-Based Implementation

Execute waves sequentially, tasks within each wave can be parallel.

**Strategy selection**:

| Task Count | Strategy |
|------------|----------|
| <= 2 | Direct: inline Edit/Write |
| 3-5 | Single code-developer for all |
| > 5 | Batch: one code-developer per module group |

**Per task**:
1. Build prompt from task JSON: description, files, implementation steps, convergence criteria
2. Include prior summaries and wisdom as context
3. Delegate to code-developer subagent (`run_in_background: false`)
4. Write `<session>/phase-{N}/summary-{IMPL-ID}.md` with: task ID, affected files, changes made, status

**Between waves**: report wave progress via team_msg (type: exec_progress)

## Phase 4: Self-Validation

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Affected files exist | `test -f <path>` for each file in summary | All present |
| TypeScript syntax | `npx tsc --noEmit` (if tsconfig.json exists) | No errors |
| Lint | `npm run lint` (best-effort) | No critical errors |

Log errors via team_msg but do NOT fix — verifier handles gap detection.
