/**
 * Loop V2 Routes Module
 * CCW Loop System - Simplified HTTP API endpoints for Dashboard
 * Provides simplified loop CRUD operations independent of task files
 *
 * Loop Endpoints:
 * - GET    /api/loops/v2                   - List all loops with pagination
 * - POST   /api/loops/v2                   - Create loop with {title, description, max_iterations}
 * - GET    /api/loops/v2/:loopId           - Get loop details
 * - PUT    /api/loops/v2/:loopId           - Update loop metadata (title, description, max_iterations, tags, priority, notes)
 * - PATCH  /api/loops/v2/:loopId/status    - Quick status update with {status}
 * - DELETE /api/loops/v2/:loopId           - Delete loop
 * - POST   /api/loops/v2/:loopId/start     - Start loop execution
 * - POST   /api/loops/v2/:loopId/pause     - Pause loop
 * - POST   /api/loops/v2/:loopId/resume    - Resume loop
 * - POST   /api/loops/v2/:loopId/stop      - Stop loop
 *
 * Task Management Endpoints:
 * - POST   /api/loops/v2/:loopId/tasks           - Add task to loop
 * - GET    /api/loops/v2/:loopId/tasks           - List all tasks for loop
 * - PUT    /api/loops/v2/tasks/:taskId           - Update task (requires loop_id in body)
 * - DELETE /api/loops/v2/tasks/:taskId           - Delete task (requires loop_id query param)
 * - PUT    /api/loops/v2/:loopId/tasks/reorder   - Reorder tasks with {ordered_task_ids: string[]}
 *
 * Advanced Task Features:
 * - POST   /api/loops/v2/:loopId/import   - Import tasks from issue with {issue_id}
 * - POST   /api/loops/v2/:loopId/generate - Generate tasks via Gemini with {tool?, count?}
 */

import { join } from 'path';
import { randomBytes } from 'crypto';
import * as os from 'os';
import type { RouteContext } from './types.js';
import { LoopStatus } from '../../types/loop.js';
import type { LoopState } from '../../types/loop.js';
import { TaskStorageManager, type TaskCreateRequest, type TaskUpdateRequest, type TaskReorderRequest } from '../../tools/loop-task-manager.js';
import { executeCliTool } from '../../tools/cli-executor.js';
import { loadClaudeCliTools } from '../../tools/claude-cli-tools.js';

/**
 * Module-level cache for CLI tools configuration
 * Loaded once at server startup to avoid repeated file I/O
 */
let cachedEnabledTools: string[] | null = null;

/**
 * Initialize CLI tools cache at server startup
 * Should be called once when the server starts
 */
export function initializeCliToolsCache(): void {
  try {
    const cliToolsConfig = loadClaudeCliTools(os.homedir());
    const enabledTools = Object.entries(cliToolsConfig.tools || {})
      .filter(([_, config]) => config.enabled === true)
      .map(([name]) => name);
    cachedEnabledTools = ['bash', ...enabledTools];
    console.log('[Loop V2] CLI tools cache initialized:', cachedEnabledTools);
  } catch (err) {
    console.error('[Loop V2] Failed to initialize CLI tools cache:', err);
    // Fallback to basic tools if config loading fails
    cachedEnabledTools = ['bash', 'gemini', 'qwen', 'codex', 'claude'];
  }
}

/**
 * Clear CLI tools cache (for testing or config reload)
 */
export function clearCliToolsCache(): void {
  cachedEnabledTools = null;
}

/**
 * V2 Loop Create Request
 */
interface V2LoopCreateRequest {
  title: string;
  description?: string;
  max_iterations?: number;
}

/**
 * V2 Loop Update Request (extended)
 */
interface V2LoopUpdateRequest {
  // Basic fields
  title?: string;
  description?: string;
  max_iterations?: number;

  // Extended metadata fields
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
}

/**
 * V2 Loop Storage Format (simplified, independent of task files)
 */
interface V2LoopStorage {
  loop_id: string;
  title: string;
  description: string;
  max_iterations: number;
  status: LoopStatus;
  current_iteration: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  failure_reason?: string;

  // Extended metadata fields
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  notes?: string;

  // Tasks stored in separate tasks.jsonl file
}

/**
 * Handle V2 loop routes
 * @returns true if route was handled, false otherwise
 */
