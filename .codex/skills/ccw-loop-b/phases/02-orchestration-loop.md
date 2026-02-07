# Phase 2: Orchestration Loop

Run main orchestration loop with 3-mode dispatch: Interactive, Auto, Parallel.

## Objective

- Dispatch to appropriate mode handler based on `state.mode`
- Spawn workers with structured prompts (Goal/Scope/Context/Deliverables)
- Handle batch wait, timeout, two-phase clarification
- Parse WORKER_RESULT, update state per iteration
- close_agent after confirming no more interaction needed
- Exit on completion, pause, stop, or max iterations

## Execution

### Step 2.1: Mode Dispatch

```javascript
const mode = state.mode || 'interactive'

console.log(`=== CCW Loop-B Orchestrator (${mode} mode) ===`)

switch (mode) {
  case 'interactive':
    return await runInteractiveMode(loopId, state)

  case 'auto':
    return await runAutoMode(loopId, state)

  case 'parallel':
    return await runParallelMode(loopId, state)
}
```

### Step 2.2: Interactive Mode

```javascript
async function runInteractiveMode(loopId, state) {
  while (state.status === 'running') {
    // 1. Check control signals
    const signal = checkControlSignals(loopId)
    if (!signal.continue) break

    // 2. Show menu, get user choice
    const action = await showMenuAndGetChoice(state)
    if (action === 'exit') {
      state.status = 'user_exit'
      saveState(loopId, state)
      break
    }

    // 3. Spawn worker
    const workerId = spawn_agent({
      message: buildWorkerPrompt(action, loopId, state)
    })

    // 4. Wait for result (with two-phase clarification support)
    let output = await waitWithClarification(workerId, action)

    // 5. Process and persist output
    const workerResult = parseWorkerResult(output)
    persistWorkerOutput(loopId, action, workerResult)
    state = processWorkerOutput(loopId, action, workerResult, state)

    // 6. Cleanup worker
    close_agent({ id: workerId })

    // 7. Display result
    displayResult(workerResult)

    // 8. Update iteration
    state.current_iteration++
    saveState(loopId, state)
  }

  return { status: state.status, loop_id: loopId, iterations: state.current_iteration }
}
```

### Step 2.3: Auto Mode

```javascript
async function runAutoMode(loopId, state) {
  const sequence = ['init', 'develop', 'debug', 'validate', 'complete']
  let idx = state.skill_state?.action_index || 0

  while (idx < sequence.length && state.status === 'running') {
    // Check control signals
    const signal = checkControlSignals(loopId)
    if (!signal.continue) break

    // Check iteration limit
    if (state.current_iteration >= state.max_iterations) {
      console.log(`Max iterations (${state.max_iterations}) reached`)
      break
    }

    const action = sequence[idx]

    // Spawn worker
    const workerId = spawn_agent({
      message: buildWorkerPrompt(action, loopId, state)
    })

    // Wait with two-phase clarification
    let output = await waitWithClarification(workerId, action)

    // Parse and persist
    const workerResult = parseWorkerResult(output)
    persistWorkerOutput(loopId, action, workerResult)
    state = processWorkerOutput(loopId, action, workerResult, state)

    close_agent({ id: workerId })

    // Determine next step
    if (workerResult.loop_back_to && workerResult.loop_back_to !== 'null') {
      idx = sequence.indexOf(workerResult.loop_back_to)
      if (idx === -1) idx = sequence.indexOf('develop')  // fallback
    } else if (workerResult.status === 'failed') {
      console.log(`Worker ${action} failed: ${workerResult.summary}`)
      break
    } else {
      idx++
    }

    // Update state
    state.skill_state.action_index = idx
    state.current_iteration++
    saveState(loopId, state)
  }

  return { status: state.status, loop_id: loopId, iterations: state.current_iteration }
}
```

### Step 2.4: Parallel Mode

