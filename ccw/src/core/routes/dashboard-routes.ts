/**
 * Dashboard Routes Module
 * Provides API endpoints for dashboard initialization and configuration
 *
 * Endpoints:
 * - GET /api/dashboard/init - Returns initial dashboard data (projectPath, recentPaths, platform, initialData)
 * - GET /api/workflow-status-counts - Returns workflow status distribution
 */

import { existsSync } from 'fs';
import { join } from 'path';
import type { RouteContext } from './types.js';
import { getRecentPaths, normalizePathForDisplay, resolvePath } from '../../utils/path-resolver.js';
import { scanSessions } from '../session-scanner.js';

/**
 * Dashboard initialization response structure
 */
interface DashboardInitResponse {
  projectPath: string;
  recentPaths: string[];
  platform: string;
  initialData: {
    generatedAt: string;
    activeSessions: unknown[];
    archivedSessions: unknown[];
    liteTasks: {
      litePlan: unknown[];
      liteFix: unknown[];
      multiCliPlan: unknown[];
    };
    reviewData: {
      dimensions: Record<string, unknown>;
    };
    projectOverview: null;
    statistics: {
      totalSessions: number;
      activeSessions: number;
      totalTasks: number;
      completedTasks: number;
      reviewFindings: number;
      litePlanCount: number;
      liteFixCount: number;
      multiCliPlanCount: number;
    };
  };
}

/**
 * Workflow status count structure
 */
interface WorkflowStatusCount {
  status: 'planning' | 'in_progress' | 'completed' | 'paused' | 'archived';
  count: number;
  percentage: number;
}

/**
 * Handle dashboard routes
 * @returns true if route was handled, false otherwise
 */
export async function handleDashboardRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, initialPath } = ctx;

  // GET /api/dashboard/init - Return initial dashboard data
  if (pathname === '/api/dashboard/init' && req.method === 'GET') {
    try {
      const response: DashboardInitResponse = {
        projectPath: normalizePathForDisplay(initialPath),
        recentPaths: getRecentPaths(),
        platform: process.platform,
        initialData: {
          generatedAt: new Date().toISOString(),
          activeSessions: [],
          archivedSessions: [],
          liteTasks: {
            litePlan: [],
            liteFix: [],
            multiCliPlan: []
          },
          reviewData: {
            dimensions: {}
          },
          projectOverview: null,
          statistics: {
            totalSessions: 0,
            activeSessions: 0,
            totalTasks: 0,
            completedTasks: 0,
            reviewFindings: 0,
            litePlanCount: 0,
            liteFixCount: 0,
            multiCliPlanCount: 0
          }
        }
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: (error as Error).message
      }));
      return true;
    }
  }

  // GET /api/workflow-status-counts - Return workflow status distribution
  if (pathname === '/api/workflow-status-counts' && req.method === 'GET') {
    try {
      const projectPath = ctx.url.searchParams.get('projectPath') || initialPath;
      const resolvedPath = resolvePath(projectPath);
      const workflowDir = join(resolvedPath, '.workflow');

      // Initialize counts for all statuses
      const statusCounts: Record<string, number> = {
        planning: 0,
        in_progress: 0,
        completed: 0,
        paused: 0,
        archived: 0
      };

      // Scan sessions if .workflow directory exists
      if (existsSync(workflowDir)) {
        const sessions = await scanSessions(workflowDir);

        // Count active sessions by status
        // Map session statuses: 'active' -> 'in_progress' (frontend convention)
        for (const session of sessions.active) {
          const rawStatus = session.status || 'active';
          const status = rawStatus === 'active' ? 'in_progress' : rawStatus;
          if (status in statusCounts) {
            statusCounts[status]++;
          } else {
            statusCounts.in_progress++;
          }
        }

        // All archived sessions count as 'archived'
        statusCounts.archived = sessions.archived.length;
      }

      // Calculate total and percentages
      const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
      const result: WorkflowStatusCount[] = Object.entries(statusCounts)
        .map(([status, count]) => ({
          status: status as WorkflowStatusCount['status'],
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0
        }))
        .filter(item => item.count > 0); // Only include statuses with non-zero counts

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
      return true;
    }
  }

  return false;
}
