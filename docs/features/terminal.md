# Terminal Dashboard

## One-Liner

**The Terminal Dashboard provides a terminal-first workspace with resizable panes, floating panels, and integrated tools for session monitoring and orchestration.**

---

## Pain Points Solved

| Pain Point | Current State | Terminal Dashboard Solution |
|------------|---------------|-----------------------------|
| **Scattered terminals** | Multiple terminal windows | Unified tmux-style grid layout |
| **No context linkage** | Can't associate terminal output with issues | Association highlight provider |
| **Panel overload** | Fixed layout wastes space | Floating panels (mutually exclusive) |
| **Missing tools** | Switch between apps | Integrated issues, queue, inspector, scheduler |
| **Limited workspace** | Can't see code and terminals together | Resizable three-column layout |

---

## Page Overview

**Location**: `ccw/frontend/src/pages/TerminalDashboardPage.tsx`

**Purpose**: Terminal-first layout for multi-terminal session management with integrated tools and resizable panels.

**Access**: Navigation → Terminal Dashboard

### Layout

```
+--------------------------------------------------------------------------+
|  Dashboard Toolbar (panel toggles, layout presets, fullscreen)              |
+--------------------------------------------------------------------------+
|  +----------------+-------------------------------------------+------------+ |
|  | Session        |  Terminal Grid (tmux-style)             | File       | |
|  | Group Tree     |  +----------+  +----------+              | Sidebar    | |
|  | (resizable)    |  | Term 1   |  | Term 2   |              | (resizable)| |
|  |                |  +----------+  +----------+              |            | |
|  |                |  +----------+  +----------+              |            | |
|  |                |  | Term 3   |  | Term 4   |              |            | |
|  |                |  +----------+  +----------+              |            | |
|  +----------------+-------------------------------------------+------------+ |
+--------------------------------------------------------------------------+
|  [Floating Panel: Issues+Queue OR Inspector OR Execution OR Scheduler]   |
+--------------------------------------------------------------------------+
```

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Three-Column Layout** | Resizable panes using Allotment: Session tree (left), Terminal grid (center), File sidebar (right) |
| **Terminal Grid** | Tmux-style split panes with layout presets (single, split-h, split-v, grid-2x2) |
| **Session Group Tree** | Hierarchical view of CLI sessions with grouping by tags |
| **Floating Panels** | Mutually exclusive overlay panels (Issues+Queue, Inspector, Execution Monitor, Scheduler) |
| **Association Highlight** | Cross-panel linking between terminals, issues, and queue items |
| **Layout Presets** | Quick layout buttons: single pane, horizontal split, vertical split, 2x2 grid |
| **Launch CLI** | Config modal for creating new CLI sessions with tool, model, and settings |
| **Fullscreen Mode** | Immersive mode hides app chrome (header + sidebar) |
| **Feature Flags** | Panel visibility controlled by feature flags (queue, inspector, execution monitor) |

---

## Usage Guide

### Basic Workflow

1. **Launch CLI Session**: Click "Launch CLI" button, configure options (tool, model, shell, working directory)
2. **Arrange Terminals**: Use layout presets or manually split panes
3. **Navigate Sessions**: Browse session groups in the left tree
4. **Toggle Panels**: Click toolbar buttons to show/hide floating panels
5. **Inspect Issues**: Open Issues panel to view associated issues
6. **Monitor Execution**: Use Execution Monitor panel for real-time tracking

### Key Interactions

| Interaction | How to Use |
|-------------|------------|
| **Launch CLI** | Click "Launch CLI" button, configure session in modal |
| **Toggle sidebar** | Click Sessions/Files button in toolbar |
| **Open floating panel** | Click Issues/Queue/Inspector/Execution/Scheduler button |
| **Close floating panel** | Click X on panel or toggle button again |
| **Resize panes** | Drag the divider between panes |
| **Change layout** | Click layout preset buttons (single/split/grid) |
| **Fullscreen mode** | Click fullscreen button to hide app chrome |

### Panel Types

| Panel | Content | Position |
|-------|---------|----------|
| **Issues+Queue** | Combined Issues panel + Queue list column | Left (overlay) |
| **Queue** | Full queue management panel | Right (overlay, feature flag) |
| **Inspector** | Association chain inspector | Right (overlay, feature flag) |
| **Execution Monitor** | Real-time execution tracking | Right (overlay, feature flag) |
| **Scheduler** | Queue scheduler controls | Right (overlay) |

### Layout Presets

| Preset | Layout |
|--------|--------|
| **Single** | One terminal pane |
| **Split-H** | Two panes side by side |
| **Split-V** | Two panes stacked vertically |
| **Grid-2x2** | Four panes in 2x2 grid |

---

## Components Reference

### Main Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `TerminalDashboardPage` | `@/pages/TerminalDashboardPage.tsx` | Main terminal dashboard page |
| `DashboardToolbar` | `@/components/terminal-dashboard/DashboardToolbar.tsx` | Top toolbar with panel toggles |
| `SessionGroupTree` | `@/components/terminal-dashboard/SessionGroupTree.tsx` | Session tree navigation |
| `TerminalGrid` | `@/components/terminal-dashboard/TerminalGrid.tsx` | Tmux-style terminal panes |
| `FileSidebarPanel` | `@/components/terminal-dashboard/FileSidebarPanel.tsx` | File explorer sidebar |
| `FloatingPanel` | `@/components/terminal-dashboard/FloatingPanel.tsx` | Overlay panel wrapper |
| `IssuePanel` | `@/components/terminal-dashboard/IssuePanel.tsx` | Issues list panel |
| `QueuePanel` | `@/components/terminal-dashboard/QueuePanel.tsx` | Queue management panel |
| `QueueListColumn` | `@/components/terminal-dashboard/QueueListColumn.tsx` | Queue list (compact) |
| `SchedulerPanel` | `@/components/terminal-dashboard/SchedulerPanel.tsx` | Queue scheduler controls |
| `InspectorContent` | `@/components/terminal-dashboard/BottomInspector.tsx` | Association inspector |
| `ExecutionMonitorPanel` | `@/components/terminal-dashboard/ExecutionMonitorPanel.tsx` | Execution tracking |

### State Management

- **Local state** (TerminalDashboardPage):
  - `activePanel`: PanelId | null
  - `isFileSidebarOpen`: boolean
  - `isSessionSidebarOpen`: boolean

- **Zustand stores**:
  - `useWorkflowStore` - Project path
  - `useAppStore` - Immersive mode state
  - `useConfigStore` - Feature flags
  - `useTerminalGridStore` - Terminal grid layout and focused pane
  - `useExecutionMonitorStore` - Active execution count
  - `useQueueSchedulerStore` - Scheduler status

---

## Configuration

### Panel IDs

```typescript
type PanelId = 'issues' | 'queue' | 'inspector' | 'execution' | 'scheduler';
```

### Feature Flags

| Flag | Controls |
|------|----------|
| `dashboardQueuePanelEnabled` | Queue panel visibility |
| `dashboardInspectorEnabled` | Inspector panel visibility |
| `dashboardExecutionMonitorEnabled` | Execution Monitor panel visibility |

---

## Related Links

- [Orchestrator](/features/orchestrator) - Visual workflow editor
- [Sessions](/features/sessions) - Session management
- [Issue Hub](/features/issue-hub) - Issues, queue, discovery
- [Explorer](/features/explorer) - File explorer
