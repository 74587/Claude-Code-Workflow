# Phase 1: Session Initialization

Create or resume a development cycle, initialize state file and directory structure.

## Objective

- Parse user arguments (TASK, --cycle-id, --extend, --auto, --parallel)
- Create new cycle with unique ID OR resume existing cycle
- Initialize directory structure for all agents
- Create master state file
- Output: cycleId, state, progressDir

## Execution

### Step 1.1: Parse Arguments

```javascript
const { cycleId: existingCycleId, task, mode = 'interactive', extension } = options

// Validate mutual exclusivity
if (!existingCycleId && !task) {
  console.error('Either --cycle-id or task description is required')
  return { status: 'error', message: 'Missing cycleId or task' }
}
```

### Step 1.2: Utility Functions

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

function readCycleState(cycleId) {
  const stateFile = `.workflow/.cycle/${cycleId}.json`
  if (!fs.existsSync(stateFile)) {
    return null
  }
  return JSON.parse(Read(stateFile))
}
```

### Step 1.3: New Cycle Creation

When `TASK` is provided (no `--cycle-id`):

```javascript
// Generate unique cycle ID
const timestamp = getUtc8ISOString().replace(/[-:]/g, '').split('.')[0]
const random = Math.random().toString(36).substring(2, 10)
const cycleId = `cycle-v1-${timestamp}-${random}`

console.log(`Creating new cycle: ${cycleId}`)
```

#### Create Directory Structure

```bash
mkdir -p .workflow/.cycle/${cycleId}.progress/{ra,ep,cd,vas,coordination}
mkdir -p .workflow/.cycle/${cycleId}.progress/ra/history
mkdir -p .workflow/.cycle/${cycleId}.progress/ep/history
mkdir -p .workflow/.cycle/${cycleId}.progress/cd/history
mkdir -p .workflow/.cycle/${cycleId}.progress/vas/history
```

#### Initialize State File

```javascript
function createCycleState(cycleId, taskDescription) {
  const stateFile = `.workflow/.cycle/${cycleId}.json`
  const now = getUtc8ISOString()

  const state = {
    // Metadata
    cycle_id: cycleId,
    title: taskDescription.substring(0, 100),
    description: taskDescription,
    max_iterations: 5,
    status: 'running',
    created_at: now,
    updated_at: now,

    // Agent tracking
    agents: {
      ra: { status: 'idle', output_files: [] },
      ep: { status: 'idle', output_files: [] },
      cd: { status: 'idle', output_files: [] },
      vas: { status: 'idle', output_files: [] }
    },

    // Phase tracking
    current_phase: 'init',
    completed_phases: [],
    current_iteration: 0,

    // Shared context (populated by agents)
    requirements: null,
    exploration: null,
    plan: null,
    changes: [],
    test_results: null
  }

  Write(stateFile, JSON.stringify(state, null, 2))
  return state
}
```

### Step 1.4: Resume Existing Cycle

When `--cycle-id` is provided:

```javascript
const cycleId = existingCycleId
const state = readCycleState(cycleId)

if (!state) {
  console.error(`Cycle not found: ${cycleId}`)
  return { status: 'error', message: 'Cycle not found' }
}

console.log(`Resuming cycle: ${cycleId}`)

// Apply extension if provided
if (extension) {
  console.log(`Extension: ${extension}`)
  state.description += `\n\n--- ITERATION ${state.current_iteration + 1} ---\n${extension}`
}
```

### Step 1.5: Control Signal Check

Before proceeding, verify cycle status allows continuation:

```javascript
function checkControlSignals(cycleId) {
  const state = readCycleState(cycleId)

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

- **Variable**: `cycleId` - Unique cycle identifier
- **Variable**: `state` - Initialized or resumed cycle state object
- **Variable**: `progressDir` - `.workflow/.cycle/${cycleId}.progress`
- **TodoWrite**: Mark Phase 1 completed, Phase 2 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 2: Agent Execution](02-agent-execution.md).