export async function handleLoopV2Routes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, initialPath, handlePostRequest, url, broadcastToClients } = ctx;

  // Get workflow directory from initialPath
  const workflowDir = initialPath || process.cwd();
  const loopDir = join(workflowDir, '.workflow', '.loop');

  // Helper to broadcast loop state updates
  const broadcastStateUpdate = (loopId: string, status: LoopStatus): void => {
    try {
      broadcastToClients({
        type: 'LOOP_STATE_UPDATE',
        loop_id: loopId,
        status: status as 'created' | 'running' | 'paused' | 'completed' | 'failed',
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      // Silently ignore broadcast errors
    }
  };

  // Helper to generate loop ID
  const generateLoopId = (): string => {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const random = randomBytes(4).toString('hex');
    return `loop-v2-${timestamp}-${random}`;
  };

  // Helper to read loop storage
  const readLoopStorage = async (loopId: string): Promise<V2LoopStorage | null> => {
    const { readFile } = await import('fs/promises');
    const { existsSync } = await import('fs');
    const filePath = join(loopDir, `${loopId}.json`);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content) as V2LoopStorage;
    } catch {
      return null;
    }
  };

  // Helper to write loop storage
  const writeLoopStorage = async (loop: V2LoopStorage): Promise<void> => {
    const { writeFile, mkdir } = await import('fs/promises');
    const { existsSync } = await import('fs');

    if (!existsSync(loopDir)) {
      await mkdir(loopDir, { recursive: true });
    }

    const filePath = join(loopDir, `${loop.loop_id}.json`);
    await writeFile(filePath, JSON.stringify(loop, null, 2), 'utf-8');
  };

  // Helper to delete loop storage
  const deleteLoopStorage = async (loopId: string): Promise<void> => {
    const { unlink } = await import('fs/promises');
    const { existsSync } = await import('fs');
    const filePath = join(loopDir, `${loopId}.json`);

    if (existsSync(filePath)) {
      await unlink(filePath);
    }

    // Also delete tasks.jsonl if exists
    const tasksPath = join(loopDir, `${loopId}.tasks.jsonl`);
    if (existsSync(tasksPath)) {
      await unlink(tasksPath).catch(() => {});
    }
  };

  // Helper to list all loops
  const listLoops = async (): Promise<V2LoopStorage[]> => {
    const { readdir } = await import('fs/promises');
    const { existsSync } = await import('fs');

    if (!existsSync(loopDir)) {
      return [];
    }

    const files = await readdir(loopDir);
    const loopFiles = files.filter(f => f.startsWith('loop-v2-') && f.endsWith('.json'));

    const loops: V2LoopStorage[] = [];
    for (const file of loopFiles) {
      const loopId = file.replace('.json', '');
      const loop = await readLoopStorage(loopId);
      if (loop) {
        loops.push(loop);
      }
    }

    return loops;
  };

  // ==== EXACT PATH ROUTES ====

  // POST /api/loops/v2 - Create loop with simplified fields
  if (pathname === '/api/loops/v2' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { title, description, max_iterations } = body as V2LoopCreateRequest;

      // Validation
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return { success: false, error: 'title is required and must be non-empty', status: 400 };
      }

      if (description !== undefined && typeof description !== 'string') {
        return { success: false, error: 'description must be a string', status: 400 };
      }

      if (max_iterations !== undefined && (typeof max_iterations !== 'number' || max_iterations < 1)) {
        return { success: false, error: 'max_iterations must be a positive number', status: 400 };
      }

      try {
        const loopId = generateLoopId();
        const now = new Date().toISOString();

        const loop: V2LoopStorage = {
          loop_id: loopId,
          title: title.trim(),
          description: description?.trim() || '',
          max_iterations: max_iterations || 10,
          status: LoopStatus.CREATED,
          current_iteration: 0,
          created_at: now,
          updated_at: now
        };

        await writeLoopStorage(loop);

        // Broadcast creation
        broadcastStateUpdate(loopId, LoopStatus.CREATED);

        return { success: true, data: loop };
      } catch (error) {
        return { success: false, error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // GET /api/loops/v2 - List all loops with pagination
  if (pathname === '/api/loops/v2' && req.method === 'GET') {
    try {
      const loops = await listLoops();

      // Parse query params for pagination and filtering
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

      // Parse pagination params
      const limit = parseInt(searchParams?.get('limit') || '50', 10);
      const offset = parseInt(searchParams?.get('offset') || '0', 10);

      // Apply pagination
      const paginatedLoops = filteredLoops.slice(offset, offset + limit);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: paginatedLoops,
        total: filteredLoops.length,
        limit,
        offset,
        hasMore: offset + limit < filteredLoops.length,
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

  // POST /api/loops/v2/:loopId/start - Start loop execution
  if (pathname.match(/\/api\/loops\/v2\/[^/]+\/start$/) && req.method === 'POST') {
    const loopId = pathname.split('/').slice(-2)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    try {
      const loop = await readLoopStorage(loopId);
      if (!loop) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Loop not found' }));
        return true;
      }

      // Can only start created or paused loops
      if (!['created', 'paused'].includes(loop.status.toLowerCase())) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: `Cannot start loop with status: ${loop.status}`
        }));
        return true;
      }

      // Update loop status
      loop.status = LoopStatus.RUNNING;
      loop.updated_at = new Date().toISOString();
      await writeLoopStorage(loop);

      // Broadcast state update
      broadcastStateUpdate(loopId, LoopStatus.RUNNING);

      // Trigger ccw-loop skill execution (non-blocking)
      // The skill will check status before each action and exit gracefully on pause/stop
      executeCliTool({
        tool: 'claude',
        prompt: `/ccw-loop --loop-id ${loopId} --auto`,
        mode: 'write',
        workingDir: workflowDir
      }).catch((error) => {
        // Log error but don't fail the start request
        console.error(`Failed to trigger ccw-loop skill for ${loopId}:`, error);
        // Update loop status to failed
        readLoopStorage(loopId).then(async (failedLoop) => {
          if (failedLoop) {
            failedLoop.status = LoopStatus.FAILED;
            failedLoop.failure_reason = `Skill execution failed: ${error.message}`;
            failedLoop.completed_at = new Date().toISOString();
            await writeLoopStorage(failedLoop);
            broadcastStateUpdate(loopId, LoopStatus.FAILED);
          }
        });
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: loop, message: 'Loop started' }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // POST /api/loops/v2/:loopId/pause - Pause loop
  if (pathname.match(/\/api\/loops\/v2\/[^/]+\/pause$/) && req.method === 'POST') {
    const loopId = pathname.split('/').slice(-2)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    try {
      const loop = await readLoopStorage(loopId);
      if (!loop) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Loop not found' }));
        return true;
      }

      // Can only pause running loops
      if (loop.status !== LoopStatus.RUNNING) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: `Cannot pause loop with status: ${loop.status}`
        }));
        return true;
      }

      loop.status = LoopStatus.PAUSED;
      loop.updated_at = new Date().toISOString();
      await writeLoopStorage(loop);

      broadcastStateUpdate(loopId, LoopStatus.PAUSED);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: loop, message: 'Loop paused' }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // POST /api/loops/v2/:loopId/resume - Resume loop
  if (pathname.match(/\/api\/loops\/v2\/[^/]+\/resume$/) && req.method === 'POST') {
    const loopId = pathname.split('/').slice(-2)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    try {
      const loop = await readLoopStorage(loopId);
      if (!loop) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Loop not found' }));
        return true;
      }

      // Can only resume paused loops
      if (loop.status !== LoopStatus.PAUSED) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: `Cannot resume loop with status: ${loop.status}`
        }));
        return true;
      }

      loop.status = LoopStatus.RUNNING;
      loop.updated_at = new Date().toISOString();
      await writeLoopStorage(loop);

      broadcastStateUpdate(loopId, LoopStatus.RUNNING);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: loop, message: 'Loop resumed' }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // POST /api/loops/v2/:loopId/stop - Stop loop
  if (pathname.match(/\/api\/loops\/v2\/[^/]+\/stop$/) && req.method === 'POST') {
    const loopId = pathname.split('/').slice(-2)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    try {
      const loop = await readLoopStorage(loopId);
      if (!loop) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Loop not found' }));
        return true;
      }

      // Can only stop running or paused loops
      if (![LoopStatus.RUNNING, LoopStatus.PAUSED, LoopStatus.CREATED].includes(loop.status)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: `Cannot stop loop with status: ${loop.status}`
        }));
        return true;
      }

      loop.status = LoopStatus.FAILED;
      loop.failure_reason = 'Manually stopped by user';
      loop.completed_at = new Date().toISOString();
      loop.updated_at = loop.completed_at;
      await writeLoopStorage(loop);

      broadcastStateUpdate(loopId, LoopStatus.FAILED);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: loop, message: 'Loop stopped' }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // ==== SINGLE PARAM ROUTES (must come after nested routes) ====

  // GET /api/loops/v2/:loopId - Get loop details
  if (pathname.match(/^\/api\/loops\/v2\/[^/]+$/) && req.method === 'GET') {
    const loopId = pathname.split('/').pop();
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    try {
      const loop = await readLoopStorage(loopId);
      if (!loop) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Loop not found' }));
        return true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: loop }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // PUT /api/loops/v2/:loopId - Update loop metadata
  if (pathname.match(/^\/api\/loops\/v2\/[^/]+$/) && req.method === 'PUT') {
    const loopId = pathname.split('/').pop();
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    handlePostRequest(req, res, async (body) => {
      const { title, description, max_iterations, tags, priority, notes } = body as V2LoopUpdateRequest;

      try {
        const loop = await readLoopStorage(loopId);
        if (!loop) {
          return { success: false, error: 'Loop not found', status: 404 };
        }

        // Can only update created or paused loops
        if (![LoopStatus.CREATED, LoopStatus.PAUSED, LoopStatus.FAILED, LoopStatus.COMPLETED].includes(loop.status)) {
          return { success: false, error: `Cannot update loop with status: ${loop.status}`, status: 400 };
        }

        // Validate and apply updates
        if (title !== undefined) {
          if (typeof title !== 'string' || title.trim().length === 0) {
            return { success: false, error: 'title must be a non-empty string', status: 400 };
          }
          loop.title = title.trim();
        }

        if (description !== undefined) {
          if (typeof description !== 'string') {
            return { success: false, error: 'description must be a string', status: 400 };
          }
          loop.description = description.trim();
        }

        if (max_iterations !== undefined) {
          if (typeof max_iterations !== 'number' || max_iterations < 1) {
            return { success: false, error: 'max_iterations must be a positive number', status: 400 };
          }
          loop.max_iterations = max_iterations;
        }

        // Extended metadata fields
        if (tags !== undefined) {
          if (!Array.isArray(tags) || !tags.every(t => typeof t === 'string')) {
            return { success: false, error: 'tags must be an array of strings', status: 400 };
          }
          loop.tags = tags;
        }

        if (priority !== undefined) {
          if (!['low', 'medium', 'high'].includes(priority)) {
            return { success: false, error: 'priority must be one of: low, medium, high', status: 400 };
          }
          loop.priority = priority;
        }

        if (notes !== undefined) {
          if (typeof notes !== 'string') {
            return { success: false, error: 'notes must be a string', status: 400 };
          }
          loop.notes = notes.trim();
        }

        loop.updated_at = new Date().toISOString();
        await writeLoopStorage(loop);

        broadcastStateUpdate(loopId, loop.status);

        return { success: true, data: loop };
      } catch (error) {
        return { success: false, error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // PATCH /api/loops/v2/:loopId/status - Quick status update
  if (pathname.match(/\/api\/loops\/v2\/[^/]+\/status$/) && req.method === 'PATCH') {
    const loopId = pathname.split('/').slice(-2)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    handlePostRequest(req, res, async (body) => {
      const { status } = body as { status?: string };

      if (!status || typeof status !== 'string') {
        return { success: false, error: 'status is required', status: 400 };
      }

      if (!Object.values(LoopStatus).includes(status as LoopStatus)) {
        return { success: false, error: `Invalid status: ${status}`, status: 400 };
      }

      try {
        const loop = await readLoopStorage(loopId);
        if (!loop) {
          return { success: false, error: 'Loop not found', status: 404 };
        }

        loop.status = status as LoopStatus;
        loop.updated_at = new Date().toISOString();

        if (status === LoopStatus.COMPLETED && !loop.completed_at) {
          loop.completed_at = new Date().toISOString();
        }

        await writeLoopStorage(loop);

        broadcastStateUpdate(loopId, loop.status);

        return { success: true, data: loop };
      } catch (error) {
        return { success: false, error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // DELETE /api/loops/v2/:loopId - Delete loop
  if (pathname.match(/^\/api\/loops\/v2\/[^/]+$/) && req.method === 'DELETE') {
    const loopId = pathname.split('/').pop();
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    try {
      const loop = await readLoopStorage(loopId);
      if (!loop) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Loop not found' }));
        return true;
      }

      // Cannot delete running loops
      if (loop.status === LoopStatus.RUNNING) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Cannot delete running loop. Stop it first.'
        }));
        return true;
      }

      await deleteLoopStorage(loopId);

      // Broadcast deletion
      try {
        broadcastToClients({
          type: 'LOOP_DELETED',
          loop_id: loopId
        });
      } catch {
        // Ignore broadcast errors
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Loop deleted' }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // ==== TASK MANAGEMENT ENDPOINTS ====

  // Helper to create TaskStorageManager instance
  const createTaskManager = (): TaskStorageManager => {
    return new TaskStorageManager(workflowDir);
  };

  // POST /api/loops/v2/:loopId/tasks - Add task to loop
  if (pathname.match(/\/api\/loops\/v2\/[^/]+\/tasks$/) && req.method === 'POST') {
    const loopId = pathname.split('/').slice(-2)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    handlePostRequest(req, res, async (body) => {
      const { description, tool, mode, prompt_template, command, on_error } = body as TaskCreateRequest;

      // Validation
      if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return { success: false, error: 'description is required', status: 400 };
      }

      if (!tool || typeof tool !== 'string') {
        return { success: false, error: 'tool is required', status: 400 };
      }

      // Get enabled tools from cli-tools.json dynamically
      const cliToolsConfig = loadClaudeCliTools(os.homedir());
      const enabledTools = Object.entries(cliToolsConfig.tools || {})
        .filter(([_, config]) => config.enabled === true)
        .map(([name]) => name);

      // Also allow 'bash' as a special case (built-in tool)
      const validTools = ['bash', ...enabledTools];

      if (!validTools.includes(tool)) {
        return { success: false, error: `tool must be one of enabled tools: ${validTools.join(', ')}`, status: 400 };
      }

      if (!mode || typeof mode !== 'string') {
        return { success: false, error: 'mode is required', status: 400 };
      }

      const validModes = ['analysis', 'write', 'review'];
      if (!validModes.includes(mode)) {
        return { success: false, error: `mode must be one of: ${validModes.join(', ')}`, status: 400 };
      }

      if (!prompt_template || typeof prompt_template !== 'string' || prompt_template.trim().length === 0) {
        return { success: false, error: 'prompt_template is required', status: 400 };
      }

      try {
        const taskManager = createTaskManager();
        const task = await taskManager.addTask(loopId, {
          description: description.trim(),
          tool,
          mode,
          prompt_template: prompt_template.trim(),
          command,
          on_error
        });

        // Broadcast task added
        try {
          broadcastToClients({
            type: 'TASK_ADDED',
            loop_id: loopId,
            task_id: task.task_id,
            task: task
          });
        } catch {
          // Ignore broadcast errors
        }

        return { success: true, data: task };
      } catch (error) {
        return { success: false, error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // GET /api/loops/v2/:loopId/tasks - List all tasks for loop
  if (pathname.match(/\/api\/loops\/v2\/[^/]+\/tasks$/) && req.method === 'GET') {
    const loopId = pathname.split('/').slice(-2)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    try {
      const taskManager = createTaskManager();
      const tasks = await taskManager.getTasks(loopId);

      // Sort by order
      tasks.sort((a, b) => a.order - b.order);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: tasks,
        total: tasks.length,
        loop_id: loopId,
        timestamp: new Date().toISOString()
      }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // GET /api/loops/v2/tasks/:taskId - Get single task (taskId lookup)
  if (pathname.match(/^\/api\/loops\/v2\/tasks\/[^/]+$/) && req.method === 'GET') {
    const taskId = pathname.split('/').pop();
    if (!taskId || !isValidId(taskId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid task ID format' }));
      return true;
    }

    try {
      const taskManager = createTaskManager();
      // Get all loops and search for the task
      const loops = await listLoops();
      let foundTask = null;
      let foundLoopId = null;

      for (const loop of loops) {
        const loopId = loop.loop_id;
        try {
          const tasks = await taskManager.getTasks(loopId);
          const task = tasks.find(t => t.task_id === taskId);
          if (task) {
            foundTask = task;
            foundLoopId = loopId;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!foundTask) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Task not found' }));
        return true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: { ...foundTask, loop_id: foundLoopId },
        timestamp: new Date().toISOString()
      }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // PUT /api/loops/v2/tasks/:taskId - Update task (taskId lookup)
  if (pathname.match(/^\/api\/loops\/v2\/tasks\/[^/]+$/) && req.method === 'PUT') {
    const taskId = pathname.split('/').pop();
    if (!taskId || !isValidId(taskId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid task ID format' }));
      return true;
    }

    handlePostRequest(req, res, async (body) => {
      const { loop_id, description, tool, mode, prompt_template, command, on_error } = body as TaskUpdateRequest & { loop_id?: string };

      if (!loop_id || typeof loop_id !== 'string') {
        return { success: false, error: 'loop_id is required', status: 400 };
      }

      if (!isValidId(loop_id)) {
        return { success: false, error: 'Invalid loop_id format', status: 400 };
      }

      try {
        const taskManager = createTaskManager();
        const updatedTask = await taskManager.updateTask(loop_id, taskId, {
          description,
          tool,
          mode,
          prompt_template,
          command,
          on_error
        });

        if (!updatedTask) {
          return { success: false, error: 'Task not found', status: 404 };
        }

        // Broadcast task updated
        try {
          broadcastToClients({
            type: 'TASK_UPDATED',
            loop_id: loop_id,
            task_id: taskId,
            task: updatedTask
          });
        } catch {
          // Ignore broadcast errors
        }

        return { success: true, data: updatedTask };
      } catch (error) {
        return { success: false, error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // DELETE /api/loops/v2/tasks/:taskId - Delete task (taskId lookup)
  if (pathname.match(/^\/api\/loops\/v2\/tasks\/[^/]+$/) && req.method === 'DELETE') {
    const taskId = pathname.split('/').pop();
    if (!taskId || !isValidId(taskId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid task ID format' }));
      return true;
    }

    // Get loop_id from query parameter
    const urlObj = new URL(req.url || '', `http://localhost`);
    const loopId = urlObj.searchParams.get('loop_id');

    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'loop_id query parameter is required' }));
      return true;
    }

    try {
      const taskManager = createTaskManager();
      const deleted = await taskManager.deleteTask(loopId, taskId);

      if (!deleted) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Task not found' }));
        return true;
      }

      // Broadcast task deleted
      try {
        broadcastToClients({
          type: 'TASK_DELETED',
          loop_id: loopId,
          task_id: taskId
        });
      } catch {
        // Ignore broadcast errors
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Task deleted' }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // PUT /api/loops/v2/:loopId/tasks/reorder - Reorder tasks
  if (pathname.match(/\/api\/loops\/v2\/[^/]+\/tasks\/reorder$/) && req.method === 'PUT') {
    const loopId = pathname.split('/').slice(-3)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    handlePostRequest(req, res, async (body) => {
      const { ordered_task_ids } = body as TaskReorderRequest;

      if (!ordered_task_ids || !Array.isArray(ordered_task_ids)) {
        return { success: false, error: 'ordered_task_ids must be an array', status: 400 };
      }

      if (ordered_task_ids.length === 0) {
        return { success: false, error: 'ordered_task_ids cannot be empty', status: 400 };
      }

      try {
        const taskManager = createTaskManager();
        const reorderedTasks = await taskManager.reorderTasks(loopId, { ordered_task_ids });

        // Broadcast tasks reordered
        try {
          broadcastToClients({
            type: 'TASK_REORDERED',
            loop_id: loopId,
            ordered_task_ids: ordered_task_ids,
            tasks: reorderedTasks
          });
        } catch {
          // Ignore broadcast errors
        }

        return { success: true, data: reorderedTasks };
      } catch (error) {
        return { success: false, error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // ==== ADVANCED TASK FEATURES ====

  // POST /api/loops/v2/:loopId/import - Import tasks from issue
  if (pathname.match(/\/api\/loops\/v2\/[^/]+\/import$/) && req.method === 'POST') {
    const loopId = pathname.split('/').slice(-2)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    handlePostRequest(req, res, async (body) => {
      const { issue_id } = body as { issue_id?: string };

      if (!issue_id || typeof issue_id !== 'string') {
        return { success: false, error: 'issue_id is required', status: 400 };
      }

      try {
        // Fetch issue data from issue-manager
        const { readFile } = await import('fs/promises');
        const { existsSync } = await import('fs');
        const issuesDir = join(workflowDir, '.workflow', 'issues');
        const issuesPath = join(issuesDir, 'issues.jsonl');

        let issueData: any = null;

        // Try reading from active issues
        if (existsSync(issuesPath)) {
          const content = await readFile(issuesPath, 'utf-8');
          const issues = content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
          issueData = issues.find((i: any) => i.id === issue_id);
        }

        // Try reading from history if not found
        if (!issueData) {
          const historyPath = join(issuesDir, 'issue-history.jsonl');
          if (existsSync(historyPath)) {
            const content = await readFile(historyPath, 'utf-8');
            const historyIssues = content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
            issueData = historyIssues.find((i: any) => i.id === issue_id);
          }
        }

        if (!issueData) {
          return { success: false, error: `Issue ${issue_id} not found`, status: 404 };
        }

        // Load solutions to get bound solution tasks
        const solutionsPath = join(issuesDir, 'solutions', `${issue_id}.jsonl`);
        let tasksToImport: any[] = [];

        if (existsSync(solutionsPath)) {
          const solutionsContent = await readFile(solutionsPath, 'utf-8');
          const solutions = solutionsContent.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));

          // Get tasks from bound solution
          const boundSolution = solutions.find((s: any) => s.id === issueData.bound_solution_id) ||
                               solutions.find((s: any) => s.is_bound) ||
                               solutions[0];

          if (boundSolution?.tasks) {
            tasksToImport = boundSolution.tasks;
          }
        }

        if (tasksToImport.length === 0) {
          return { success: false, error: 'No tasks found in issue. Bind a solution with tasks first.', status: 400 };
        }

        // Broadcast import start
        broadcastToClients({
          type: 'LOOP_TASK_IMPORT_PROGRESS',
          loop_id: loopId,
          payload: {
            stage: 'starting',
            total: tasksToImport.length,
            imported: 0
          }
        });

        const taskManager = createTaskManager();
        const createdTasks: any[] = [];

        // Convert issue tasks to loop tasks
        for (let i = 0; i < tasksToImport.length; i++) {
          const issueTask = tasksToImport[i];

          // Map issue task fields to loop task fields
          const taskRequest: TaskCreateRequest = {
            description: issueTask.description || issueTask.title || `Task ${i + 1}`,
            tool: mapIssueToolToLoopTool(issueTask.tool) || 'gemini',
            mode: mapIssueModeToLoopMode(issueTask.mode) || 'write',
            prompt_template: issueTask.prompt_template || issueTask.prompt || `Execute: ${issueTask.description || issueTask.title}`,
            command: issueTask.command,
            on_error: mapIssueOnError(issueTask.on_error)
          };

          const task = await taskManager.addTask(loopId, taskRequest);
          createdTasks.push(task);

          // Broadcast progress
          broadcastToClients({
            type: 'LOOP_TASK_IMPORT_PROGRESS',
            loop_id: loopId,
            payload: {
              stage: 'importing',
              total: tasksToImport.length,
              imported: i + 1,
              current_task: task
            }
          });
        }

        // Broadcast completion
        broadcastToClients({
          type: 'LOOP_TASK_IMPORT_COMPLETE',
          loop_id: loopId,
          payload: {
            total: tasksToImport.length,
            imported: createdTasks.length,
            tasks: createdTasks
          }
        });

        return {
          success: true,
          data: createdTasks,
          message: `Imported ${createdTasks.length} tasks from issue ${issue_id}`
        };
      } catch (error) {
        return { success: false, error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // POST /api/loops/v2/:loopId/generate - Generate tasks via Gemini
  if (pathname.match(/\/api\/loops\/v2\/[^/]+\/generate$/) && req.method === 'POST') {
    const loopId = pathname.split('/').slice(-2)[0];
    if (!loopId || !isValidId(loopId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid loop ID format' }));
      return true;
    }

    handlePostRequest(req, res, async (body) => {
      const { tool = 'gemini', count } = body as { tool?: string; count?: number };

      try {
        // Get loop details for context
        const loop = await readLoopStorage(loopId);
        if (!loop) {
          return { success: false, error: 'Loop not found', status: 404 };
        }

        // Broadcast generation start
        broadcastToClients({
          type: 'LOOP_TASK_GENERATION_PROGRESS',
          loop_id: loopId,
          payload: {
            stage: 'analyzing',
            message: 'Analyzing loop description...'
          }
        });

        // Build generation prompt
        const generatePrompt = `PURPOSE: Generate ${count || 5} specific tasks for loop execution
TASK: Analyze the loop description and generate a list of actionable tasks that can be executed via CLI tools. Each task should have clear description, tool selection, mode, and prompt template.
MODE: analysis
CONTEXT: Loop title: ${loop.title}
Loop description: ${loop.description || 'No description provided'}
Max iterations: ${loop.max_iterations}
EXPECTED: Return a JSON array of tasks with this exact structure:
[
  {
    "description": "Clear task description",
    "tool": "gemini|codex|qwen|bash",
    "mode": "analysis|write|review",
    "prompt_template": "PURPOSE: ... TASK: ... MODE: analysis CONTEXT: @**/* EXPECTED: ...",
    "on_error": "continue|pause|fail_fast"
  }
]
CONSTRAINTS: Generate ${count || 5} tasks | Use gemini for AI tasks | Use bash for CLI commands | Include error handling strategy`;

        // Call CLI with gemini to generate tasks
        let generatedTasks: any[] = [];
        let outputBuffer = '';

        const result = await executeCliTool({
          tool: tool === 'codex' || tool === 'qwen' || tool === 'gemini' ? tool : 'gemini',
          prompt: generatePrompt,
          mode: 'analysis',
          format: 'plain',
          cd: workflowDir,
          timeout: 120000, // 2 minutes timeout
          stream: true
        }, (unit) => {
          // Collect output
          outputBuffer += unit.content;

          // Broadcast partial output for progress
          broadcastToClients({
            type: 'LOOP_TASK_GENERATION_PROGRESS',
            loop_id: loopId,
            payload: {
              stage: 'generating',
              message: 'Generating tasks...',
              output: unit.content
            }
          });
        });

        if (!result.success) {
          return { success: false, error: 'Failed to generate tasks via CLI', status: 500 };
        }

        // Parse generated tasks from CLI output
        generatedTasks = parseGeneratedTasks(outputBuffer);

        if (generatedTasks.length === 0) {
          return {
            success: false,
            error: 'No valid tasks generated. Check CLI output for details.',
            status: 500,
            output: outputBuffer
          };
        }

        // Broadcast import start
        broadcastToClients({
          type: 'LOOP_TASK_GENERATION_PROGRESS',
          loop_id: loopId,
          payload: {
            stage: 'importing',
            message: `Importing ${generatedTasks.length} generated tasks...`,
            total: generatedTasks.length,
            imported: 0
          }
        });

        const taskManager = createTaskManager();
        const createdTasks: any[] = [];

        // Add generated tasks to loop
        for (let i = 0; i < generatedTasks.length; i++) {
          const genTask = generatedTasks[i];

          const taskRequest: TaskCreateRequest = {
            description: genTask.description || `Generated Task ${i + 1}`,
            tool: validateTool(genTask.tool) ? genTask.tool : 'gemini',
            mode: validateMode(genTask.mode) ? genTask.mode : 'write',
            prompt_template: genTask.prompt_template || `Execute task: ${genTask.description}`,
            command: genTask.command,
            on_error: validateOnError(genTask.on_error) ? genTask.on_error : 'continue'
          };

          const task = await taskManager.addTask(loopId, taskRequest);
          createdTasks.push(task);

          // Broadcast progress
          broadcastToClients({
            type: 'LOOP_TASK_GENERATION_PROGRESS',
            loop_id: loopId,
            payload: {
              stage: 'importing',
              message: `Importing task ${i + 1}/${generatedTasks.length}...`,
              total: generatedTasks.length,
              imported: i + 1,
              current_task: task
            }
          });
        }

        // Broadcast completion
        broadcastToClients({
          type: 'LOOP_TASK_GENERATION_COMPLETE',
          loop_id: loopId,
          payload: {
            total: generatedTasks.length,
            imported: createdTasks.length,
            tasks: createdTasks
          }
        });

        return {
          success: true,
          data: createdTasks,
          message: `Generated and imported ${createdTasks.length} tasks`
        };
      } catch (error) {
        return { success: false, error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  return false;
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

/**
 * Get enabled tools list from cache
 * If cache is not initialized, it will load from config (fallback for lazy initialization)
 */
function getEnabledToolsList(): string[] {
  // Return cached value if available
  if (cachedEnabledTools) {
    return cachedEnabledTools;
  }

  // Fallback: lazy initialization if cache not initialized (shouldn't happen in normal operation)
  console.warn('[Loop V2] CLI tools cache not initialized, performing lazy load');
  initializeCliToolsCache();
  return cachedEnabledTools || ['bash', 'gemini', 'qwen', 'codex', 'claude'];
}

/**
 * Map issue tool to loop tool
 */
function mapIssueToolToLoopTool(tool: any): string | null {
  const validTools = getEnabledToolsList();
  if (validTools.includes(tool)) return tool;
  // Map aliases
  if (tool === 'ccw') return 'gemini';
  if (tool === 'ai') return 'gemini';
  return null;
}

/**
 * Map issue mode to loop mode
 */
function mapIssueModeToLoopMode(mode: any): 'analysis' | 'write' | 'review' | null {
  const validModes = ['analysis', 'write', 'review'];
  if (validModes.includes(mode)) return mode as any;
  // Map aliases
  if (mode === 'read') return 'analysis';
  if (mode === 'create' || mode === 'modify') return 'write';
  return null;
}

/**
 * Map issue on_error value
 */
function mapIssueOnError(onError: any): 'continue' | 'pause' | 'fail_fast' | undefined {
  const validValues = ['continue', 'pause', 'fail_fast'];
  if (validValues.includes(onError)) return onError as any;
  // Map aliases
  if (onError === 'stop') return 'pause';
  if (onError === 'abort') return 'fail_fast';
  return undefined;
}

/**
 * Validate tool value
 */
function validateTool(tool: any): boolean {
  const validTools = getEnabledToolsList();
  return validTools.includes(tool);
}

/**
 * Validate mode value
 */
function validateMode(mode: any): boolean {
  const validModes = ['analysis', 'write', 'review'];
  return validModes.includes(mode);
}

/**
 * Validate on_error value
 */
function validateOnError(onError: any): boolean {
  const validValues = ['continue', 'pause', 'fail_fast'];
  return validValues.includes(onError);
}

/**
 * Parse generated tasks from CLI output
 * Extracts JSON array from output, handles various response formats
 */
function parseGeneratedTasks(output: string): any[] {
  let tasks: any[] = [];

  // Try to find JSON array in output
  const jsonMatch = output.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      tasks = JSON.parse(jsonMatch[0]);
    } catch {
      // Invalid JSON, try alternative parsing
    }
  }

  // If no valid JSON array found, try parsing line by line
  if (tasks.length === 0) {
    const lines = output.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          tasks.push(JSON.parse(trimmed));
        } catch {
          // Skip invalid lines
        }
      }
    }
  }

  // Filter and validate task objects
  return tasks.filter(t =>
    t &&
    typeof t === 'object' &&
    (t.description || t.title || t.task) &&
    (t.tool || t.mode || t.prompt_template)
  ).map(t => ({
    description: t.description || t.title || t.task || 'Untitled task',
    tool: t.tool || 'gemini',
    mode: t.mode || 'write',
    prompt_template: t.prompt_template || t.prompt || `Execute: ${t.description || t.title || t.task}`,
    command: t.command,
    on_error: t.on_error || 'continue'
  }));
}
