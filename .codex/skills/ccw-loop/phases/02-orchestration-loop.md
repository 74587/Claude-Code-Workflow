# Phase 2: Orchestration Loop

Spawn single executor agent and run main orchestration loop until completion, pause, or max iterations.

## Objective

- Spawn single executor agent with loop context
- Run main while loop: wait → parse → dispatch → send_input
- Handle terminal conditions (COMPLETED, PAUSED, STOPPED)
- Handle interactive mode (WAITING_INPUT → user choice → send_input)
- Handle auto mode (next action → send_input)
- Update iteration count per cycle
- Close agent on exit

## Execution

### Step 2.1: Spawn Executor Agent

```javascript
const agent = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/ccw-loop-executor.md (MUST read first)
2. Read: ${projectRoot}/.workflow/project-tech.json (if exists)
3. Read: ${projectRoot}/.workflow/project-guidelines.json (if exists)

---

## LOOP CONTEXT

- **Loop ID**: ${loopId}
- **State File**: ${projectRoot}/.workflow/.loop/${loopId}.json
- **Progress Dir**: ${progressDir}
- **Mode**: ${mode}

## CURRENT STATE

${JSON.stringify(state, null, 2)}

## TASK DESCRIPTION

${state.description || task}

## EXECUTION INSTRUCTIONS

You are executing CCW Loop orchestrator. Your job:

1. **Check Control Signals**
   - Read ${projectRoot}/.workflow/.loop/${loopId}.json
   - If status === 'paused' -> Output "PAUSED" and stop
   - If status === 'failed' -> Output "STOPPED" and stop
   - If status === 'running' -> Continue

2. **Select Next Action**
   Based on skill_state:
   - If not initialized -> Execute INIT
   - If mode === 'interactive' -> Output MENU and wait for input
   - If mode === 'auto' -> Auto-select based on state

3. **Execute Action**
   - Follow action instructions from ~/.codex/skills/ccw-loop/actions/
   - Update progress files in ${progressDir}/
   - Update state in ${projectRoot}/.workflow/.loop/${loopId}.json

4. **Output Format**
   \`\`\`
   ACTION_RESULT:
   - action: {action_name}
   - status: success | failed | needs_input
   - message: {user message}
   - state_updates: {JSON of skill_state updates}

   NEXT_ACTION_NEEDED: {action_name} | WAITING_INPUT | COMPLETED | PAUSED
   \`\`\`

## FIRST ACTION

${!state.skill_state ? 'Execute: INIT' : mode === 'auto' ? 'Auto-select next action' : 'Show MENU'}
`
})
```

### Step 2.2: Main Orchestration Loop

```javascript
let iteration = state.current_iteration || 0
const maxIterations = state.max_iterations || 10
let continueLoop = true

while (continueLoop && iteration < maxIterations) {
  iteration++

  // Wait for agent output
  const result = wait({ ids: [agent], timeout_ms: 600000 })

  // Handle timeout
  if (result.timed_out) {
    console.log('Agent timeout, requesting convergence...')
    send_input({
      id: agent,
      message: `
## TIMEOUT NOTIFICATION

Execution timeout reached. Please:
1. Output current progress
2. Save any pending state updates
3. Return ACTION_RESULT with current status
`
    })
    continue
  }

  const output = result.status[agent].completed

  // Parse action result
  const actionResult = parseActionResult(output)

  console.log(`\n[Iteration ${iteration}] Action: ${actionResult.action}, Status: ${actionResult.status}`)

  // Update iteration in state
  state = readLoopState(loopId)
  state.current_iteration = iteration
  state.updated_at = getUtc8ISOString()
  Write(`${projectRoot}/.workflow/.loop/${loopId}.json`, JSON.stringify(state, null, 2))

  // Handle different outcomes
  switch (actionResult.next_action) {
    case 'COMPLETED':
      console.log('Loop completed successfully')
      continueLoop = false
      break

    case 'PAUSED':
      console.log('Loop paused by API, exiting gracefully')
      continueLoop = false
      break

    case 'STOPPED':
      console.log('Loop stopped by API')
      continueLoop = false
      break

    case 'WAITING_INPUT':
      // Interactive mode: display menu, get user choice
      if (mode === 'interactive') {
        const userChoice = await displayMenuAndGetChoice(actionResult)

        send_input({
          id: agent,
          message: `
## USER INPUT RECEIVED

Action selected: ${userChoice.action}
${userChoice.data ? `Additional data: ${JSON.stringify(userChoice.data)}` : ''}

## EXECUTE SELECTED ACTION

Read action instructions and execute: ${userChoice.action}
Update state and progress files accordingly.
Output ACTION_RESULT when complete.
`
        })
      }
      break

    default:
      // Continue with next action
      if (actionResult.next_action && actionResult.next_action !== 'NONE') {
        send_input({
          id: agent,
          message: `
## CONTINUE EXECUTION

Previous action completed: ${actionResult.action}
Result: ${actionResult.status}
${actionResult.message ? `Message: ${actionResult.message}` : ''}

## EXECUTE NEXT ACTION

Continue with: ${actionResult.next_action}
Read action instructions and execute.
Output ACTION_RESULT when complete.
`
        })
      } else {
        if (actionResult.status === 'failed') {
          console.log(`Action failed: ${actionResult.message}`)
        }
        continueLoop = false
      }
  }
}
```

### Step 2.3: Iteration Limit Check

```javascript
if (iteration >= maxIterations) {
  console.log(`\nReached maximum iterations (${maxIterations})`)
  console.log('Consider breaking down the task or taking a break.')
}
```

### Step 2.4: Cleanup

```javascript
close_agent({ id: agent })

