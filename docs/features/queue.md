# Queue Management

## One-Liner
**The Queue Management page provides centralized control over issue execution queues with scheduler controls, status monitoring, and session pool management.**

---

## Pain Points Solved

| Pain Point | Current State | Queue Solution |
|------------|---------------|----------------|
| **Disorganized execution** | No unified task queue | Centralized queue with grouped items |
| **Unknown scheduler status** | Can't tell if scheduler is running | Real-time status indicator (idle/running/paused) |
| **No execution control** | Can't start/stop queue processing | Start/Pause/Stop controls with confirmation |
| **Concurrency limits** | Too many simultaneous sessions | Configurable max concurrent sessions |
| **No visibility** | Don't know what's queued | Stats cards + item list with status tracking |
| **Resource waste** | Idle sessions consuming resources | Session pool overview with timeout config |

---

## Overview

**Location**: `ccw/frontend/src/pages/QueuePage.tsx` (legacy), `ccw/frontend/src/components/terminal-dashboard/QueuePanel.tsx` (current)

**Purpose**: View and manage issue execution queues with scheduler controls, progress tracking, and session pool management.

**Access**: Navigation → Issues → Queue tab OR Terminal Dashboard → Queue floating panel

**Layout**:
```
+--------------------------------------------------------------------------+
|  Queue Panel Header                                                        |
+--------------------------------------------------------------------------+
|  Scheduler Status Bar                                                       |
|  +----------------+  +-------------+  +-------------------------------+         |
|  | Status Badge   |  | Progress    |  | Concurrency (2/2)            |         |
|  +----------------+  +-------------+  +-------------------------------+         |
+--------------------------------------------------------------------------+
|  Scheduler Controls                                                          |
|  +--------+  +--------+  +--------+  +-----------+                      |
|  | Start  |  | Pause  |  | Stop   |  | Config    |                      |
|  +--------+  +--------+  +--------+  +-----------+                      |
+--------------------------------------------------------------------------+
|  Queue Items List                                                           |
|  +---------------------------------------------------------------------+    |
|  | QueueItemRow (status, issue_id, session_key, actions)              |    |
|  | - Status icon (pending/executing/completed/blocked/failed)         |    |
|  | - Issue ID / Item ID display                                        |    |
|  | - Session binding info                                              |    |
|  | - Progress indicator (for executing items)                          |    |
|  +---------------------------------------------------------------------+    |
|  | [More queue items...]                                               |    |
|  +---------------------------------------------------------------------+    |
+--------------------------------------------------------------------------+
|  Session Pool Overview (optional)                                           |
|  +--------------------------------------------------------------------------+
|  | Active Sessions | Idle Sessions | Total Sessions                      |
|  +--------------------------------------------------------------------------+
```

---

## Live Demo

:::demo QueueManagementDemo
# queue-management-demo.tsx
/**
 * Queue Management Demo
 * Shows scheduler controls and queue items list
 */
