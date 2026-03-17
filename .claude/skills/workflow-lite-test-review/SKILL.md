---
name: workflow-lite-test-review
description: Post-execution test review and fix - chain from lite-execute or standalone. Reviews implementation against plan, runs tests, auto-fixes failures.
allowed-tools: Skill, Agent, AskUserQuestion, TodoWrite, Read, Write, Edit, Bash, Glob, Grep
---

# Workflow-Lite-Test-Review

Test review and fix engine for lite-execute chain or standalone invocation.

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

**Input Source**: `testReviewContext` global variable set by lite-execute Step 6

**Behavior**: Skip session discovery (already resolved), inherit review tool from execution chain, proceed directly to TR-Phase 1.

> **Note**: lite-execute Step 6 is the chain gate. Mode 1 invocation means execution is complete — proceed with test review.

### Mode 2: Standalone

**Trigger**: User calls with session path or `--last`

**Behavior**: Discover session → load plan + tasks → detect test tool → proceed to TR-Phase 1.

```javascript
// Session discovery
let sessionPath, plan, taskFiles, reviewTool

if (testReviewContext) {
  // Mode 1: from lite-execute chain
  sessionPath = testReviewContext.session.folder
  plan = testReviewContext.planObject
  taskFiles = testReviewContext.taskFiles.map(tf => JSON.parse(Read(tf.path)))
  reviewTool = testReviewContext.reviewTool || 'agent'
} else {
  // Mode 2: standalone
  const args = $ARGUMENTS
  if (args.includes('--last') || !args.trim() || args.trim() === '--skip-fix') {
    const sessions = Glob('.workflow/.lite-plan/*/plan.json')
    if (sessions.length === 0) {
      console.error('No lite-plan sessions found.')
      return
    }
    sessionPath = sessions[sessions.length - 1].replace(/[/\\]plan\.json$/, '')
  } else {
    sessionPath = args.replace(/--skip-fix|--last/g, '').trim()
  }
  plan = JSON.parse(Read(`${sessionPath}/plan.json`))
  taskFiles = plan.task_ids.map(id => JSON.parse(Read(`${sessionPath}/.task/${id}.json`)))
  reviewTool = 'agent'  // default for standalone
}

const skipFix = $ARGUMENTS?.includes('--skip-fix') || false
```

## Phase Summary

| Phase | Core Action | Output |
|-------|-------------|--------|
| TR-Phase 1 | Detect test framework + gather changes | testConfig |
| TR-Phase 2 | Review implementation against convergence criteria | reviewResults[] |
| TR-Phase 3 | Run tests + generate checklist | test-checklist.json |
| TR-Phase 4 | Auto-fix failures (iterative, max 3 rounds) | Fixed code + updated checklist |
| TR-Phase 5 | Output report + chain to session:sync | test-review.md |

## TR-Phase 0: Initialize

```javascript
const sessionId = sessionPath.split('/').pop()

TodoWrite({ todos: [
  { content: "TR-Phase 1: Detect & Gather", status: "in_progress", activeForm: "Detecting test framework" },
  { content: "TR-Phase 2: Review Convergence", status: "pending" },
  { content: "TR-Phase 3: Run Tests", status: "pending" },
  { content: "TR-Phase 4: Auto-Fix", status: "pending" },
  { content: "TR-Phase 5: Report & Sync", status: "pending" }
]})
```

## TR-Phase 1: Detect Test Framework & Gather Changes

