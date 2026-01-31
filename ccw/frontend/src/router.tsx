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
  // LiteTaskDetailPage removed - now using TaskDrawer instead
  ReviewSessionPage,
  McpManagerPage,
  EndpointsPage,
  InstallationsPage,
  ExecutionMonitorPage,
  HookManagerPage,
  RulesManagerPage,
  PromptHistoryPage,
  ExplorerPage,
  GraphExplorerPage,
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
      // /lite-tasks/:sessionId route removed - now using TaskDrawer
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
        path: 'executions',
        element: <ExecutionMonitorPage />,
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
        path: 'prompts',
        element: <PromptHistoryPage />,
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
        path: 'settings/rules',
        element: <RulesManagerPage />,
      },
      {
        path: 'help',
        element: <HelpPage />,
      },
      {
        path: 'hooks',
        element: <HookManagerPage />,
      },
      {
        path: 'explorer',
        element: <ExplorerPage />,
      },
      {
        path: 'graph',
        element: <GraphExplorerPage />,
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
  // LITE_TASK_DETAIL removed - now using TaskDrawer
  PROJECT: '/project',
  HISTORY: '/history',
  ORCHESTRATOR: '/orchestrator',
  EXECUTIONS: '/executions',
  LOOPS: '/loops',
  ISSUES: '/issues',
  SKILLS: '/skills',
  COMMANDS: '/commands',
  MEMORY: '/memory',
  PROMPT_HISTORY: '/prompts',
  SETTINGS: '/settings',
  HOOKS_MANAGER: '/hooks',
  MCP_MANAGER: '/settings/mcp',
  ENDPOINTS: '/settings/endpoints',
  INSTALLATIONS: '/settings/installations',
  SETTINGS_RULES: '/settings/rules',
  HELP: '/help',
  EXPLORER: '/explorer',
  GRAPH: '/graph',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
