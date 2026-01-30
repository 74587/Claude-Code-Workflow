// ========================================
// Router Configuration
// ========================================
// React Router v6 configuration with all dashboard routes

import { createBrowserRouter, RouteObject } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import {
  HomePage,
  SessionsPage,
  OrchestratorPage,
  LoopMonitorPage,
  IssueManagerPage,
  SkillsManagerPage,
  CommandsManagerPage,
  MemoryPage,
  SettingsPage,
  HelpPage,
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
        path: 'help',
        element: <HelpPage />,
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
  ORCHESTRATOR: '/orchestrator',
  LOOPS: '/loops',
  ISSUES: '/issues',
  SKILLS: '/skills',
  COMMANDS: '/commands',
  MEMORY: '/memory',
  SETTINGS: '/settings',
  HELP: '/help',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