```javascript
// Detect test framework
const hasPackageJson = Glob('package.json').length > 0
const hasPyproject = Glob('pyproject.toml').length > 0
const hasCargo = Glob('Cargo.toml').length > 0
const hasGoMod = Glob('go.mod').length > 0

let testConfig = { command: null, framework: null, type: null }

if (hasPackageJson) {
  const pkg = JSON.parse(Read('package.json'))
  const scripts = pkg.scripts || {}
  if (scripts.test) { testConfig = { command: 'npm test', framework: 'jest/vitest', type: 'node' } }
  else if (scripts['test:unit']) { testConfig = { command: 'npm run test:unit', framework: 'jest/vitest', type: 'node' } }
} else if (hasPyproject) {
  testConfig = { command: 'python -m pytest -v --tb=short', framework: 'pytest', type: 'python' }
} else if (hasCargo) {
  testConfig = { command: 'cargo test', framework: 'cargo-test', type: 'rust' }
} else if (hasGoMod) {
  testConfig = { command: 'go test ./...', framework: 'go-test', type: 'go' }
}

// Gather git changes
const changedFiles = Bash('git diff --name-only HEAD~5..HEAD 2>/dev/null || git diff --name-only HEAD')
  .split('\n').filter(Boolean)
const gitDiffStat = Bash('git diff --stat HEAD~5..HEAD 2>/dev/null || git diff --stat HEAD')

console.log(`Test Framework: ${testConfig.framework || 'unknown'} | Command: ${testConfig.command || 'none'}`)
console.log(`Changed Files: ${changedFiles.length}`)
```

// TodoWrite: Phase 1 → completed, Phase 2 → in_progress

## TR-Phase 2: Review Implementation Against Plan

For each task, verify convergence criteria using agent or CLI review tool.

**Agent Review** (reviewTool === 'agent', default):

```javascript
const reviewResults = []

for (const task of taskFiles) {
  const criteria = task.convergence?.criteria || []
  const testReqs = task.test || {}

  // Find actual changed files matching task scope
  const taskTargetFiles = (task.files || [])
    .map(f => f.path)
    .filter(p => changedFiles.some(c => c.includes(p) || p.includes(c)))

  // Read implementation to verify criteria
  const fileContents = taskTargetFiles.map(p => {
    try { return { path: p, content: Read(p) } }
    catch { return { path: p, content: null } }
  }).filter(f => f.content)

  const review = {
    taskId: task.id,
    title: task.title,
    criteria_met: [],
    criteria_unmet: [],
    test_gaps: [],
    files_reviewed: taskTargetFiles
  }

  // Agent evaluates each criterion against file contents
  for (const criterion of criteria) {
    // Check: does implementation satisfy this criterion?
    // Analyze file contents, look for expected patterns/functions/logic
    const met = /* agent evaluation based on fileContents */ true_or_false
    if (met) review.criteria_met.push(criterion)
    else review.criteria_unmet.push(criterion)
  }

  // Check test coverage gaps
  const hasTestFiles = changedFiles.some(f =>
    /test[_\-.]|spec[_\-.]|\/__tests__\/|\/tests\//.test(f)
  )
  if (testReqs.unit?.length > 0 && !hasTestFiles) {
    testReqs.unit.forEach(u => review.test_gaps.push({ type: 'unit', desc: u }))
  }
  if (testReqs.integration?.length > 0) {
    testReqs.integration.forEach(i => review.test_gaps.push({ type: 'integration', desc: i }))
  }

  reviewResults.push(review)
}
```

**CLI Review** (reviewTool === 'gemini' or 'codex'):

```javascript
if (reviewTool !== 'agent') {
  const reviewId = `${sessionId}-tr-review`
  Bash(`ccw cli -p "PURPOSE: Post-execution test review — verify convergence criteria met and identify test gaps
