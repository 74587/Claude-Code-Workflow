# Phase 1: Session Initialization

Create or resume a development loop, initialize state file and directory structure, detect execution mode.

## Objective

- Parse user arguments (TASK, --loop-id, --mode)
- Create new loop with unique ID OR resume existing loop
- Initialize directory structure (progress + workers)
- Create master state file
- Output: loopId, state, progressDir, mode

## Execution

### Step 0: Determine Project Root

```javascript
// Step 0: Determine Project Root
const projectRoot = Bash('git rev-parse --show-toplevel 2>/dev/null || pwd').trim()
```

### Step 1.1: Parse Arguments

```javascript
const { loopId: existingLoopId, task, mode = 'interactive' } = options

// Validate mutual exclusivity
if (!existingLoopId && !task) {
  console.error('Either --loop-id or task description is required')
  return { status: 'error', message: 'Missing loopId or task' }
}

// Validate mode
const validModes = ['interactive', 'auto', 'parallel']
if (!validModes.includes(mode)) {
  console.error(`Invalid mode: ${mode}. Use: ${validModes.join(', ')}`)
  return { status: 'error', message: 'Invalid mode' }
}
```

### Step 1.2: Utility Functions

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

function readState(loopId) {
  const stateFile = `${projectRoot}/.workflow/.loop/${loopId}.json`
  if (!fs.existsSync(stateFile)) return null
  return JSON.parse(Read(stateFile))
}

function saveState(loopId, state) {
  state.updated_at = getUtc8ISOString()
  Write(`${projectRoot}/.workflow/.loop/${loopId}.json`, JSON.stringify(state, null, 2))
}
```

### Step 1.3: New Loop Creation

When `TASK` is provided (no `--loop-id`):

```javascript
const timestamp = getUtc8ISOString().replace(/[-:]/g, '').split('.')[0]
const random = Math.random().toString(36).substring(2, 10)
const loopId = `loop-b-${timestamp}-${random}`

console.log(`Creating new loop: ${loopId}`)
```

#### Create Directory Structure

```bash
mkdir -p ${projectRoot}/.workflow/.loop/${loopId}.workers
mkdir -p ${projectRoot}/.workflow/.loop/${loopId}.progress
```

#### Initialize State File

```javascript
function createState(loopId, taskDescription, mode) {
  const now = getUtc8ISOString()

  const state = {
    loop_id: loopId,
    title: taskDescription.substring(0, 100),
    description: taskDescription,
    mode: mode,
    status: 'running',
    current_iteration: 0,
    max_iterations: 10,
    created_at: now,
    updated_at: now,

    skill_state: {
      phase: 'init',
      action_index: 0,
      workers_completed: [],
      parallel_results: null,
      pending_tasks: [],
      completed_tasks: [],
      findings: []
    }
  }

  Write(`${projectRoot}/.workflow/.loop/${loopId}.json`, JSON.stringify(state, null, 2))
  return state
}
```

### Step 1.4: Resume Existing Loop

When `--loop-id` is provided:

```javascript
const loopId = existingLoopId
const state = readState(loopId)

if (!state) {
  console.error(`Loop not found: ${loopId}`)
  return { status: 'error', message: 'Loop not found' }
}

console.log(`Resuming loop: ${loopId}`)
console.log(`Mode: ${state.mode}, Status: ${state.status}`)

// Override mode if provided
if (options['--mode']) {
  state.mode = options['--mode']
  saveState(loopId, state)
}
```

### Step 1.5: Control Signal Check

```javascript
function checkControlSignals(loopId) {
  const state = readState(loopId)

  switch (state?.status) {
    case 'paused':
      return { continue: false, action: 'pause_exit' }
    case 'failed':
      return { continue: false, action: 'stop_exit' }
    case 'running':
      return { continue: true, action: 'continue' }
    default:
      return { continue: false, action: 'stop_exit' }
  }
}
```

## Output

- **Variable**: `loopId` - Unique loop identifier
- **Variable**: `state` - Initialized or resumed loop state object
- **Variable**: `progressDir` - `${projectRoot}/.workflow/.loop/${loopId}.progress`
- **Variable**: `workersDir` - `${projectRoot}/.workflow/.loop/${loopId}.workers`
- **Variable**: `mode` - `'interactive'` / `'auto'` / `'parallel'`
- **TodoWrite**: Mark Phase 1 completed, Phase 2 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 2: Orchestration Loop](02-orchestration-loop.md).
