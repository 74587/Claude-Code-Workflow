# Phase 1: Session Initialization

Create or resume a development loop, initialize state file and directory structure.

## Objective

- Parse user arguments (TASK, --loop-id, --auto)
- Create new loop with unique ID OR resume existing loop
- Initialize directory structure for progress files
- Create master state file
- Output: loopId, state, progressDir

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

// Determine mode
const executionMode = options['--auto'] ? 'auto' : 'interactive'
```

### Step 1.2: Utility Functions

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

function readLoopState(loopId) {
  const stateFile = `${projectRoot}/.workflow/.loop/${loopId}.json`
  if (!fs.existsSync(stateFile)) {
    return null
  }
  return JSON.parse(Read(stateFile))
}
```

### Step 1.3: New Loop Creation

When `TASK` is provided (no `--loop-id`):

```javascript
// Generate unique loop ID
const timestamp = getUtc8ISOString().replace(/[-:]/g, '').split('.')[0]
const random = Math.random().toString(36).substring(2, 10)
const loopId = `loop-v2-${timestamp}-${random}`

console.log(`Creating new loop: ${loopId}`)
```

#### Create Directory Structure

```bash
mkdir -p ${projectRoot}/.workflow/.loop/${loopId}.progress
```

#### Initialize State File

```javascript
function createLoopState(loopId, taskDescription) {
  const stateFile = `${projectRoot}/.workflow/.loop/${loopId}.json`
  const now = getUtc8ISOString()

  const state = {
    // API compatible fields
    loop_id: loopId,
    title: taskDescription.substring(0, 100),
    description: taskDescription,
    max_iterations: 10,
    status: 'running',
    current_iteration: 0,
    created_at: now,
    updated_at: now,

    // Skill extension fields (initialized by INIT action)
    skill_state: null
  }

  Write(stateFile, JSON.stringify(state, null, 2))
  return state
}
```

### Step 1.4: Resume Existing Loop

When `--loop-id` is provided:

```javascript
const loopId = existingLoopId
const state = readLoopState(loopId)

if (!state) {
  console.error(`Loop not found: ${loopId}`)
  return { status: 'error', message: 'Loop not found' }
}

console.log(`Resuming loop: ${loopId}`)
console.log(`Status: ${state.status}`)
```

### Step 1.5: Control Signal Check

Before proceeding, verify loop status allows continuation:

```javascript
function checkControlSignals(loopId) {
  const state = readLoopState(loopId)

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
- **Variable**: `mode` - `'interactive'` or `'auto'`
- **TodoWrite**: Mark Phase 1 completed, Phase 2 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 2: Orchestration Loop](02-orchestration-loop.md).
