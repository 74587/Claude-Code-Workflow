---
name: execute
description: Execute issue tasks with closed-loop methodology (analyze→implement→test→optimize→commit)
argument-hint: "<issue-id> [--task <task-id>] [--batch <n>]"
allowed-tools: TodoWrite(*), Task(*), Bash(*), Read(*), Write(*), Edit(*), AskUserQuestion(*)
---

# Issue Execute Command (/issue:execute)

## Overview

Execute tasks from a planned issue using closed-loop methodology. Each task goes through 5 phases: **Analyze → Implement → Test → Optimize → Commit**. Tasks are loaded progressively based on dependency satisfaction.

**Core capabilities:**
- Progressive task loading (only load ready tasks)
- Closed-loop execution with 5 phases per task
- Automatic retry on test failures (up to 3 attempts)
- Pause on defined pause_criteria conditions
- Delivery criteria verification before completion
- Automatic git commit per task

## Usage

```bash
/issue:execute <ISSUE_ID> [FLAGS]

# Arguments
<issue-id>            Issue ID (e.g., GH-123, TEXT-1735200000)

# Flags
--task <id>           Execute specific task only
--batch <n>           Max concurrent tasks (default: 1)
--skip-commit         Skip git commit phase
--dry-run             Simulate execution without changes
--continue            Continue from paused/failed state
```

## Execution Process

```
Initialization:
   ├─ Load state.json and tasks.jsonl
   ├─ Build completed task index
   └─ Identify ready tasks (dependencies satisfied)

Task Loop:
   └─ For each ready task:
       ├─ Phase 1: ANALYZE
       │   ├─ Verify task requirements
       │   ├─ Check file existence
       │   ├─ Validate preconditions
       │   └─ Check pause_criteria (halt if triggered)
       │
       ├─ Phase 2: IMPLEMENT
       │   ├─ Execute code changes
       │   ├─ Write/modify files
       │   └─ Track modified files
       │
       ├─ Phase 3: TEST
       │   ├─ Run relevant tests
       │   ├─ Verify functionality
       │   └─ Retry loop (max 3) on failure → back to IMPLEMENT
       │
       ├─ Phase 4: OPTIMIZE
       │   ├─ Code quality check
       │   ├─ Lint/format verification
       │   └─ Apply minor improvements
       │
       ├─ Phase 5: COMMIT
       │   ├─ Stage modified files
       │   ├─ Create commit with task reference
       │   └─ Update task status to 'completed'
       │
       └─ Update state.json

Completion:
   └─ Return execution summary
```

## Implementation

### Initialization

```javascript
// Load issue context
const issueDir = `.workflow/issues/${issueId}`
const state = JSON.parse(Read(`${issueDir}/state.json`))
const tasks = readJsonl(`${issueDir}/tasks.jsonl`)

// Build completed index
const completedIds = new Set(
  tasks.filter(t => t.status === 'completed').map(t => t.id)
)

// Get ready tasks (dependencies satisfied)
function getReadyTasks() {
  return tasks.filter(task =>
    task.status === 'pending' &&
    task.depends_on.every(dep => completedIds.has(dep))
  )
}

let readyTasks = getReadyTasks()
if (readyTasks.length === 0) {
  if (tasks.every(t => t.status === 'completed')) {
    console.log('✓ All tasks completed!')
    return
  }
  console.log('⚠ No ready tasks. Check dependencies or blocked tasks.')
  return
}

// Initialize TodoWrite for tracking
TodoWrite({
  todos: readyTasks.slice(0, batchSize).map(t => ({
    content: `[${t.id}] ${t.title}`,
    status: 'pending',
    activeForm: `Executing ${t.id}`
  }))
})
```

### Task Execution Loop

