---
name: workflow-lite-test-review
description: Post-execution test review and fix - chain from lite-execute or standalone. Reviews implementation against plan, runs tests, auto-fixes failures.
allowed-tools: Skill, Agent, AskUserQuestion, TodoWrite, Read, Write, Edit, Bash, Glob, Grep
---

# Workflow-Lite-Test-Review

Test review and fix engine for lite-execute chain or standalone invocation.

**Project Context**: Run `ccw spec load --category test` for test framework conventions, coverage targets, and fixtures.

---

## Usage

```
<session-path|--last>      Session path or auto-detect last session (required for standalone)
```

| Flag | Description |
|------|-------------|
| `--in-memory` | Mode 1: Chain from lite-execute via `testReviewContext` global variable |
| `--skip-fix` | Review only, do not auto-fix failures |

## Input Modes

### Mode 1: In-Memory Chain (from lite-execute)

**Trigger**: `--in-memory` flag or `testReviewContext` global variable available

**Input Source**: `testReviewContext` global variable set by lite-execute Step 4

**Behavior**: Skip session discovery, inherit reviewTool from execution chain, proceed directly to TR-Phase 1.

> **Note**: lite-execute Step 4 is the chain gate. Mode 1 invocation means execution is complete — proceed with test review.

### Mode 2: Standalone

**Trigger**: User calls with session path or `--last`

**Behavior**: Discover session → load plan + tasks → `reviewTool = 'agent'` → proceed to TR-Phase 1.

```javascript
let sessionPath, plan, taskFiles, reviewTool

if (testReviewContext) {
  // Mode 1: from lite-execute chain
  sessionPath = testReviewContext.session.folder
  plan = testReviewContext.planObject
  taskFiles = testReviewContext.taskFiles.map(tf => JSON.parse(Read(tf.path)))
  reviewTool = testReviewContext.reviewTool || 'agent'
} else {
  // Mode 2: standalone — find last session or use provided path
  sessionPath = resolveSessionPath($ARGUMENTS)  // Glob('.workflow/.lite-plan/*/plan.json'), take last
  plan = JSON.parse(Read(`${sessionPath}/plan.json`))
  taskFiles = plan.task_ids.map(id => JSON.parse(Read(`${sessionPath}/.task/${id}.json`)))
  reviewTool = 'agent'
}

const skipFix = $ARGUMENTS?.includes('--skip-fix') || false
```

## Phase Summary

| Phase | Core Action | Output |
|-------|-------------|--------|
| TR-Phase 1 | Detect test framework + gather changes | testConfig, changedFiles |
| TR-Phase 2 | Review implementation against convergence criteria | reviewResults[] |
| TR-Phase 3 | Run tests + generate checklist | test-checklist.json |
| TR-Phase 4 | Auto-fix failures (iterative, max 3 rounds) | Fixed code + updated checklist |
| TR-Phase 5 | Output report + chain to session:sync | test-review.md |

## TR-Phase 0: Initialize

Set `sessionId` from sessionPath. Create TodoWrite with 5 phases (Phase 1 = in_progress, rest = pending).

## TR-Phase 1: Detect Test Framework & Gather Changes

**Test framework detection** (check in order, first match wins):

| File | Framework | Command |
|------|-----------|---------|
| `package.json` with `scripts.test` | jest/vitest | `npm test` |
| `package.json` with `scripts['test:unit']` | jest/vitest | `npm run test:unit` |
| `pyproject.toml` | pytest | `python -m pytest -v --tb=short` |
| `Cargo.toml` | cargo-test | `cargo test` |
| `go.mod` | go-test | `go test ./...` |

**Gather git changes**: `git diff --name-only HEAD~5..HEAD` → `changedFiles[]`

Output: `testConfig = { command, framework, type }` + `changedFiles[]`

// TodoWrite: Phase 1 → completed, Phase 2 → in_progress

## TR-Phase 2: Review Implementation Against Plan

**Skip if**: `reviewTool === 'skip'`  — set all tasks to PASS, proceed to Phase 3.

For each task, verify convergence criteria and identify test gaps.

**Agent Review** (reviewTool === 'agent', default):

For each task in taskFiles:
1. Extract `convergence.criteria[]` and `test` requirements
2. Find changed files matching `task.files[].path` against `changedFiles`
3. Read matched files, evaluate each criterion against implementation
4. Check test coverage: if `task.test.unit` exists but no test files in changedFiles → mark as test gap
5. Same for `task.test.integration`
6. Build `reviewResult = { taskId, title, criteria_met[], criteria_unmet[], test_gaps[], files_reviewed[] }`

**CLI Review** (reviewTool === 'gemini' or 'codex'):