TASK: • Read plan.json and .task/*.json convergence criteria • For each criterion, check implementation in changed files • Identify missing unit/integration tests • List unmet criteria with file:line evidence
MODE: analysis
CONTEXT: @${sessionPath}/plan.json @${sessionPath}/.task/*.json @**/* | Memory: lite-execute completed, reviewing convergence
EXPECTED: Per-task verdict table (PASS/PARTIAL/FAIL) + unmet criteria list + test gap list
CONSTRAINTS: Read-only | Focus on convergence verification" --tool ${reviewTool} --mode analysis --id ${reviewId}`, { run_in_background: true })
  // STOP - wait for hook callback, then parse CLI output into reviewResults format
}
```

// TodoWrite: Phase 2 → completed, Phase 3 → in_progress

## TR-Phase 3: Run Tests & Generate Checklist

```javascript
// Build checklist structure
const testChecklist = {
  session: sessionId,
  plan_summary: plan.summary,
  generated_at: new Date().toISOString(),
  test_config: testConfig,
  tasks: reviewResults.map(review => {
    const task = taskFiles.find(t => t.id === review.taskId)
    const testReqs = task.test || {}
    return {
      task_id: review.taskId,
      title: review.title,
      status: review.criteria_unmet.length === 0 ? 'PASS'
        : review.criteria_met.length > 0 ? 'PARTIAL' : 'FAIL',
      convergence: { met: review.criteria_met, unmet: review.criteria_unmet },
      test_items: [
        ...(testReqs.unit || []).map(u => ({ type: 'unit', desc: u, status: 'pending' })),
        ...(testReqs.integration || []).map(i => ({ type: 'integration', desc: i, status: 'pending' })),
        ...(testReqs.success_metrics || []).map(m => ({ type: 'metric', desc: m, status: 'pending' })),
        ...review.test_gaps.map(g => ({ type: g.type, desc: g.desc, status: 'missing' }))
      ]
    }
  }),
  execution: null
}

// Run tests if framework detected
if (testConfig.command) {
  console.log(`Running: ${testConfig.command}`)
  const testResult = Bash(testConfig.command, { timeout: 300000 })

  const passed = /(\d+) passed/.test(testResult) || /PASSED/.test(testResult) || /ok \d+/.test(testResult)
  const failMatch = testResult.match(/(\d+) failed/)
  const hasFail = failMatch || /FAILED/.test(testResult) || /FAIL/.test(testResult)

  testChecklist.execution = {
    command: testConfig.command,
    timestamp: new Date().toISOString(),
    raw_output: testResult.slice(-3000),  // keep tail for error context
    overall: hasFail ? 'FAIL' : (passed ? 'PASS' : 'UNKNOWN'),
    fail_count: failMatch ? parseInt(failMatch[1]) : (hasFail ? -1 : 0)
  }

  console.log(`Result: ${testChecklist.execution.overall}`)
} else {
  console.log('No test command detected. Skipping test execution.')
}