```javascript
for (const task of readyTasks.slice(0, batchSize)) {
  console.log(`\n## Executing: ${task.id} - ${task.title}`)

  // Update state
  updateTaskStatus(task.id, 'in_progress', 'analyze')

  try {
    // Phase 1: ANALYZE
    const analyzeResult = await executePhase_Analyze(task)
    if (analyzeResult.paused) {
      console.log(`⏸ Task paused: ${analyzeResult.reason}`)
      updateTaskStatus(task.id, 'paused', 'analyze')
      continue
    }

    // Phase 2-5: Closed Loop
    let implementRetries = 0
    const maxRetries = 3

    while (implementRetries < maxRetries) {
      // Phase 2: IMPLEMENT
      const implementResult = await executePhase_Implement(task, analyzeResult)
      updateTaskStatus(task.id, 'in_progress', 'test')

      // Phase 3: TEST
      const testResult = await executePhase_Test(task, implementResult)

      if (testResult.passed) {
        // Phase 4: OPTIMIZE
        await executePhase_Optimize(task, implementResult)

        // Phase 5: COMMIT
        if (!flags.skipCommit) {
          await executePhase_Commit(task, implementResult)
        }

        // Mark completed
        updateTaskStatus(task.id, 'completed', 'done')
        completedIds.add(task.id)
        break
      } else {
        implementRetries++
        console.log(`⚠ Test failed, retry ${implementRetries}/${maxRetries}`)
        if (implementRetries >= maxRetries) {
          updateTaskStatus(task.id, 'failed', 'test')
          console.log(`✗ Task failed after ${maxRetries} retries`)
        }
      }
    }
  } catch (error) {
    updateTaskStatus(task.id, 'failed', task.current_phase)
    console.log(`✗ Task failed: ${error.message}`)
  }
}
```

### Phase 1: ANALYZE

```javascript
async function executePhase_Analyze(task) {
  console.log('### Phase 1: ANALYZE')

  // Check pause criteria first
  for (const criterion of task.pause_criteria || []) {
    const shouldPause = await evaluatePauseCriterion(criterion, task)
    if (shouldPause) {
      return { paused: true, reason: criterion }
    }
  }

  // Execute analysis via CLI
  const analysisResult = await Task(
    subagent_type="cli-explore-agent",
    run_in_background=false,
    description=`Analyze: ${task.id}`,
    prompt=`
## Analysis Task
ID: ${task.id}
Title: ${task.title}
Description: ${task.description}

## File Context
${task.file_context.join('\n')}

## Delivery Criteria (to be achieved)
${task.delivery_criteria.map((c, i) => `${i+1}. ${c}`).join('\n')}

## Required Analysis
1. Verify all referenced files exist
2. Identify exact modification points
3. Check for potential conflicts
4. Validate approach feasibility

## Output
Return JSON:
{
  "files_to_modify": ["path1", "path2"],
  "integration_points": [...],
  "potential_risks": [...],
  "implementation_notes": "..."
}
`
  )

  // Parse and return
  const analysis = JSON.parse(analysisResult)

  // Update phase results
  updatePhaseResult(task.id, 'analyze', {
    status: 'completed',
    findings: analysis.potential_risks,
    timestamp: new Date().toISOString()
  })

  return { paused: false, analysis }
}
```

### Phase 2: IMPLEMENT

```javascript
async function executePhase_Implement(task, analyzeResult) {
  console.log('### Phase 2: IMPLEMENT')

  updateTaskStatus(task.id, 'in_progress', 'implement')

  // Determine executor
  const executor = task.executor === 'auto'
    ? (task.type === 'test' ? 'agent' : 'codex')
    : task.executor

  // Build implementation prompt
  const prompt = `
## Implementation Task
ID: ${task.id}
Title: ${task.title}
Type: ${task.type}

## Description
${task.description}

## Analysis Results
${JSON.stringify(analyzeResult.analysis, null, 2)}

## Files to Modify
${analyzeResult.analysis.files_to_modify.join('\n')}

## Delivery Criteria (MUST achieve all)
${task.delivery_criteria.map((c, i) => `- [ ] ${c}`).join('\n')}

## Implementation Notes
${analyzeResult.analysis.implementation_notes}

## Rules
- Follow existing code patterns
- Maintain backward compatibility
- Add appropriate error handling
- Document significant changes
`

  let result
  if (executor === 'codex') {
    result = Bash(
      `ccw cli -p "${escapePrompt(prompt)}" --tool codex --mode write`,
      timeout=3600000
    )
  } else if (executor === 'gemini') {
    result = Bash(
      `ccw cli -p "${escapePrompt(prompt)}" --tool gemini --mode write`,
      timeout=1800000
    )
  } else {
    result = await Task(
      subagent_type="code-developer",
      run_in_background=false,
      description=`Implement: ${task.id}`,
      prompt=prompt
    )
  }

  // Track modified files
  const modifiedFiles = extractModifiedFiles(result)

  updatePhaseResult(task.id, 'implement', {
    status: 'completed',
    files_modified: modifiedFiles,
    timestamp: new Date().toISOString()
  })

  return { modifiedFiles, output: result }
}
```

### Phase 3: TEST

```javascript
async function executePhase_Test(task, implementResult) {
  console.log('### Phase 3: TEST')

  updateTaskStatus(task.id, 'in_progress', 'test')

  // Determine test command based on project
  const testCommand = detectTestCommand(task.file_context)
  // e.g., 'npm test', 'pytest', 'go test', etc.

  // Run tests
  const testResult = Bash(testCommand, timeout=300000)
  const passed = testResult.exitCode === 0

  // Verify delivery criteria
  let criteriaVerified = passed
  if (passed) {
    for (const criterion of task.delivery_criteria) {
      const verified = await verifyCriterion(criterion, implementResult)
      if (!verified) {
        criteriaVerified = false
        console.log(`⚠ Criterion not met: ${criterion}`)
      }
    }
  }

  updatePhaseResult(task.id, 'test', {
    status: passed && criteriaVerified ? 'passed' : 'failed',
    test_results: testResult.output.substring(0, 1000),
    retry_count: implementResult.retryCount || 0,
    timestamp: new Date().toISOString()
  })

  return { passed: passed && criteriaVerified, output: testResult }
}
```

### Phase 4: OPTIMIZE

```javascript
async function executePhase_Optimize(task, implementResult) {
  console.log('### Phase 4: OPTIMIZE')

  updateTaskStatus(task.id, 'in_progress', 'optimize')

  // Run linting/formatting
  const lintResult = Bash('npm run lint:fix || true', timeout=60000)

  // Quick code review
  const reviewResult = await Task(
    subagent_type="universal-executor",
    run_in_background=false,
    description=`Review: ${task.id}`,
    prompt=`
Quick code review for task ${task.id}

## Modified Files
${implementResult.modifiedFiles.join('\n')}

## Check
1. Code follows project conventions
2. No obvious security issues
3. Error handling is appropriate
4. No dead code or console.logs

## Output
If issues found, apply fixes directly. Otherwise confirm OK.
`
  )

  updatePhaseResult(task.id, 'optimize', {
    status: 'completed',
    improvements: extractImprovements(reviewResult),
    timestamp: new Date().toISOString()
  })

  return { lintResult, reviewResult }
}
```

### Phase 5: COMMIT

```javascript
async function executePhase_Commit(task, implementResult) {
  console.log('### Phase 5: COMMIT')

  updateTaskStatus(task.id, 'in_progress', 'commit')

  // Stage modified files
  for (const file of implementResult.modifiedFiles) {
    Bash(`git add "${file}"`)
  }

  // Create commit message
  const typePrefix = {
    'feature': 'feat',
    'bug': 'fix',
    'refactor': 'refactor',
    'test': 'test',
    'chore': 'chore',
    'docs': 'docs'
  }[task.type] || 'feat'

  const commitMessage = `${typePrefix}(${task.id}): ${task.title}

${task.description.substring(0, 200)}

Delivery Criteria:
${task.delivery_criteria.map(c => `- [x] ${c}`).join('\n')}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`

  // Commit
  const commitResult = Bash(`git commit -m "$(cat <<'EOF'
${commitMessage}
EOF
)"`)

  // Get commit hash
  const commitHash = Bash('git rev-parse HEAD').trim()

  updatePhaseResult(task.id, 'commit', {
    status: 'completed',
    commit_hash: commitHash,
    message: `${typePrefix}(${task.id}): ${task.title}`,
    timestamp: new Date().toISOString()
  })

  console.log(`✓ Committed: ${commitHash.substring(0, 7)}`)

  return { commitHash }
}
```

### State Management

```javascript
// Update task status in JSONL (append-style with compaction)
function updateTaskStatus(taskId, status, phase) {
  const tasks = readJsonl(`${issueDir}/tasks.jsonl`)
  const taskIndex = tasks.findIndex(t => t.id === taskId)

  if (taskIndex >= 0) {
    tasks[taskIndex].status = status
    tasks[taskIndex].current_phase = phase
    tasks[taskIndex].updated_at = new Date().toISOString()

    // Rewrite JSONL (compact)
    const jsonlContent = tasks.map(t => JSON.stringify(t)).join('\n')
    Write(`${issueDir}/tasks.jsonl`, jsonlContent)
  }

  // Update state.json
  const state = JSON.parse(Read(`${issueDir}/state.json`))
  state.current_task = status === 'in_progress' ? taskId : null
  state.completed_count = tasks.filter(t => t.status === 'completed').length
  state.updated_at = new Date().toISOString()
  Write(`${issueDir}/state.json`, JSON.stringify(state, null, 2))
}