```javascript
async function runParallelMode(loopId, state) {
  // 1. Run init worker first (sequential)
  const initWorker = spawn_agent({
    message: buildWorkerPrompt('init', loopId, state)
  })
  const initResult = wait({ ids: [initWorker], timeout_ms: 300000 })
  const initOutput = parseWorkerResult(initResult.status[initWorker].completed)
  persistWorkerOutput(loopId, 'init', initOutput)
  state = processWorkerOutput(loopId, 'init', initOutput, state)
  close_agent({ id: initWorker })

  // 2. Spawn analysis workers in parallel
  const workers = {
    develop: spawn_agent({ message: buildWorkerPrompt('develop', loopId, state) }),
    debug: spawn_agent({ message: buildWorkerPrompt('debug', loopId, state) }),
    validate: spawn_agent({ message: buildWorkerPrompt('validate', loopId, state) })
  }

  // 3. Batch wait for all workers
  const results = wait({
    ids: Object.values(workers),
    timeout_ms: 900000  // 15 minutes for all
  })

  // 4. Handle partial timeout
  if (results.timed_out) {
    console.log('Partial timeout - using completed results')
    // Send convergence request to timed-out workers
    for (const [role, workerId] of Object.entries(workers)) {
      if (!results.status[workerId]?.completed) {
        send_input({
          id: workerId,
          message: '## TIMEOUT\nPlease output WORKER_RESULT with current progress immediately.'
        })
      }
    }
    // Brief second wait for convergence
    const retryResults = wait({ ids: Object.values(workers), timeout_ms: 60000 })
    Object.assign(results.status, retryResults.status)
  }

  // 5. Collect and merge outputs
  const outputs = {}
  for (const [role, workerId] of Object.entries(workers)) {
    const completed = results.status[workerId]?.completed
    if (completed) {
      outputs[role] = parseWorkerResult(completed)
      persistWorkerOutput(loopId, role, outputs[role])
    }
    close_agent({ id: workerId })
  }

  // 6. Merge analysis
  const mergedResults = mergeWorkerOutputs(outputs)
  state.skill_state.parallel_results = mergedResults
  state.current_iteration++
  saveState(loopId, state)

  // 7. Run complete worker
  const completeWorker = spawn_agent({
    message: buildWorkerPrompt('complete', loopId, state)
  })
  const completeResult = wait({ ids: [completeWorker], timeout_ms: 300000 })
  const completeOutput = parseWorkerResult(completeResult.status[completeWorker].completed)
  persistWorkerOutput(loopId, 'complete', completeOutput)
  state = processWorkerOutput(loopId, 'complete', completeOutput, state)
  close_agent({ id: completeWorker })

  return { status: state.status, loop_id: loopId, iterations: state.current_iteration }
}
```

## Helper Functions

### buildWorkerPrompt

