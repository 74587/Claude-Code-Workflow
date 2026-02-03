// ========================================
// Default Dashboard Layouts
// ========================================
// Default widget configurations and responsive layouts for the dashboard grid

import type { WidgetConfig, DashboardLayouts, DashboardLayoutState } from '@/types/store';

/** Widget IDs used across the dashboard */
export const WIDGET_IDS = {
  STATS: 'detailed-stats',
  RECENT_SESSIONS: 'recent-sessions',
  WORKFLOW_STATUS: 'workflow-status-pie',
  ACTIVITY: 'activity-line',
  TASK_TYPES: 'task-type-bar',
} as const;

/** Default widget configurations */
export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { i: WIDGET_IDS.STATS, name: 'Statistics', visible: true, minW: 4, minH: 2 },
  { i: WIDGET_IDS.RECENT_SESSIONS, name: 'Recent Sessions', visible: true, minW: 4, minH: 3 },
  { i: WIDGET_IDS.WORKFLOW_STATUS, name: 'Workflow Status', visible: true, minW: 3, minH: 3 },
  { i: WIDGET_IDS.ACTIVITY, name: 'Activity', visible: true, minW: 4, minH: 3 },
  { i: WIDGET_IDS.TASK_TYPES, name: 'Task Types', visible: true, minW: 3, minH: 3 },
];

/** Default responsive layouts */
export const DEFAULT_LAYOUTS: DashboardLayouts = {
  lg: [
    { i: WIDGET_IDS.STATS, x: 0, y: 0, w: 12, h: 2, minW: 4, minH: 2 },
    { i: WIDGET_IDS.RECENT_SESSIONS, x: 0, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
    { i: WIDGET_IDS.WORKFLOW_STATUS, x: 6, y: 2, w: 6, h: 4, minW: 3, minH: 3 },
    { i: WIDGET_IDS.ACTIVITY, x: 0, y: 6, w: 7, h: 4, minW: 4, minH: 3 },
    { i: WIDGET_IDS.TASK_TYPES, x: 7, y: 6, w: 5, h: 4, minW: 3, minH: 3 },
  ],
  md: [
    { i: WIDGET_IDS.STATS, x: 0, y: 0, w: 6, h: 2, minW: 3, minH: 2 },
    { i: WIDGET_IDS.RECENT_SESSIONS, x: 0, y: 2, w: 6, h: 4, minW: 3, minH: 3 },
    { i: WIDGET_IDS.WORKFLOW_STATUS, x: 0, y: 6, w: 6, h: 4, minW: 3, minH: 3 },
    { i: WIDGET_IDS.ACTIVITY, x: 0, y: 10, w: 6, h: 4, minW: 3, minH: 3 },
    { i: WIDGET_IDS.TASK_TYPES, x: 0, y: 14, w: 6, h: 4, minW: 3, minH: 3 },
  ],
  sm: [
    { i: WIDGET_IDS.STATS, x: 0, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
    { i: WIDGET_IDS.RECENT_SESSIONS, x: 0, y: 3, w: 2, h: 4, minW: 2, minH: 3 },
    { i: WIDGET_IDS.WORKFLOW_STATUS, x: 0, y: 7, w: 2, h: 4, minW: 2, minH: 3 },
    { i: WIDGET_IDS.ACTIVITY, x: 0, y: 11, w: 2, h: 4, minW: 2, minH: 3 },
    { i: WIDGET_IDS.TASK_TYPES, x: 0, y: 15, w: 2, h: 4, minW: 2, minH: 3 },
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