```javascript
const reviewId = `${sessionId}-tr-review`
Bash(`ccw cli -p "PURPOSE: Post-execution test review — verify convergence criteria met and identify test gaps
TASK: • Read plan.json and .task/*.json convergence criteria • For each criterion, check implementation in changed files • Identify missing unit/integration tests • List unmet criteria with file:line evidence
MODE: analysis
CONTEXT: @${sessionPath}/plan.json @${sessionPath}/.task/*.json @**/* | Memory: lite-execute completed, reviewing convergence
EXPECTED: Per-task verdict table (PASS/PARTIAL/FAIL) + unmet criteria list + test gap list
CONSTRAINTS: Read-only | Focus on convergence verification" --tool ${reviewTool} --mode analysis --id ${reviewId}`, { run_in_background: true })
// STOP - wait for hook callback, then parse CLI output into reviewResults format
```

// TodoWrite: Phase 2 → completed, Phase 3 → in_progress

## TR-Phase 3: Run Tests & Generate Checklist

**Build checklist** from reviewResults:
- Per task: status = `PASS` (all criteria met) / `PARTIAL` (some met) / `FAIL` (none met)
- Collect test_items from `task.test.unit[]`, `task.test.integration[]`, `task.test.success_metrics[]` + review test_gaps

**Run tests** if `testConfig.command` exists:
- Execute with 5min timeout
- Parse output: detect passed/failed patterns → `overall: 'PASS' | 'FAIL' | 'UNKNOWN'`

**Write** `${sessionPath}/test-checklist.json`

// TodoWrite: Phase 3 → completed, Phase 4 → in_progress

## TR-Phase 4: Auto-Fix Failures (Iterative)

**Skip if**: `skipFix === true` OR `testChecklist.execution?.overall !== 'FAIL'`

**Max iterations**: 3. Each iteration:

1. Delegate to test-fix-agent:

```javascript
Agent({
  subagent_type: "test-fix-agent",
  run_in_background: false,
  description: `Fix tests (iter ${iteration})`,
  prompt: `## Test Fix Iteration ${iteration}/${MAX_ITERATIONS}

**Test Command**: ${testConfig.command}
**Framework**: ${testConfig.framework}
**Session**: ${sessionPath}

### Failing Output (last 3000 chars)
\`\`\`
${testChecklist.execution.raw_output}
\`\`\`

### Plan Context
**Summary**: ${plan.summary}
**Tasks**: ${taskFiles.map(t => `${t.id}: ${t.title}`).join(' | ')}

### Instructions
1. Analyze test failure output to identify root cause
2. Fix the SOURCE CODE (not tests) unless tests themselves are wrong
3. Run \`${testConfig.command}\` to verify fix
4. If fix introduces new failures, revert and try alternative approach
5. Return: what was fixed, which files changed, test result after fix`
})
```

2. Re-run `testConfig.command` → update `testChecklist.execution`
3. Write updated `test-checklist.json`
4. Break if tests pass; continue if still failing

If still failing after 3 iterations → log "Manual investigation needed"

// TodoWrite: Phase 4 → completed, Phase 5 → in_progress

## TR-Phase 5: Report & Sync

> **CHECKPOINT**: This step is MANDATORY. Always generate report and trigger sync.

**Generate `test-review.md`** with sections:
- Header: session, summary, timestamp, framework
- **Task Verdicts** table: task_id | status | convergence (met/total) | test_items | gaps
- **Unmet Criteria**: per-task checklist of unmet items
- **Test Gaps**: list of missing unit/integration tests
- **Test Execution**: command, result, fix iteration (if applicable)

**Write** `${sessionPath}/test-review.md`

**Chain to session:sync**:
```javascript
Skill({ skill: "workflow:session:sync", args: `-y "Test review: ${testChecklist.execution?.overall || 'no-test'} — ${plan.summary}"` })
```

// TodoWrite: Phase 5 → completed

**Display summary**: Per-task verdict with [PASS]/[PARTIAL]/[FAIL] icons, convergence ratio, overall test result.

## Data Structures

### testReviewContext (Input - Mode 1, set by lite-execute)

```javascript
{
  planObject: { /* same as executionContext.planObject */ },
  taskFiles: [{ id: string, path: string }],
  reviewTool: "skip" | "agent" | "gemini" | "codex",
  executionResults: [...],
  originalUserInput: string,
  session: {
    id: string,
    folder: string,
    artifacts: { plan: string, task_dir: string }
  }
}
```

### testChecklist (Output artifact)

```javascript
{
  session: string,
  plan_summary: string,
  generated_at: string,
  test_config: { command, framework, type },
  tasks: [{
    task_id: string,
    title: string,
    status: "PASS" | "PARTIAL" | "FAIL",
    convergence: { met: string[], unmet: string[] },
    test_items: [{ type: "unit"|"integration"|"metric", desc: string, status: "pending"|"missing" }]
  }],
  execution: {
    command: string,
    timestamp: string,
    raw_output: string,       // last 3000 chars
    overall: "PASS" | "FAIL" | "UNKNOWN",
    fix_iteration?: number
  } | null
}
```

## Session Folder Structure (after test-review)

```
.workflow/.lite-plan/{session-id}/
├── exploration-*.json
├── explorations-manifest.json
├── planning-context.md
├── plan.json
├── .task/TASK-*.json
├── test-checklist.json          # structured test results
└── test-review.md               # human-readable report
```

## Error Handling

| Error | Resolution |
|-------|------------|
| No session found | "No lite-plan sessions found. Run lite-plan first." |
| Missing plan.json | "Invalid session: missing plan.json at {path}" |
| No test framework | Skip TR-Phase 3 execution, still generate review report |
| Test timeout | Capture partial output, report as FAIL |
| Fix agent fails | Log iteration, continue to next or stop at max |
| Sync fails | Log warning, do not block report generation |