```javascript
function buildWorkerPrompt(action, loopId, state) {
  const roleFiles = {
    init: '~/.codex/agents/ccw-loop-b-init.md',
    develop: '~/.codex/agents/ccw-loop-b-develop.md',
    debug: '~/.codex/agents/ccw-loop-b-debug.md',
    validate: '~/.codex/agents/ccw-loop-b-validate.md',
    complete: '~/.codex/agents/ccw-loop-b-complete.md'
  }

  return `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ${roleFiles[action]} (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

Goal: Execute ${action} action for loop ${loopId}

Scope:
- 可做: ${action} 相关的所有操作
- 不可做: 其他 action 的操作
- 目录限制: 项目根目录

Context:
- Loop ID: ${loopId}
- Action: ${action}
- State File: .workflow/.loop/${loopId}.json
- Output File: .workflow/.loop/${loopId}.workers/${action}.output.json
- Progress File: .workflow/.loop/${loopId}.progress/${action}.md

Deliverables:
- WORKER_RESULT 格式输出
- 写入 output.json 和 progress.md

## CURRENT STATE

${JSON.stringify(state, null, 2)}

## TASK DESCRIPTION

${state.description}

## EXPECTED OUTPUT

\`\`\`
WORKER_RESULT:
- action: ${action}
- status: success | failed | needs_input
- summary: <brief summary>
- files_changed: [list]
- next_suggestion: <suggested next action>
- loop_back_to: <action name if needs loop back, or null>

DETAILED_OUTPUT:
<action-specific structured output>
\`\`\`

Execute the ${action} action now.
`
}
```

### waitWithClarification (Two-Phase Workflow)

```javascript
async function waitWithClarification(workerId, action) {
  const result = wait({ ids: [workerId], timeout_ms: 600000 })

  // Handle timeout
  if (result.timed_out) {
    send_input({
      id: workerId,
      message: '## TIMEOUT\nPlease converge and output WORKER_RESULT with current progress.'
    })
    const retry = wait({ ids: [workerId], timeout_ms: 300000 })
    if (retry.timed_out) {
      return `WORKER_RESULT:\n- action: ${action}\n- status: failed\n- summary: Worker timeout\n\nNEXT_ACTION_NEEDED: NONE`
    }
    return retry.status[workerId].completed
  }

  const output = result.status[workerId].completed

  // Check if worker needs clarification (two-phase)
  if (output.includes('CLARIFICATION_NEEDED')) {
    // Collect user answers
    const questions = parseClarificationQuestions(output)
    const userAnswers = await collectUserAnswers(questions)

    // Send answers back to worker
    send_input({
      id: workerId,
      message: `
## CLARIFICATION ANSWERS

${userAnswers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}

## CONTINUE EXECUTION

Based on clarification answers, continue with the ${action} action.
Output WORKER_RESULT when complete.
`
    })

    // Wait for final result
    const finalResult = wait({ ids: [workerId], timeout_ms: 600000 })
    return finalResult.status[workerId]?.completed || output
  }

  return output
}
```

### parseWorkerResult

```javascript
function parseWorkerResult(output) {
  const result = {
    action: 'unknown',
    status: 'unknown',
    summary: '',
    files_changed: [],
    next_suggestion: null,
    loop_back_to: null,
    detailed_output: ''
  }

  // Parse WORKER_RESULT block
  const match = output.match(/WORKER_RESULT:\s*([\s\S]*?)(?:DETAILED_OUTPUT:|$)/)
  if (match) {
    const lines = match[1].split('\n')
    for (const line of lines) {
      const m = line.match(/^-\s*(\w[\w_]*):\s*(.+)$/)
      if (m) {
        const [, key, value] = m
        if (key === 'files_changed') {
          try { result.files_changed = JSON.parse(value) } catch {}
        } else {
          result[key] = value.trim()
        }
      }
    }
  }

  // Parse DETAILED_OUTPUT
  const detailMatch = output.match(/DETAILED_OUTPUT:\s*([\s\S]*)$/)
  if (detailMatch) {
    result.detailed_output = detailMatch[1].trim()
  }

  return result
}
```

### mergeWorkerOutputs (Parallel Mode)

```javascript
function mergeWorkerOutputs(outputs) {
  const merged = {
    develop: outputs.develop || null,
    debug: outputs.debug || null,
    validate: outputs.validate || null,
    conflicts: [],
    merged_at: getUtc8ISOString()
  }

  // Detect file conflicts: multiple workers suggest modifying same file
  const allFiles = {}
  for (const [role, output] of Object.entries(outputs)) {
    if (output?.files_changed) {
      for (const file of output.files_changed) {
        if (allFiles[file]) {
          merged.conflicts.push({
            file,
            workers: [allFiles[file], role],
            resolution: 'manual'
          })
        } else {
          allFiles[file] = role
        }
      }
    }
  }

  return merged
}
```

### showMenuAndGetChoice

```javascript
async function showMenuAndGetChoice(state) {
  const ss = state.skill_state
  const pendingCount = ss?.pending_tasks?.length || 0
  const completedCount = ss?.completed_tasks?.length || 0

  const response = await ASK_USER([{
    id: "Action", type: "select",
    prompt: `Select next action (completed: ${completedCount}, pending: ${pendingCount}):`,
    options: [
      { label: "develop", description: `Continue development (${pendingCount} pending)` },
      { label: "debug", description: "Start debugging / diagnosis" },
      { label: "validate", description: "Run tests and validation" },
      { label: "complete", description: "Complete loop and generate summary" },
      { label: "exit", description: "Exit and save progress" }
    ]
  }])  // BLOCKS (wait for user response)

  return response["Action"]
}
```

### persistWorkerOutput

```javascript
function persistWorkerOutput(loopId, action, workerResult) {
  const outputPath = `.workflow/.loop/${loopId}.workers/${action}.output.json`
  Write(outputPath, JSON.stringify({
    ...workerResult,
    timestamp: getUtc8ISOString()
  }, null, 2))
}
```

## Output

- **Return**: `{ status, loop_id, iterations }`
- **TodoWrite**: Mark Phase 2 completed

## Next Phase

None. Phase 2 is the terminal phase of the orchestrator.
