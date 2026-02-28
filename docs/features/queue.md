# Queue

## One-Liner

**The Queue page manages issue execution queues, displaying grouped tasks and solutions with conflict detection and merge capabilities.**

---

## Pain Points Solved

| Pain Point | Current State | Queue Solution |
|------------|---------------|----------------|
| **Disorganized execution** | No unified task queue | Centralized queue with grouped items |
| **Unknown queue status** | Can't tell if queue is ready | Status indicator with conflicts warning |
| **Manual queue management** | No way to control execution | Activate/deactivate/delete with actions |
| **Duplicate handling** | Confusing duplicate items | Merge queues functionality |
| **No visibility** | Don't know what's queued | Stats cards with items/groups/tasks/solutions counts |

---

## Page Overview

**Location**: `ccw/frontend/src/pages/QueuePage.tsx`

**Purpose**: View and manage issue execution queues with stats, conflict detection, and queue operations.

**Access**: Navigation → Issues → Queue tab OR directly via `/queue` route

### Layout

```
+--------------------------------------------------------------------------+
|  Queue Title                                    [Refresh]                |
+--------------------------------------------------------------------------+
|  Stats Cards                                                                  |
|  +-------------+  +-------------+  +-------------+  +-------------+         |
|  | Total Items  |  | Groups       |  | Tasks        |  | Solutions    |         |
|  +-------------+  +-------------+  +-------------+  +-------------+         |
+--------------------------------------------------------------------------+
|  Conflicts Warning (when conflicts exist)                                    |
+--------------------------------------------------------------------------+
|  Queue Cards (1-2 columns)                                                  |
|  +---------------------------------------------------------------------+    |
|  | QueueCard                                                           |    |
|  | - Queue info                                                        |    |
|  | - Grouped items preview                                            |    |
|  | - Action buttons (Activate/Deactivate/Delete/Merge)                |    |
|  +---------------------------------------------------------------------+    |
+--------------------------------------------------------------------------+
|  Status Footer (Ready/Pending indicator)                                   |
+--------------------------------------------------------------------------+
```

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Stats Cards** | Four metric cards showing total items, groups, tasks, and solutions counts |
| **Conflicts Warning** | Banner alert when conflicts exist, showing count and description |
| **Queue Card** | Displays queue information with grouped items preview and action buttons |
| **Activate/Deactivate** | Toggle queue active state for execution control |
| **Delete Queue** | Remove queue with confirmation dialog |
| **Merge Queues** | Combine multiple queues (if multiple exist) |
| **Status Footer** | Visual indicator showing if queue is ready (active) or pending (inactive/conflicts) |
| **Loading State** | Skeleton placeholders during data fetch |
| **Empty State** | Friendly message when no queue exists |

---

## Usage Guide

### Basic Workflow

1. **Check Queue Status**: Review stats cards and status footer to understand queue state
2. **Review Conflicts**: If conflicts warning is shown, resolve conflicts before activation
3. **Activate Queue**: Click "Activate" to enable queue for execution (only if no conflicts)
4. **Deactivate Queue**: Click "Deactivate" to pause execution
5. **Delete Queue**: Click "Delete" to remove the queue (requires confirmation)
6. **Merge Queues**: Use merge action to combine multiple queues when applicable

### Key Interactions

| Interaction | How to Use |
|-------------|------------|
| **Refresh queue** | Click the refresh button to reload queue data |
| **Activate queue** | Click the Activate button on the queue card |
| **Deactivate queue** | Click the Deactivate button to pause the queue |
| **Delete queue** | Click the Delete button, confirm in the dialog |
| **Merge queues** | Select source and target queues, click merge |
| **View status** | Check the status footer for ready/pending indication |

### Queue Status

| Status | Condition | Appearance |
|--------|-----------|------------|
| **Ready/Active** | Total items > 0 AND no conflicts | Green badge with checkmark |
| **Pending/Inactive** | No items OR conflicts exist | Gray/amber badge with clock icon |

### Conflict Resolution

When conflicts are detected:
1. A warning banner appears showing conflict count
2. Queue cannot be activated until conflicts are resolved
3. Status footer shows "Pending" state
4. Resolve conflicts through the Issues panel or related workflows

---

## Components Reference

### Main Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `QueuePage` | `@/pages/QueuePage.tsx` | Main queue management page |
| `QueueCard` | `@/components/issue/queue/QueueCard.tsx` | Queue display with actions |
| `QueuePageSkeleton` | (internal to QueuePage) | Loading placeholder |
| `QueueEmptyState` | (internal to QueuePage) | Empty state display |

### State Management

- **Local state**:
  - None (all data from hooks)

- **Custom hooks**:
  - `useIssueQueue` - Queue data fetching
  - `useQueueMutations` - Queue operations (activate, deactivate, delete, merge)

### Mutation States

| State | Loading Indicator |
|-------|------------------|
| `isActivating` | Disable activate button during activation |
| `isDeactivating` | Disable deactivate button during deactivation |
| `isDeleting` | Disable delete button during deletion |
| `isMerging` | Disable merge button during merge operation |

---

## Configuration

No configuration required. Queue data is automatically fetched from the backend.

### Queue Data Structure

```typescript
interface QueueData {
  tasks: Task[];
  solutions: Solution[];
  conflicts: Conflict[];
  grouped_items: Record<string, GroupedItem>;
}
```

---

## Related Links

- [Issue Hub](/features/issue-hub) - Unified issues, queue, and discovery management
- [Discovery](/features/discovery) - Discovery session tracking
- [Issues Panel](/features/issue-hub) - Issue list and GitHub sync
