// ========================================
// Default Dashboard Layouts
// ========================================
// Default widget configurations and responsive layouts for the dashboard grid

import type { WidgetConfig, DashboardLayouts, DashboardLayoutState } from '@/types/store';

/** Widget IDs used across the dashboard */
export const WIDGET_IDS = {
  WORKFLOW_TASK: 'workflow-task',
  RECENT_SESSIONS: 'recent-sessions',
} as const;

/** Default widget configurations */
export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { i: WIDGET_IDS.WORKFLOW_TASK, name: 'Workflow & Tasks', visible: true, minW: 6, minH: 4 },
  { i: WIDGET_IDS.RECENT_SESSIONS, name: 'Recent Sessions', visible: true, minW: 6, minH: 3 },
];

/** Default responsive layouts */
export const DEFAULT_LAYOUTS: DashboardLayouts = {
  lg: [
    // Row 1: Combined WorkflowTask (full width - includes Stats, Workflow, Tasks, Heatmap)
    { i: WIDGET_IDS.WORKFLOW_TASK, x: 0, y: 0, w: 12, h: 5, minW: 6, minH: 4 },
    // Row 2: Recent Sessions (full width)
    { i: WIDGET_IDS.RECENT_SESSIONS, x: 0, y: 5, w: 12, h: 4, minW: 6, minH: 3 },
  ],
  md: [
    // Medium: Stack vertically, full width each
    { i: WIDGET_IDS.WORKFLOW_TASK, x: 0, y: 0, w: 6, h: 5, minW: 4, minH: 4 },
    { i: WIDGET_IDS.RECENT_SESSIONS, x: 0, y: 5, w: 6, h: 4, minW: 4, minH: 3 },
  ],
  sm: [
    // Small: Stack vertically
    { i: WIDGET_IDS.WORKFLOW_TASK, x: 0, y: 0, w: 2, h: 8, minW: 2, minH: 6 },
    { i: WIDGET_IDS.RECENT_SESSIONS, x: 0, y: 8, w: 2, h: 5, minW: 2, minH: 4 },
  ],
};

/** Default dashboard layout state */
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayoutState = {
  widgets: DEFAULT_WIDGETS,
  layouts: DEFAULT_LAYOUTS,
};

/** Grid breakpoints matching Tailwind config */
export const GRID_BREAKPOINTS = { lg: 1024, md: 768, sm: 640 };

/** Grid columns per breakpoint */
export const GRID_COLS = { lg: 12, md: 6, sm: 2 };

/** Row height in pixels */
export const GRID_ROW_HEIGHT = 60;