console.log('\n=== CCW Loop Orchestrator Finished ===')

const finalState = readLoopState(loopId)
return {
  status: finalState.status,
  loop_id: loopId,
  iterations: iteration,
  final_state: finalState
}
```

## Helper Functions

### parseActionResult

```javascript
function parseActionResult(output) {
  const result = {
    action: 'unknown',
    status: 'unknown',
    message: '',
    state_updates: {},
    next_action: 'NONE'
  }

  // Parse ACTION_RESULT block
  const actionMatch = output.match(/ACTION_RESULT:\s*([\s\S]*?)(?:FILES_UPDATED:|NEXT_ACTION_NEEDED:|$)/)
  if (actionMatch) {
    const lines = actionMatch[1].split('\n')
    for (const line of lines) {
      const match = line.match(/^-\s*(\w+):\s*(.+)$/)
      if (match) {
        const [, key, value] = match
        if (key === 'state_updates') {
          try {
            result.state_updates = JSON.parse(value)
          } catch (e) {
            // Try parsing multi-line JSON
          }
        } else {
          result[key] = value.trim()
        }
      }
    }
  }

  // Parse NEXT_ACTION_NEEDED
  const nextMatch = output.match(/NEXT_ACTION_NEEDED:\s*(\S+)/)
  if (nextMatch) {
    result.next_action = nextMatch[1]
  }

  return result
}
```

### displayMenuAndGetChoice

```javascript
async function displayMenuAndGetChoice(actionResult) {
  const menuMatch = actionResult.message.match(/MENU_OPTIONS:\s*([\s\S]*?)(?:WAITING_INPUT:|$)/)

  if (menuMatch) {
    console.log('\n' + menuMatch[1])
  }

  const response = await ASK_USER([{
    id: "Action", type: "select",
    prompt: "Select next action:",
    options: [
      { label: "develop", description: "Continue development" },
      { label: "debug", description: "Start debugging" },
      { label: "validate", description: "Run validation" },
      { label: "complete", description: "Complete loop" },
      { label: "exit", description: "Exit and save" }
    ]
  }])  // BLOCKS (wait for user response)

  return { action: response["Action"] }
}
```

## Termination Conditions

1. **API Paused**: `state.status === 'paused'` (Skill exits, wait for resume)
2. **API Stopped**: `state.status === 'failed'` (Skill terminates)
3. **Task Complete**: `NEXT_ACTION_NEEDED === 'COMPLETED'`
4. **Iteration Limit**: `current_iteration >= max_iterations`
5. **User Exit**: User selects 'exit' in interactive mode

## Output

- **Variable**: `finalState` - Final loop state after all iterations
- **Return**: `{ status, loop_id, iterations, final_state }`
- **TodoWrite**: Mark Phase 2 completed

## Next Phase

None. Phase 2 is the terminal phase of the orchestrator.
