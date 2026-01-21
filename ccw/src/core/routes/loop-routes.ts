/**
 * Loop Routes Module
 * CCW Loop System - HTTP API endpoints for Dashboard
 * Reference: .workflow/.scratchpad/loop-system-complete-design-20260121.md section 6.1
 *
 * API Endpoints:
 * - GET    /api/loops                     - List all loops
 * - POST   /api/loops                     - Start new loop from task
 * - GET    /api/loops/stats               - Get loop statistics
 * - GET    /api/loops/:loopId             - Get specific loop details
 * - GET    /api/loops/:loopId/logs        - Get loop execution logs
 * - GET    /api/loops/:loopId/history     - Get execution history (paginated)
 * - POST   /api/loops/:loopId/pause       - Pause loop
 * - POST   /api/loops/:loopId/resume      - Resume loop
 * - POST   /api/loops/:loopId/stop        - Stop loop
 * - POST   /api/loops/:loopId/retry       - Retry failed step
 */

import { join } from 'path';
import { LoopManager } from '../../tools/loop-manager.js';
import type { RouteContext } from './types.js';
import type { LoopState } from '../../types/loop.js';

/**
 * Handle loop routes
 * @returns true if route was handled, false otherwise
 */
export async function handleLoopRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, initialPath, handlePostRequest, url } = ctx;

  // Get workflow directory from initialPath
  const workflowDir = initialPath || process.cwd();
  const loopManager = new LoopManager(workflowDir);

  // ==== EXACT PATH ROUTES (must come first) ====

  // GET /api/loops/stats - Get loop statistics
  if (pathname === '/api/loops/stats' && req.method === 'GET') {
    try {
      const loops = await loopManager.listLoops();
      const stats = computeLoopStats(loops);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: stats, timestamp: new Date().toISOString() }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // POST /api/loops - Start new loop from task
  if (pathname === '/api/loops' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { taskId } = body as { taskId?: string };

      if (!taskId) {
        return { success: false, error: 'taskId is required', status: 400 };
      }

      try {
        // Read task config from .task directory
        const taskPath = join(workflowDir, '.task', taskId + '.json');
        const { readFile } = await import('fs/promises');
        const { existsSync } = await import('fs');

        if (!existsSync(taskPath)) {
          return { success: false, error: 'Task not found: ' + taskId, status: 404 };
        }

        const taskContent = await readFile(taskPath, 'utf-8');
        const task = JSON.parse(taskContent);

        if (!task.loop_control?.enabled) {
          return { success: false, error: 'Task ' + taskId + ' does not have loop enabled', status: 400 };
        }

        const loopId = await loopManager.startLoop(task);

        return { success: true, data: { loopId, taskId } };
      } catch (error) {
        return { success: false, error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // GET /api/loops - List all loops
  if (pathname === '/api/loops' && req.method === 'GET') {
    try {
      const loops = await loopManager.listLoops();

      // Parse query params for filtering
      const searchParams = url?.searchParams;
      let filteredLoops = loops;

      // Filter by status
      const statusFilter = searchParams?.get('status');
      if (statusFilter && statusFilter !== 'all') {
        filteredLoops = filteredLoops.filter(l => l.status === statusFilter);
      }

      // Sort by updated_at (most recent first)
      filteredLoops.sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: filteredLoops,
        total: filteredLoops.length,
        timestamp: new Date().toISOString()
      }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // ==== NESTED PATH ROUTES (more specific patterns first) ====

  // GET /api/loops/:loopId/logs - Get loop execution logs
  if (pathname.match(/\/api\/loops\/[^/]+\/logs$/) && req.method === 'GET') {
    const loopId = pathname.split('/').slice(-2)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    try {
      const state = await loopManager.getStatus(loopId);

      // Extract logs from state_variables
      const logs: Array<{
        step_id: string;
        stdout: string;
        stderr: string;
        timestamp?: string;
      }> = [];

      // Group by step_id
      const stepIds = new Set<string>();
      for (const key of Object.keys(state.state_variables || {})) {
        const match = key.match(/^(.+)_(stdout|stderr)$/);
        if (match) stepIds.add(match[1]);
      }

      for (const stepId of stepIds) {
        logs.push({
          step_id: stepId,
          stdout: state.state_variables?.[`${stepId}_stdout`] || '',
          stderr: state.state_variables?.[`${stepId}_stderr`] || ''
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          loop_id: loopId,
          logs,
          total: logs.length
        }
      }));
      return true;
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Loop not found' }));
      return true;
    }
  }

  // GET /api/loops/:loopId/history - Get execution history (paginated)
  if (pathname.match(/\/api\/loops\/[^/]+\/history$/) && req.method === 'GET') {
    const loopId = pathname.split('/').slice(-2)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    try {
      const state = await loopManager.getStatus(loopId);
      const history = state.execution_history || [];

      // Parse pagination params
      const searchParams = url?.searchParams;
      const limit = parseInt(searchParams?.get('limit') || '50', 10);
      const offset = parseInt(searchParams?.get('offset') || '0', 10);

      // Slice history for pagination
      const paginatedHistory = history.slice(offset, offset + limit);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: paginatedHistory,
        total: history.length,
        limit,
        offset,
        hasMore: offset + limit < history.length
      }));
      return true;
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Loop not found' }));
      return true;
    }
  }

  // POST /api/loops/:loopId/pause - Pause loop
  if (pathname.match(/\/api\/loops\/[^/]+\/pause$/) && req.method === 'POST') {
    const loopId = pathname.split('/').slice(-2)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    try {
      await loopManager.pauseLoop(loopId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Loop paused' }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // POST /api/loops/:loopId/resume - Resume loop
  if (pathname.match(/\/api\/loops\/[^/]+\/resume$/) && req.method === 'POST') {
    const loopId = pathname.split('/').slice(-2)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    try {
      await loopManager.resumeLoop(loopId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Loop resumed' }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // POST /api/loops/:loopId/stop - Stop loop
  if (pathname.match(/\/api\/loops\/[^/]+\/stop$/) && req.method === 'POST') {
    const loopId = pathname.split('/').slice(-2)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    try {
      await loopManager.stopLoop(loopId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Loop stopped' }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // POST /api/loops/:loopId/retry - Retry failed step
  if (pathname.match(/\/api\/loops\/[^/]+\/retry$/) && req.method === 'POST') {
    const loopId = pathname.split('/').slice(-2)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    try {
      const state = await loopManager.getStatus(loopId);

      // Can only retry if paused or failed
      if (!['paused', 'failed'].includes(state.status)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Can only retry paused or failed loops'
        }));
        return true;
      }

      // Resume the loop (retry from current step)
      await loopManager.resumeLoop(loopId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Loop retry initiated' }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // ==== SINGLE PARAM ROUTES (most generic, must come last) ====

  // GET /api/loops/:loopId - Get specific loop details
  if (pathname.match(/^\/api\/loops\/[^/]+$/) && req.method === 'GET') {
    const loopId = pathname.split('/').pop();
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    try {
      const state = await loopManager.getStatus(loopId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: state }));
      return true;
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Loop not found' }));
      return true;
    }
  }

  return false;
}

/**
 * Compute statistics from loop list
 */
function computeLoopStats(loops: LoopState[]): {
  total: number;
  by_status: Record<string, number>;
  active_count: number;
  success_rate: number;
  avg_iterations: number;
} {
  const byStatus: Record<string, number> = {};

  for (const loop of loops) {
    byStatus[loop.status] = (byStatus[loop.status] || 0) + 1;
  }

  const completedCount = byStatus['completed'] || 0;
  const failedCount = byStatus['failed'] || 0;
  const totalFinished = completedCount + failedCount;

  const successRate = totalFinished > 0
    ? Math.round((completedCount / totalFinished) * 100)
    : 0;

  const avgIterations = loops.length > 0
    ? Math.round(loops.reduce((sum, l) => sum + l.current_iteration, 0) / loops.length * 10) / 10
    : 0;

  return {
    total: loops.length,
    by_status: byStatus,
    active_count: (byStatus['running'] || 0) + (byStatus['paused'] || 0),
    success_rate: successRate,
    avg_iterations: avgIterations
  };
}

/**
 * Sanitize ID parameter to prevent path traversal attacks
 * @returns true if valid, false if invalid
 */
function isValidId(id: string): boolean {
  if (!id) return false;
  // Block path traversal attempts and null bytes
  if (id.includes('/') || id.includes('\\') || id === '..' || id === '.') return false;
  if (id.includes('\0')) return false;
  return true;
}