Write(`${sessionPath}/test-checklist.json`, JSON.stringify(testChecklist, null, 2))
```

// TodoWrite: Phase 3 → completed, Phase 4 → in_progress

## TR-Phase 4: Auto-Fix Failures (Iterative)

**Skip if**: `skipFix === true` OR `testChecklist.execution?.overall !== 'FAIL'`

**Max iterations**: 3

```javascript
if (skipFix || !testChecklist.execution || testChecklist.execution.overall !== 'FAIL') {
  console.log(testChecklist.execution?.overall === 'PASS'
    ? 'All tests passed. Skipping fix phase.'
    : 'Skipping auto-fix (--skip-fix or no test execution).')
  // TodoWrite: Phase 4 → completed (skipped)
} else {
  let iteration = 0
  const MAX_ITERATIONS = 3

  while (iteration < MAX_ITERATIONS && testChecklist.execution.overall === 'FAIL') {
    iteration++
    console.log(`\n--- Fix Iteration ${iteration}/${MAX_ITERATIONS} ---`)

    // Use test-fix-agent for fixing
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

    // Re-run tests after fix
    const retestResult = Bash(testConfig.command, { timeout: 300000 })
    const hasFail = /failed|FAIL/.test(retestResult)

    testChecklist.execution = {
      command: testConfig.command,
      timestamp: new Date().toISOString(),
      raw_output: retestResult.slice(-3000),
      overall: hasFail ? 'FAIL' : 'PASS',
      fix_iteration: iteration
    }

    Write(`${sessionPath}/test-checklist.json`, JSON.stringify(testChecklist, null, 2))

    if (!hasFail) {
      console.log(`Tests passed after iteration ${iteration}.`)
      break
    }
  }

  if (testChecklist.execution.overall === 'FAIL') {
    console.log(`Tests still failing after ${MAX_ITERATIONS} iterations. Manual investigation needed.`)
  }
}
```

// TodoWrite: Phase 4 → completed, Phase 5 → in_progress

## TR-Phase 5: Report & Sync

> **CHECKPOINT**: This step is MANDATORY. Always generate report and trigger sync.

```javascript
// Generate markdown report
const report = `# Test Review Report

**Session**: ${sessionId}
**Summary**: ${plan.summary}
**Generated**: ${new Date().toISOString()}
**Test Framework**: ${testConfig.framework || 'unknown'}

## Task Verdicts

| Task | Status | Convergence | Test Items | Gaps |
|------|--------|-------------|------------|------|
${testChecklist.tasks.map(t =>
  `| ${t.task_id} | ${t.status} | ${t.convergence.met.length}/${t.convergence.met.length + t.convergence.unmet.length} | ${t.test_items.length} | ${t.test_items.filter(i => i.status === 'missing').length} |`
).join('\n')}

## Unmet Criteria

${testChecklist.tasks.filter(t => t.convergence.unmet.length > 0).map(t =>
  `### ${t.task_id}: ${t.title}\n${t.convergence.unmet.map(u => \`- [ ] \${u}\`).join('\n')}`
).join('\n\n') || 'All criteria met.'}

## Test Gaps

${testChecklist.tasks.flatMap(t => t.test_items.filter(i => i.status === 'missing')).map(i =>
  \`- [ ] (\${i.type}) \${i.desc}\`
).join('\n') || 'No gaps detected.'}

${testChecklist.execution ? `## Test Execution

**Command**: \\\`${testChecklist.execution.command}\\\`
**Result**: ${testChecklist.execution.overall}
${testChecklist.execution.fix_iteration ? `**Fixed in iteration**: ${testChecklist.execution.fix_iteration}` : ''}
` : '## Test Execution\n\nNo test framework detected.'}
`

Write(`${sessionPath}/test-review.md`, report)
console.log(`Report: ${sessionPath}/test-review.md`)
console.log(`Checklist: ${sessionPath}/test-checklist.json`)

// Chain to session:sync
Skill({ skill: "workflow:session:sync", args: `-y "Test review: ${testChecklist.execution?.overall || 'no-test'} — ${plan.summary}"` })
```

// TodoWrite: Phase 5 → completed

**Display summary**:
```javascript
console.log(`
── Test Review Complete ──
${testChecklist.tasks.map(t => {
  const icon = t.status === 'PASS' ? '[PASS]' : t.status === 'PARTIAL' ? '[PARTIAL]' : '[FAIL]'
  return `${icon} ${t.task_id}: ${t.title} (${t.convergence.met.length}/${t.convergence.met.length + t.convergence.unmet.length})`
}).join('\n')}
Test: ${testChecklist.execution?.overall || 'skipped'}${testChecklist.execution?.fix_iteration ? ` (fixed iter ${testChecklist.execution.fix_iteration})` : ''}
`)
```

## Data Structures

### testReviewContext (Input - Mode 1, set by lite-execute)

```javascript
{
  planObject: { /* same as executionContext.planObject */ },
  taskFiles: [{ id: string, path: string }],
  reviewTool: "agent" | "gemini" | "codex",   // inherited from lite-execute codeReviewTool
  executionResults: [...],                      // previousExecutionResults from lite-execute
  originalUserInput: string,
  session: {
    id: string,
    folder: string,
    artifacts: { plan: string, task_dir: string }
  }
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
├── test-checklist.json          # NEW: structured test results
└── test-review.md               # NEW: human-readable report
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
