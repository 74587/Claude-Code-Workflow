/**
 * Dashboard Routes Module
 * Provides API endpoints for dashboard initialization and configuration
 *
 * Endpoints:
 * - GET /api/dashboard/init - Returns initial dashboard data (projectPath, recentPaths, platform, initialData)
 */

import type { RouteContext } from './types.js';
import { getRecentPaths, normalizePathForDisplay } from '../../utils/path-resolver.js';

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

  return false;
}