export function QueueManagementDemo() {
  const [schedulerStatus, setSchedulerStatus] = React.useState('idle')
  const [progress, setProgress] = React.useState(0)

  const queueItems = [
    { id: '1', status: 'completed', issueId: 'ISSUE-1', sessionKey: 'session-1' },
    { id: '2', status: 'executing', issueId: 'ISSUE-2', sessionKey: 'session-2' },
    { id: '3', status: 'pending', issueId: 'ISSUE-3', sessionKey: null },
    { id: '4', status: 'pending', issueId: 'ISSUE-4', sessionKey: null },
    { id: '5', status: 'blocked', issueId: 'ISSUE-5', sessionKey: null },
  ]

  const statusConfig = {
    idle: { label: 'Idle', color: 'bg-gray-500/20 text-gray-600 border-gray-500' },
    running: { label: 'Running', color: 'bg-green-500/20 text-green-600 border-green-500' },
    paused: { label: 'Paused', color: 'bg-amber-500/20 text-amber-600 border-amber-500' },
  }

  const itemStatusConfig = {
    completed: { icon: '✓', color: 'text-green-500', label: 'Completed' },
    executing: { icon: '▶', color: 'text-blue-500', label: 'Executing' },
    pending: { icon: '○', color: 'text-gray-400', label: 'Pending' },
    blocked: { icon: '✕', color: 'text-red-500', label: 'Blocked' },
    failed: { icon: '!', color: 'text-red-500', label: 'Failed' },
  }

  // Simulate progress when running
  React.useEffect(() => {
    if (schedulerStatus === 'running') {
      const interval = setInterval(() => {
        setProgress((p) => (p >= 100 ? 0 : p + 10))
      }, 500)
      return () => clearInterval(interval)
    }
  }, [schedulerStatus])

  const handleStart = () => {
    if (schedulerStatus === 'idle' || schedulerStatus === 'paused') {
      setSchedulerStatus('running')
    }
  }

  const handlePause = () => {
    if (schedulerStatus === 'running') {
      setSchedulerStatus('paused')
    }
  }

  const handleStop = () => {
    setSchedulerStatus('idle')
    setProgress(0)
  }

  const currentConfig = statusConfig[schedulerStatus]

  return (
    <div className="p-6 bg-background space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Queue Management</h3>
          <p className="text-sm text-muted-foreground">Manage issue execution queue</p>
        </div>
      </div>

      {/* Scheduler Status Bar */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className={`px-3 py-1 rounded text-xs font-medium border ${currentConfig.color}`}>
            {currentConfig.label}
          </span>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{queueItems.filter((i) => i.status === 'completed').length}/{queueItems.length} items</span>
            <span>2/2 concurrent</span>
          </div>
        </div>

        {/* Progress Bar */}
        {schedulerStatus === 'running' && (
          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{progress}% complete</span>
          </div>
        )}

        {/* Scheduler Controls */}
        <div className="flex items-center gap-2">
          {(schedulerStatus === 'idle' || schedulerStatus === 'paused') && (
            <button
              onClick={handleStart}
              className="px-4 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
            >
              <span>▶</span> Start
            </button>
          )}
          {schedulerStatus === 'running' && (
            <button
              onClick={handlePause}
              className="px-4 py-2 text-sm bg-amber-500 text-white rounded hover:bg-amber-600 flex items-center gap-2"
            >
              <span>⏸</span> Pause
            </button>
          )}
          {schedulerStatus !== 'idle' && (
            <button
              onClick={handleStop}
              className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-2"
            >
              <span>⬛</span> Stop
            </button>
          )}
          <button className="px-4 py-2 text-sm border rounded hover:bg-accent">
            Config
          </button>
        </div>
      </div>

      {/* Queue Items List */}
      <div className="border rounded-lg">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h4 className="text-sm font-semibold">Queue Items</h4>
        </div>
        <div className="divide-y max-h-80 overflow-auto">
          {queueItems.map((item) => {
            const config = itemStatusConfig[item.status]
            return (
              <div key={item.id} className="px-4 py-3 flex items-center gap-4 hover:bg-accent/50">
                <span className={`text-lg ${config.color}`}>{config.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.issueId}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${config.color} bg-opacity-10`}>
                      {config.label}
                    </span>
                  </div>
                  {item.sessionKey && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Session: {item.sessionKey}
                    </div>
                  )}
                </div>
                {item.status === 'executing' && (
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }}/>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
:::

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Scheduler Status** | Real-time status indicator (idle/running/paused) with visual badge |
| **Progress Tracking** | Progress bar showing overall queue completion percentage |
| **Start/Pause/Stop Controls** | Control queue execution with confirmation dialog for stop action |
| **Concurrency Display** | Shows current active sessions vs max concurrent sessions |
| **Queue Items List** | Scrollable list of all queue items with status, issue ID, and session binding |
| **Status Icons** | Visual indicators for item status (pending/executing/completed/blocked/failed) |
| **Session Pool** | Overview of active, idle, and total sessions in the pool |
| **Config Panel** | Adjust max concurrent sessions and timeout settings |
| **Empty State** | Friendly message when queue is empty with instructions to add items |

---

## Component Hierarchy

```
QueuePage (legacy) / QueuePanel (current)
├── QueuePanelHeader
│   ├── Title
│   └── Tab Switcher (Queue | Orchestrator)
├── SchedulerBar (inline in QueueListColumn)
│   ├── Status Badge
│   ├── Progress + Concurrency
│   └── Control Buttons (Play/Pause/Stop)
├── QueueItemsList
│   └── QueueItemRow (repeating)
│       ├── Status Icon
│       ├── Issue ID / Item ID
│       ├── Session Binding
│       └── Progress (for executing items)
└── SchedulerPanel (standalone)
    ├── Status Section
    ├── Progress Bar
    ├── Control Buttons
    ├── Config Section
    │   ├── Max Concurrent Sessions
    │   ├── Session Idle Timeout
    │   └── Resume Key Binding Timeout
    └── Session Pool Overview
```

---

## Props API

### QueuePanel

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `embedded` | `boolean` | `false` | Whether panel is embedded in another component |

### SchedulerPanel

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| - | - | - | This component accepts no props (all data from Zustand store) |

### QueueListColumn

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| - | - | - | This component accepts no props (all data from Zustand store) |

---

## State Management

### Zustand Stores

| Store | Selector | Purpose |
|-------|----------|---------|
| `queueSchedulerStore` | `selectQueueSchedulerStatus` | Current scheduler status (idle/running/paused) |
| `queueSchedulerStore` | `selectSchedulerProgress` | Overall queue completion percentage |
| `queueSchedulerStore` | `selectQueueItems` | List of all queue items |
| `queueSchedulerStore` | `selectCurrentConcurrency` | Active sessions count |
| `queueSchedulerStore` | `selectSchedulerConfig` | Scheduler configuration |
| `queueSchedulerStore` | `selectSessionPool` | Session pool overview |
| `queueSchedulerStore` | `selectSchedulerError` | Error message if any |
| `issueQueueIntegrationStore` | `selectAssociationChain` | Current association chain for highlighting |
| `queueExecutionStore` | `selectByQueueItem` | Execution data for queue item |

### Queue Item Status

```typescript
type QueueItemStatus =
  | 'pending'      // Waiting to be executed
  | 'executing'    // Currently being processed
  | 'completed'    // Finished successfully
  | 'blocked'      // Blocked by dependency
  | 'failed';      // Failed with error
```

### Scheduler Status

```typescript
type QueueSchedulerStatus =
  | 'idle'     // No items or stopped
  | 'running'  // Actively processing items
  | 'paused';  // Temporarily paused
```

---

## Usage Examples

### Basic Queue Panel

```tsx
import { QueuePanel } from '@/components/terminal-dashboard/QueuePanel'

function QueueSection() {
  return <QueuePanel />
}
```

### Standalone Scheduler Panel

```tsx
import { SchedulerPanel } from '@/components/terminal-dashboard/SchedulerPanel'

function SchedulerControls() {
  return <SchedulerPanel />
}
```

### Queue List Column (Embedded)

```tsx
import { QueueListColumn } from '@/components/terminal-dashboard/QueueListColumn'

function EmbeddedQueue() {
  return <QueueListColumn />
}
```

### Queue Store Actions

```tsx
import { useQueueSchedulerStore } from '@/stores/queueSchedulerStore'

function QueueActions() {
  const startQueue = useQueueSchedulerStore((s) => s.startQueue)
  const pauseQueue = useQueueSchedulerStore((s) => s.pauseQueue)
  const stopQueue = useQueueSchedulerStore((s) => s.stopQueue)
  const updateConfig = useQueueSchedulerStore((s) => s.updateConfig)

  const handleStart = () => startQueue()
  const handlePause = () => pauseQueue()
  const handleStop = () => stopQueue()
  const handleConfig = (config) => updateConfig(config)

  return (
    <div>
      <button onClick={handleStart}>Start</button>
      <button onClick={handlePause}>Pause</button>
      <button onClick={handleStop}>Stop</button>
      <button onClick={() => handleConfig({ maxConcurrentSessions: 4 })}>
        Set Max 4
      </button>
    </div>
  )
}
```

---

## Interactive Demos

### Queue Item Status Demo

:::demo QueueItemStatusDemo
# queue-item-status-demo.tsx
/**
 * Queue Item Status Demo
 * Shows all possible queue item states
 */
export function QueueItemStatusDemo() {
  const itemStates = [
    { status: 'pending', issueId: 'ISSUE-101', sessionKey: null },
    { status: 'executing', issueId: 'ISSUE-102', sessionKey: 'cli-session-abc' },
    { status: 'completed', issueId: 'ISSUE-103', sessionKey: 'cli-session-def' },
    { status: 'blocked', issueId: 'ISSUE-104', sessionKey: null },
    { status: 'failed', issueId: 'ISSUE-105', sessionKey: 'cli-session-ghi' },
  ]

  const statusConfig = {
    pending: { icon: '○', color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'Pending' },
    executing: { icon: '▶', color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Executing' },
    completed: { icon: '✓', color: 'text-green-500', bg: 'bg-green-500/10', label: 'Completed' },
    blocked: { icon: '✕', color: 'text-red-500', bg: 'bg-red-500/10', label: 'Blocked' },
    failed: { icon: '!', color: 'text-red-500', bg: 'bg-red-500/10', label: 'Failed' },
  }

  return (
    <div className="p-6 bg-background space-y-4">
      <h3 className="text-sm font-semibold">Queue Item Status States</h3>
      <div className="space-y-2">
        {itemStates.map((item) => {
          const config = statusConfig[item.status]
          return (
            <div key={item.status} className="border rounded-lg p-4 flex items-center gap-4">
              <span className={`text-2xl ${config.color}`}>{config.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.issueId}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                    {config.label}
                  </span>
                </div>
                {item.sessionKey && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Bound session: <code className="text-xs bg-muted px-1 rounded">{item.sessionKey}</code>
                  </div>
                )}
              </div>
              {item.status === 'executing' && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }}/>
                  </div>
                  <span className="text-xs text-muted-foreground">60%</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
:::

### Scheduler Config Demo

:::demo SchedulerConfigDemo
# scheduler-config-demo.tsx
/**
 * Scheduler Config Demo
 * Interactive configuration panel
 */
export function SchedulerConfigDemo() {
  const [config, setConfig] = React.useState({
    maxConcurrentSessions: 2,
    sessionIdleTimeoutMs: 60000,
    resumeKeySessionBindingTimeoutMs: 300000,
  })

  const formatMs = (ms) => {
    if (ms >= 60000) return `${ms / 60000}m`
    if (ms >= 1000) return `${ms / 1000}s`
    return `${ms}ms`
  }

  return (
    <div className="p-6 bg-background space-y-6 max-w-md">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Scheduler Configuration</h3>
        <button className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:opacity-90">
          Save
        </button>
      </div>

      <div className="space-y-4">
        {/* Max Concurrent Sessions */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Max Concurrent Sessions</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="8"
              value={config.maxConcurrentSessions}
              onChange={(e) => setConfig({ ...config, maxConcurrentSessions: parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="text-sm font-medium w-8 text-center">{config.maxConcurrentSessions}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Maximum number of sessions to run simultaneously
          </p>
        </div>

        {/* Session Idle Timeout */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Session Idle Timeout</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="10000"
              max="300000"
              step="10000"
              value={config.sessionIdleTimeoutMs}
              onChange={(e) => setConfig({ ...config, sessionIdleTimeoutMs: parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="text-sm font-medium w-12 text-right">{formatMs(config.sessionIdleTimeoutMs)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Time before idle session is terminated
          </p>
        </div>

        {/* Resume Key Binding Timeout */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Resume Key Binding Timeout</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="60000"
              max="600000"
              step="60000"
              value={config.resumeKeySessionBindingTimeoutMs}
              onChange={(e) => setConfig({ ...config, resumeKeySessionBindingTimeoutMs: parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="text-sm font-medium w-12 text-right">{formatMs(config.resumeKeySessionBindingTimeoutMs)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Time to preserve resume key session binding
          </p>
        </div>
      </div>

      {/* Current Config Display */}
      <div className="border rounded-lg p-4 bg-muted/30">
        <h4 className="text-xs font-semibold mb-3">Current Configuration</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Max Concurrent</dt>
            <dd className="font-medium">{config.maxConcurrentSessions} sessions</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Idle Timeout</dt>
            <dd className="font-medium">{formatMs(config.sessionIdleTimeoutMs)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Binding Timeout</dt>
            <dd className="font-medium">{formatMs(config.resumeKeySessionBindingTimeoutMs)}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
:::

---

## Configuration

### Scheduler Config

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `maxConcurrentSessions` | `number` | `2` | Maximum sessions running simultaneously |
| `sessionIdleTimeoutMs` | `number` | `60000` | Idle session timeout in milliseconds |
| `resumeKeySessionBindingTimeoutMs` | `number` | `300000` | Resume key binding timeout in milliseconds |

### Queue Item Structure

```typescript
interface QueueItem {
  item_id: string;
  issue_id?: string;
  sessionKey?: string;
  status: QueueItemStatus;
  execution_order: number;
  created_at?: number;
  updated_at?: number;
}
```

---

## Accessibility

- **Keyboard Navigation**:
  - <kbd>Tab</kbd> - Navigate through queue items and controls
  - <kbd>Enter</kbd>/<kbd>Space</kbd> - Activate buttons
  - <kbd>Escape</kbd> - Close dialogs

- **ARIA Attributes**:
  - `aria-label` on control buttons
  - `aria-live` regions for status updates
  - `aria-current` for active queue item
  - `role="list"` on queue items list

- **Screen Reader Support**:
  - Status changes announced
  - Progress updates spoken
  - Error messages announced

---

## Related Links

- [Issue Hub](/features/issue-hub) - Unified issues, queue, and discovery management
- [Terminal Dashboard](/features/terminal) - Terminal-first workspace with integrated queue panel
- [Discovery](/features/discovery) - Discovery session tracking
- [Sessions](/features/sessions) - Session management and details
