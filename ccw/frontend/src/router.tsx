// ========================================
// Router Configuration
// ========================================
// React Router v6 configuration with all dashboard routes

import { createBrowserRouter, RouteObject } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import {
  HomePage,
  SessionsPage,
  FixSessionPage,
  ProjectOverviewPage,
  SessionDetailPage,
  HistoryPage,
  OrchestratorPage,
  LoopMonitorPage,
  IssueManagerPage,
  SkillsManagerPage,
  CommandsManagerPage,
  MemoryPage,
  SettingsPage,
  HelpPage,
  NotFoundPage,
  LiteTasksPage,
  LiteTaskDetailPage,
  ReviewSessionPage,
  McpManagerPage,
  EndpointsPage,
  InstallationsPage,
} from '@/pages';

/**
 * Route configuration for the dashboard
 * All routes are wrapped in AppShell layout
 */
const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'sessions',
        element: <SessionsPage />,
      },
      {
        path: 'sessions/:sessionId',
        element: <SessionDetailPage />,
      },
      {
        path: 'sessions/:sessionId/fix',
        element: <FixSessionPage />,
      },
      {
        path: 'sessions/:sessionId/review',
        element: <ReviewSessionPage />,
      },
      {
        path: 'lite-tasks',
        element: <LiteTasksPage />,
      },
      {
        path: 'lite-tasks/:sessionId',
        element: <LiteTaskDetailPage />,
      },
      {
        path: 'project',
        element: <ProjectOverviewPage />,
      },
      {
        path: 'history',
        element: <HistoryPage />,
      },
      {
        path: 'orchestrator',
        element: <OrchestratorPage />,
      },
      {
        path: 'loops',
        element: <LoopMonitorPage />,
      },
      {
        path: 'issues',
        element: <IssueManagerPage />,
      },
      {
        path: 'skills',
        element: <SkillsManagerPage />,
      },
      {
        path: 'commands',
        element: <CommandsManagerPage />,
      },
      {
        path: 'memory',
        element: <MemoryPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'settings/mcp',
        element: <McpManagerPage />,
      },
      {
        path: 'settings/endpoints',
        element: <EndpointsPage />,
      },
      {
        path: 'settings/installations',
        element: <InstallationsPage />,
      },
      {
        path: 'help',
        element: <HelpPage />,
      },
      // Catch-all route for 404
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
];

/**
 * Create the browser router instance
 */
export const router = createBrowserRouter(routes);

/**
 * Export route paths for type-safe navigation
 */
export const ROUTES = {
  HOME: '/',
  SESSIONS: '/sessions',
  SESSION_DETAIL: '/sessions/:sessionId',
  FIX_SESSION: '/sessions/:sessionId/fix',
  REVIEW_SESSION: '/sessions/:sessionId/review',
  LITE_TASKS: '/lite-tasks',
  LITE_TASK_DETAIL: '/lite-tasks/:sessionId',
  PROJECT: '/project',
  HISTORY: '/history',
  ORCHESTRATOR: '/orchestrator',
  LOOPS: '/loops',
  ISSUES: '/issues',
  SKILLS: '/skills',
  COMMANDS: '/commands',
  MEMORY: '/memory',
  SETTINGS: '/settings',
  MCP_MANAGER: '/settings/mcp',
  ENDPOINTS: '/settings/endpoints',
  INSTALLATIONS: '/settings/installations',
  HELP: '/help',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
