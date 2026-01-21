/**
 * Task Routes Module
 * CCW Loop System - HTTP API endpoints for Task management
 * Reference: .workflow/.scratchpad/loop-system-complete-design-20260121.md section 6.1
 */

import { join } from 'path';
import { readdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { RouteContext } from './types.js';
import type { Task } from '../../types/loop.js';

/**
 * Handle task routes
 * @returns true if route was handled, false otherwise
 */
export async function handleTaskRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, initialPath, handlePostRequest } = ctx;

  // Get workflow directory from initialPath
  const workflowDir = initialPath || process.cwd();
  const taskDir = join(workflowDir, '.task');

  // GET /api/tasks - List all tasks
  if (pathname === '/api/tasks' && req.method === 'GET') {
    try {
      // Ensure task directory exists
      if (!existsSync(taskDir)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: [], total: 0 }));
        return true;
      }

      // Read all task files
      const files = await readdir(taskDir);
      const taskFiles = files.filter(f => f.endsWith('.json'));

      const tasks: Task[] = [];
      for (const file of taskFiles) {
        try {
          const filePath = join(taskDir, file);
          const content = await readFile(filePath, 'utf-8');
          const task = JSON.parse(content) as Task;
          tasks.push(task);
        } catch (error) {
          // Skip invalid task files
          console.error('Failed to read task file ' + file + ':', error);
        }
      }

      // Parse query parameters
      const url = new URL(req.url || '', `http://localhost`);
      const loopOnly = url.searchParams.get('loop_only') === 'true';
      const filterStatus = url.searchParams.get('filter'); // active | completed

      // Apply filters
      let filteredTasks = tasks;

      // Filter by loop_control.enabled
      if (loopOnly) {
        filteredTasks = filteredTasks.filter(t => t.loop_control?.enabled);
      }

      // Filter by status
      if (filterStatus) {
        filteredTasks = filteredTasks.filter(t => t.status === filterStatus);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: filteredTasks,
        total: filteredTasks.length,
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

  // POST /api/tasks - Create new task
  if (pathname === '/api/tasks' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const task = body as Partial<Task>;

      // Validate required fields
      if (!task.id) {
        return { success: false, error: 'Task ID is required', status: 400 };
      }

      // Sanitize taskId to prevent path traversal
      if (task.id.includes('/') || task.id.includes('\\') || task.id === '..' || task.id === '.') {
        return { success: false, error: 'Invalid task ID format', status: 400 };
      }

      if (!task.loop_control) {
        return { success: false, error: 'loop_control is required', status: 400 };
      }

      if (!task.loop_control.enabled) {
        return { success: false, error: 'loop_control.enabled must be true', status: 400 };
      }

      if (!task.loop_control.cli_sequence || task.loop_control.cli_sequence.length === 0) {
        return { success: false, error: 'cli_sequence must contain at least one step', status: 400 };
      }

      try {
        // Ensure task directory exists
        const { mkdir } = await import('fs/promises');
        if (!existsSync(taskDir)) {
          await mkdir(taskDir, { recursive: true });
        }

        // Check if task already exists
        const taskPath = join(taskDir, task.id + '.json');
        if (existsSync(taskPath)) {
          return { success: false, error: 'Task already exists: ' + task.id, status: 409 };
        }

        // Build complete task object
        const fullTask: Task = {
          id: task.id,
          title: task.title || task.id,
          description: task.description || task.loop_control?.description || '',
          status: task.status || 'active',
          meta: task.meta,
          context: task.context,
          loop_control: task.loop_control
        };

        // Write task file
        await writeFile(taskPath, JSON.stringify(fullTask, null, 2), 'utf-8');

        return {
          success: true,
          data: {
            task: fullTask,
            path: taskPath
          }
        };
      } catch (error) {
        return { success: false, error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // POST /api/tasks/validate - Validate task loop_control configuration
  if (pathname === '/api/tasks/validate' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const task = body as Partial<Task>;
      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate loop_control
      if (!task.loop_control) {
        errors.push('loop_control is required');
      } else {
        // Check enabled flag
        if (typeof task.loop_control.enabled !== 'boolean') {
          errors.push('loop_control.enabled must be a boolean');
        }

        // Check cli_sequence
        if (!task.loop_control.cli_sequence || !Array.isArray(task.loop_control.cli_sequence)) {
          errors.push('loop_control.cli_sequence must be an array');
        } else if (task.loop_control.cli_sequence.length === 0) {
          errors.push('loop_control.cli_sequence must contain at least one step');
        } else {
          // Validate each step
          task.loop_control.cli_sequence.forEach((step, index) => {
            if (!step.step_id) {
              errors.push(`Step ${index + 1}: step_id is required`);
            }
            if (!step.tool) {
              errors.push(`Step ${index + 1}: tool is required`);
            } else if (!['gemini', 'qwen', 'codex', 'claude', 'bash'].includes(step.tool)) {
              warnings.push(`Step ${index + 1}: unknown tool '${step.tool}'`);
            }
            if (!step.prompt_template && step.tool !== 'bash') {
              errors.push(`Step ${index + 1}: prompt_template is required for non-bash steps`);
            }
          });
        }

        // Check max_iterations
        if (task.loop_control.max_iterations !== undefined) {
          if (typeof task.loop_control.max_iterations !== 'number' || task.loop_control.max_iterations < 1) {
            errors.push('loop_control.max_iterations must be a positive number');
          }
          if (task.loop_control.max_iterations > 100) {
            warnings.push('max_iterations > 100 may cause long execution times');
          }
        }
      }

      // Return validation result
      const isValid = errors.length === 0;
      return {
        success: true,
        data: {
          valid: isValid,
          errors,
          warnings
        }
      };
    });
    return true;
  }

  // PUT /api/tasks/:taskId - Update existing task
  if (pathname.match(/^\/api\/tasks\/[^/]+$/) && req.method === 'PUT') {
    const taskId = pathname.split('/').pop();
    if (!taskId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Task ID required' }));
      return true;
    }

    // Sanitize taskId to prevent path traversal
    if (taskId.includes('/') || taskId.includes('\\') || taskId === '..' || taskId === '.') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid task ID format' }));
      return true;
    }

    handlePostRequest(req, res, async (body) => {
      const updates = body as Partial<Task>;
      const taskPath = join(taskDir, taskId + '.json');

      // Check if task exists
      if (!existsSync(taskPath)) {
        return { success: false, error: 'Task not found: ' + taskId, status: 404 };
      }

      try {
        // Read existing task
        const existingContent = await readFile(taskPath, 'utf-8');
        const existingTask = JSON.parse(existingContent) as Task;

        // Merge updates (preserve id)
        const updatedTask: Task = {
          ...existingTask,
          ...updates,
          id: existingTask.id // Prevent id change
        };

        // If loop_control is being updated, merge it properly
        if (updates.loop_control) {
          updatedTask.loop_control = {
            ...existingTask.loop_control,
            ...updates.loop_control
          };
        }

        // Write updated task
        await writeFile(taskPath, JSON.stringify(updatedTask, null, 2), 'utf-8');

        return {
          success: true,
          data: {
            task: updatedTask,
            path: taskPath
          }
        };
      } catch (error) {
        return { success: false, error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // GET /api/tasks/:taskId - Get specific task
  if (pathname.match(/^\/api\/tasks\/[^/]+$/) && req.method === 'GET') {
    const taskId = pathname.split('/').pop();
    if (!taskId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Task ID required' }));
      return true;
    }

    // Sanitize taskId to prevent path traversal
    if (taskId.includes('/') || taskId.includes('\\') || taskId === '..' || taskId === '.') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid task ID format' }));
      return true;
    }

    try {
      const taskPath = join(taskDir, taskId + '.json');

      if (!existsSync(taskPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Task not found' }));
        return true;
      }

      const content = await readFile(taskPath, 'utf-8');
      const task = JSON.parse(content) as Task;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: task }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  return false;
}
