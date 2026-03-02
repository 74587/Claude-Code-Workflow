// ========================================
// Router Configuration
// ========================================
// React Router v6 configuration with code splitting for optimal bundle size

import { createBrowserRouter, RouteObject, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppShell } from '@/components/layout';

// Import HomePage directly (no lazy - needed immediately)
import { HomePage } from '@/pages/HomePage';

// Lazy load all other route components for code splitting
const SessionsPage = lazy(() => import('@/pages/SessionsPage').then(m => ({ default: m.SessionsPage })));
const FixSessionPage = lazy(() => import('@/pages/FixSessionPage').then(m => ({ default: m.FixSessionPage })));
const ProjectOverviewPage = lazy(() => import('@/pages/ProjectOverviewPage').then(m => ({ default: m.ProjectOverviewPage })));
const SessionDetailPage = lazy(() => import('@/pages/SessionDetailPage').then(m => ({ default: m.SessionDetailPage })));
const HistoryPage = lazy(() => import('@/pages/HistoryPage').then(m => ({ default: m.HistoryPage })));
const OrchestratorPage = lazy(() => import('@/pages/orchestrator/OrchestratorPage').then(m => ({ default: m.OrchestratorPage })));
const IssueHubPage = lazy(() => import('@/pages/IssueHubPage').then(m => ({ default: m.IssueHubPage })));
const SkillsManagerPage = lazy(() => import('@/pages/SkillsManagerPage').then(m => ({ default: m.SkillsManagerPage })));
const CommandsManagerPage = lazy(() => import('@/pages/CommandsManagerPage').then(m => ({ default: m.CommandsManagerPage })));
const MemoryPage = lazy(() => import('@/pages/MemoryPage').then(m => ({ default: m.MemoryPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const LiteTasksPage = lazy(() => import('@/pages/LiteTasksPage').then(m => ({ default: m.LiteTasksPage })));
const ReviewSessionPage = lazy(() => import('@/pages/ReviewSessionPage').then(m => ({ default: m.ReviewSessionPage })));
const McpManagerPage = lazy(() => import('@/pages/McpManagerPage').then(m => ({ default: m.McpManagerPage })));
const EndpointsPage = lazy(() => import('@/pages/EndpointsPage').then(m => ({ default: m.EndpointsPage })));
const InstallationsPage = lazy(() => import('@/pages/InstallationsPage').then(m => ({ default: m.InstallationsPage })));
const HookManagerPage = lazy(() => import('@/pages/HookManagerPage').then(m => ({ default: m.HookManagerPage })));
const RulesManagerPage = lazy(() => import('@/pages/RulesManagerPage').then(m => ({ default: m.RulesManagerPage })));
const PromptHistoryPage = lazy(() => import('@/pages/PromptHistoryPage').then(m => ({ default: m.PromptHistoryPage })));
const ExplorerPage = lazy(() => import('@/pages/ExplorerPage').then(m => ({ default: m.ExplorerPage })));
const GraphExplorerPage = lazy(() => import('@/pages/GraphExplorerPage').then(m => ({ default: m.GraphExplorerPage })));
const CodexLensManagerPage = lazy(() => import('@/pages/CodexLensManagerPage').then(m => ({ default: m.CodexLensManagerPage })));
const ApiSettingsPage = lazy(() => import('@/pages/ApiSettingsPage').then(m => ({ default: m.ApiSettingsPage })));
const CliViewerPage = lazy(() => import('@/pages/CliViewerPage').then(m => ({ default: m.CliViewerPage })));
const CliSessionSharePage = lazy(() => import('@/pages/CliSessionSharePage').then(m => ({ default: m.CliSessionSharePage })));
const TeamPage = lazy(() => import('@/pages/TeamPage').then(m => ({ default: m.TeamPage })));
const TerminalDashboardPage = lazy(() => import('@/pages/TerminalDashboardPage').then(m => ({ default: m.TerminalDashboardPage })));
const AnalysisPage = lazy(() => import('@/pages/AnalysisPage').then(m => ({ default: m.AnalysisPage })));
const SpecsSettingsPage = lazy(() => import('@/pages/SpecsSettingsPage').then(m => ({ default: m.SpecsSettingsPage })));

// Loading fallback component for lazy-loaded routes
function PageSkeleton() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/**
 * Route configuration for the dashboard
 * All routes are wrapped in AppShell layout with Suspense for code splitting
 */
const routes: RouteObject[] = [
  {
    path: 'cli-sessions/share',
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <CliSessionSharePage />
      </Suspense>
    ),
  },
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
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <SessionsPage />
          </Suspense>
        ),
      },
      {
        path: 'sessions/:sessionId',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <SessionDetailPage />
          </Suspense>
        ),
      },
      {
        path: 'sessions/:sessionId/fix',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <FixSessionPage />
          </Suspense>
        ),
      },
      {
        path: 'sessions/:sessionId/review',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <ReviewSessionPage />
          </Suspense>
        ),
      },
      {
        path: 'lite-tasks',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <LiteTasksPage />
          </Suspense>
        ),
      },
      // /lite-tasks/:sessionId route removed - now using TaskDrawer
      {
        path: 'project',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <ProjectOverviewPage />
          </Suspense>
        ),
      },
      {
        path: 'history',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <HistoryPage />
          </Suspense>
        ),
      },
      {
        path: 'orchestrator',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <OrchestratorPage />
          </Suspense>
        ),
      },
      {
        path: 'loops',
        element: <Navigate to="/terminal-dashboard" replace />,
      },
      {
        path: 'cli-viewer',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <CliViewerPage />
          </Suspense>
        ),
      },
      {
        path: 'issues',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <IssueHubPage />
          </Suspense>
        ),
      },
      // Legacy routes - redirect to hub with tab parameter
      {
        path: 'issues/queue',
        element: <Navigate to="/issues?tab=queue" replace />,
      },
      {
        path: 'issues/discovery',
        element: <Navigate to="/issues?tab=discovery" replace />,
      },
      {
        path: 'skills',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <SkillsManagerPage />
          </Suspense>
        ),
      },
      {
        path: 'commands',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <CommandsManagerPage />
          </Suspense>
        ),
      },
      {
        path: 'memory',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <MemoryPage />
          </Suspense>
        ),
      },
      {
        path: 'prompts',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <PromptHistoryPage />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <SettingsPage />
          </Suspense>
        ),
      },
      {
        path: 'settings/mcp',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <McpManagerPage />
          </Suspense>
        ),
      },
      {
        path: 'settings/endpoints',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <EndpointsPage />
          </Suspense>
        ),
      },
      {
        path: 'settings/installations',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <InstallationsPage />
          </Suspense>
        ),
      },
      {
        path: 'settings/rules',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <RulesManagerPage />
          </Suspense>
        ),
      },
      {
        path: 'settings/specs',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <SpecsSettingsPage />
          </Suspense>
        ),
      },
      {
        path: 'settings/codexlens',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <CodexLensManagerPage />
          </Suspense>
        ),
      },
      {
        path: 'api-settings',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <ApiSettingsPage />
          </Suspense>
        ),
      },
      {
        path: 'hooks',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <HookManagerPage />
          </Suspense>
        ),
      },
      {
        path: 'explorer',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <ExplorerPage />
          </Suspense>
        ),
      },
      {
        path: 'graph',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <GraphExplorerPage />
          </Suspense>
        ),
      },
      {
        path: 'teams',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <TeamPage />
          </Suspense>
        ),
      },
      {
        path: 'analysis',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <AnalysisPage />
          </Suspense>
        ),
      },
      {
        path: 'terminal-dashboard',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <TerminalDashboardPage />
          </Suspense>
        ),
      },
      {
        path: 'skill-hub',
        element: <Navigate to="/skills?tab=hub" replace />,
      },
      // Catch-all route for 404
      {
        path: '*',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <NotFoundPage />
          </Suspense>
        ),
      },
    ],
  },
];

/**
 * Create the browser router instance
 * Uses basename from Vite's BASE_URL environment variable
 */
const basename = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

export const router = createBrowserRouter(routes, {
  basename,
});

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
  /** @deprecated Redirects to /terminal-dashboard */
  LOOPS: '/loops',
  CLI_VIEWER: '/cli-viewer',
  ISSUES: '/issues',
  // Legacy issue routes - use ISSUES with ?tab parameter instead
  ISSUE_QUEUE: '/issues?tab=queue',
  ISSUE_DISCOVERY: '/issues?tab=discovery',
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
  CODEXLENS_MANAGER: '/settings/codexlens',
  API_SETTINGS: '/api-settings',
  EXPLORER: '/explorer',
  GRAPH: '/graph',
  TEAMS: '/teams',
  TERMINAL_DASHBOARD: '/terminal-dashboard',
  SKILL_HUB: '/skill-hub',
  ANALYSIS: '/analysis',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