// Update phase result
function updatePhaseResult(taskId, phase, result) {
  const tasks = readJsonl(`${issueDir}/tasks.jsonl`)
  const taskIndex = tasks.findIndex(t => t.id === taskId)

  if (taskIndex >= 0) {
    tasks[taskIndex].phase_results = tasks[taskIndex].phase_results || {}
    tasks[taskIndex].phase_results[phase] = result

    const jsonlContent = tasks.map(t => JSON.stringify(t)).join('\n')
    Write(`${issueDir}/tasks.jsonl`, jsonlContent)
  }
}
```

## Progressive Loading

For memory efficiency with large task lists:

```javascript
// Stream JSONL and only load ready tasks
function* getReadyTasksStream(issueDir, completedIds) {
  const filePath = `${issueDir}/tasks.jsonl`
  const lines = readFileLines(filePath)

  for (const line of lines) {
    if (!line.trim()) continue
    const task = JSON.parse(line)

    if (task.status === 'pending' &&
        task.depends_on.every(dep => completedIds.has(dep))) {
      yield task
    }
  }
}

// Usage: Only load what's needed
const iterator = getReadyTasksStream(issueDir, completedIds)
const batch = []
for (let i = 0; i < batchSize; i++) {
  const { value, done } = iterator.next()
  if (done) break
  batch.push(value)
}
```

## Pause Criteria Evaluation

```javascript
async function evaluatePauseCriterion(criterion, task) {
  // Pattern matching for common pause conditions
  const patterns = [
    { match: /unclear|undefined|missing/i, action: 'ask_user' },
    { match: /security review/i, action: 'require_approval' },
    { match: /migration required/i, action: 'check_migration' },
    { match: /external (api|service)/i, action: 'verify_external' }
  ]

  for (const pattern of patterns) {
    if (pattern.match.test(criterion)) {
      // Check if condition is resolved
      const resolved = await checkCondition(pattern.action, criterion, task)
      if (!resolved) return true // Pause
    }
  }

  return false // Don't pause
}
```

## Error Handling

| Error | Resolution |
|-------|------------|
| Task not found | List available tasks, suggest correct ID |
| Dependencies unsatisfied | Show blocking tasks, suggest running those first |
| Test failure (3x) | Mark failed, save state, suggest manual intervention |
| Pause triggered | Save state, display pause reason, await user action |
| Commit conflict | Stash changes, report conflict, await resolution |

## Output

```
## Execution Complete

**Issue**: GH-123
**Tasks Executed**: 3/5
**Completed**: 3
**Failed**: 0
**Pending**: 2 (dependencies not met)

### Task Status
| ID | Title | Status | Phase | Commit |
|----|-------|--------|-------|--------|
| TASK-001 | Setup auth middleware | ✓ | done | a1b2c3d |
| TASK-002 | Protect API routes | ✓ | done | e4f5g6h |
| TASK-003 | Add login endpoint | ✓ | done | i7j8k9l |
| TASK-004 | Add logout endpoint | ⏳ | pending | - |
| TASK-005 | Integration tests | ⏳ | pending | - |

### Next Steps
Run `/issue:execute GH-123` to continue with remaining tasks.
```

## Related Commands

- `/issue:plan` - Create issue plan with JSONL tasks
- `ccw issue status` - Check issue execution status
- `ccw issue retry` - Retry failed tasks
