# Dashboard

## One-Liner

**The Dashboard provides an at-a-glance overview of your project's workflow status, statistics, and recent activity through an intuitive widget-based interface.**

---

## Pain Points Solved

| Pain Point | Current State | Dashboard Solution |
|------------|---------------|-------------------|
| **No project visibility** | Can't see overall project health | Project info banner with tech stack and development index |
| **Scattered metrics** | Stats across multiple locations | Centralized statistics with sparklines |
| **Unknown workflow status** | Hard to track session progress | Pie chart with status breakdown |
| **Lost in recent work** | No quick access to active sessions | Session carousel with task details |
| **Indexing status unclear** | Don't know if code is indexed | Real-time index status indicator |

---

## Page Overview

**Location**: `ccw/frontend/src/pages/HomePage.tsx`

**Purpose**: Dashboard home page providing project overview, statistics, workflow status, and recent activity monitoring.

**Access**: Navigation → Dashboard (default home page)

### Layout

```
+--------------------------------------------------------------------------+
|  Dashboard Header (title + refresh)                                      |
+--------------------------------------------------------------------------+
|  WorkflowTaskWidget (Combined Card)                                      |
|  +--------------------------------------------------------------------+  |
|  | Project Info Banner (expandable)                                   |  |
|  | - Project name, description, tech stack badges                      |  |
|  | - Quick stats (features, bugfixes, enhancements)                    |  |
|  | - Index status indicator                                           |  |
|  +----------------------------------+---------------------------------+  |
|  | Stats Section | Workflow Status |  Task Details (Carousel)     |  |
|  | - 6 mini cards | - Pie chart     | - Session nav                 |  |
|  | - Sparklines   | - Legend       | - Task list (2 columns)       |  |
|  +----------------+-----------------+-------------------------------+  |
+--------------------------------------------------------------------------+
|  RecentSessionsWidget                                                     |
|  +--------------------------------------------------------------------+  |
|  | Tabs: All Tasks | Workflow | Lite Tasks                           |  |
|  | +---------------+---------------+-------------------------------+ |  |
|  | | Task cards with status, progress, tags, time                     | |  |
|  | +---------------------------------------------------------------+ |  |
+--------------------------------------------------------------------------+
```

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Project Info Banner** | Expandable banner showing project name, description, tech stack (languages, frameworks, architecture), development index (features/bugfixes/enhancements), and real-time index status |
| **Statistics Section** | 6 mini stat cards (Active Sessions, Total Tasks, Completed Tasks, Pending Tasks, Failed Tasks, Today Activity) with 7-day sparkline trends |
| **Workflow Status Pie Chart** | Donut chart showing session status breakdown (completed, in progress, planning, paused, archived) with percentages |
| **Session Carousel** | Auto-rotating (5s) session cards with task list, progress bar, and manual navigation arrows |
| **Recent Sessions Widget** | Tabbed view of recent tasks across all task types with filtering, status badges, and progress indicators |
| **Real-time Updates** | Auto-refresh every 60 seconds for stats and 30 seconds for index status |

---

## Usage Guide

### Basic Workflow

1. **View Project Overview**: Check the project info banner for tech stack and development index
2. **Monitor Statistics**: Review mini stat cards for current project metrics and trends
3. **Track Workflow Status**: View pie chart for session status distribution
4. **Browse Active Sessions**: Use session carousel to see task details and progress
5. **Access Recent Work**: Switch between All Tasks/Workflow/Lite Tasks tabs to find specific sessions

### Key Interactions

| Interaction | How to Use |
|-------------|------------|
| **Expand Project Details** | Click the chevron button in the project banner to show architecture, components, patterns |
| **Navigate Sessions** | Click arrow buttons or wait for auto-rotation (5s interval) in the carousel |
| **View Session Details** | Click on any session card to navigate to session detail page |
| **Filter Recent Tasks** | Click tab buttons to filter by task type (All/Workflow/Lite) |
| **Refresh Dashboard** | Click the refresh button in the header to reload all data |

### Index Status Indicator

| Status | Icon | Meaning |
|--------|------|---------|
| **Building** | Pulsing blue dot | Code index is being built/updated |
| **Completed** | Green dot | Index is up-to-date |
| **Idle** | Gray dot | Index status is unknown/idle |
| **Failed** | Red dot | Index build failed |

---

## Components Reference

### Main Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DashboardHeader` | `@/components/dashboard/DashboardHeader.tsx` | Page header with title and refresh action |
| `WorkflowTaskWidget` | `@/components/dashboard/widgets/WorkflowTaskWidget.tsx` | Combined widget with project info, stats, workflow status, and session carousel |
| `RecentSessionsWidget` | `@/components/dashboard/widgets/RecentSessionsWidget.tsx` | Recent sessions across workflow and lite tasks |
| `MiniStatCard` | (internal to WorkflowTaskWidget) | Individual stat card with optional sparkline |
| `HomeEmptyState` | (internal to WorkflowTaskWidget) | Empty state display when no sessions exist |

### State Management

- **Local state**:
  - `hasError` - Error tracking for critical failures
  - `projectExpanded` - Project info banner expansion state
  - `currentSessionIndex` - Active session in carousel
  - `activeTab` - Recent sessions widget filter tab

- **Custom hooks**:
  - `useWorkflowStatusCounts` - Session status distribution data
  - `useDashboardStats` - Statistics with auto-refresh (60s)
  - `useProjectOverview` - Project information and tech stack
  - `useIndexStatus` - Real-time index status (30s refresh)
  - `useSessions` - Active sessions data
  - `useLiteTasks` - Lite tasks data for recent widget

---

## Configuration

No configuration required. The dashboard automatically fetches data from the backend.

### Auto-Refresh Intervals

| Data Type | Interval |
|-----------|----------|
| Dashboard stats | 60 seconds |
| Index status | 30 seconds |
| Discovery sessions | 3 seconds (on discovery page) |

---

## Related Links

- [Sessions](/features/sessions) - View and manage all sessions
- [Queue](/features/queue) - Issue execution queue management
- [Discovery](/features/discovery) - Discovery session tracking
- [Memory](/features/memory) - Persistent memory management
- [System Settings](/features/system-settings) - Global application settings
