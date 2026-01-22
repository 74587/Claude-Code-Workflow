/**
 * Loop Task Manager
 * CCW Loop System - JSONL task persistence layer for v2 loops
 * Reference: .workflow/.scratchpad/loop-system-complete-design-20260121.md section 4.2
 *
 * Storage format: .workflow/.loop/{loopId}/tasks.jsonl
 * JSONL format: one JSON object per line for efficient append-only operations
 */

import { readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { randomBytes } from 'crypto';

/**
 * Loop Task - simplified task definition for v2 loops
 */
export interface LoopTask {
  /** Unique task identifier */
  task_id: string;

  /** Task description (what to do) */
  description: string;

  /**
   * CLI tool to use
   *
   * Should be one of the enabled tools from cli-tools.json:
   * - 'bash' (always available)
   * - Builtin tools: 'gemini', 'qwen', 'codex', 'claude', 'opencode'
   * - CLI wrappers: 'doubao', etc. (if enabled)
   * - API endpoints: custom tools (if enabled)
   *
   * Note: Validation is performed at the API layer (loop-v2-routes.ts)
   * to ensure tool is enabled before saving.
   */
  tool: string;

  /** Execution mode */
  mode: 'analysis' | 'write' | 'review';

  /** Prompt template with variable replacement */
  prompt_template: string;

  /** Display order (for drag-drop reordering) */
  order: number;

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** Optional: custom bash command */
  command?: string;

  /** Optional: step failure behavior */
  on_error?: 'continue' | 'pause' | 'fail_fast';
}

/**
 * Task create request
 */
export interface TaskCreateRequest {
  description: string;
  tool: LoopTask['tool'];
  mode: LoopTask['mode'];
  prompt_template: string;
  command?: string;
  on_error?: LoopTask['on_error'];
}

/**
 * Task update request
 */
export interface TaskUpdateRequest {
  description?: string;
  tool?: LoopTask['tool'];
  mode?: LoopTask['mode'];
  prompt_template?: string;
  command?: string;
  on_error?: LoopTask['on_error'];
}

/**
 * Task reorder request
 */
export interface TaskReorderRequest {
  ordered_task_ids: string[];
}

/**
 * Task Storage Manager
 * Handles JSONL persistence for loop tasks
 */
export class TaskStorageManager {
  private baseDir: string;

  constructor(workflowDir: string) {
    // Task files stored in .workflow/.loop/{loopId}/
    this.baseDir = join(workflowDir, '.workflow', '.loop');
  }

  /**
   * Add a new task to the loop
   */
  async addTask(loopId: string, request: TaskCreateRequest): Promise<LoopTask> {
    await this.ensureLoopDir(loopId);

    // Read existing tasks to determine next order
    const existingTasks = await this.readTasks(loopId);
    const nextOrder = existingTasks.length > 0
      ? Math.max(...existingTasks.map(t => t.order)) + 1
      : 0;

    const task: LoopTask = {
      task_id: this.generateTaskId(),
      description: request.description,
      tool: request.tool,
      mode: request.mode,
      prompt_template: request.prompt_template,
      order: nextOrder,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      command: request.command,
      on_error: request.on_error
    };

    await this.appendTask(loopId, task);
    return task;
  }

  /**
   * Get all tasks for a loop
   */
  async getTasks(loopId: string): Promise<LoopTask[]> {
    return this.readTasks(loopId);
  }

  /**
   * Get single task by ID
   */
  async getTask(loopId: string, taskId: string): Promise<LoopTask | null> {
    const tasks = await this.readTasks(loopId);
    return tasks.find(t => t.task_id === taskId) || null;
  }

  /**
   * Update existing task
   */
  async updateTask(loopId: string, taskId: string, updates: TaskUpdateRequest): Promise<LoopTask | null> {
    const tasks = await this.readTasks(loopId);
    const taskIndex = tasks.findIndex(t => t.task_id === taskId);

    if (taskIndex === -1) {
      return null;
    }

    const task = tasks[taskIndex];
    const updatedTask: LoopTask = {
      ...task,
      description: updates.description ?? task.description,
      tool: updates.tool ?? task.tool,
      mode: updates.mode ?? task.mode,
      prompt_template: updates.prompt_template ?? task.prompt_template,
      command: updates.command ?? task.command,
      on_error: updates.on_error ?? task.on_error,
      updated_at: new Date().toISOString()
    };

    tasks[taskIndex] = updatedTask;
    await this.writeTasks(loopId, tasks);
    return updatedTask;
  }

  /**
   * Delete task and reorder remaining tasks
   */
  async deleteTask(loopId: string, taskId: string): Promise<boolean> {
    const tasks = await this.readTasks(loopId);
    const filteredTasks = tasks.filter(t => t.task_id !== taskId);

    if (filteredTasks.length === tasks.length) {
      return false; // Task not found
    }

    // Reorder remaining tasks
    const reorderedTasks = this.reorderTasksByOrder(filteredTasks);

    await this.writeTasks(loopId, reorderedTasks);
    return true;
  }

  /**
   * Reorder tasks based on provided task ID sequence
   */
  async reorderTasks(loopId: string, request: TaskReorderRequest): Promise<LoopTask[]> {
    const tasks = await this.readTasks(loopId);
    const taskMap = new Map(tasks.map(t => [t.task_id, t]));

    // Verify all provided task IDs exist
    for (const taskId of request.ordered_task_ids) {
      if (!taskMap.has(taskId)) {
        throw new Error(`Task not found: ${taskId}`);
      }
    }

    // Reorder tasks and update order indices
    const reorderedTasks: LoopTask[] = [];
    for (let i = 0; i < request.ordered_task_ids.length; i++) {
      const task = taskMap.get(request.ordered_task_ids[i])!;
      reorderedTasks.push({
        ...task,
        order: i,
        updated_at: new Date().toISOString()
      });
    }

    // Add any tasks not in the reorder list (shouldn't happen normally)
    for (const task of tasks) {
      if (!request.ordered_task_ids.includes(task.task_id)) {
        reorderedTasks.push({
          ...task,
          order: reorderedTasks.length,
          updated_at: new Date().toISOString()
        });
      }
    }

    await this.writeTasks(loopId, reorderedTasks);
    return reorderedTasks;
  }

  /**
   * Delete all tasks for a loop
   */
  async deleteAllTasks(loopId: string): Promise<void> {
    const tasksPath = this.getTasksPath(loopId);

    if (existsSync(tasksPath)) {
      const { unlink } = await import('fs/promises');
      await unlink(tasksPath).catch(() => {});
    }

    // Also delete backup
    const backupPath = `${tasksPath}.backup`;
    if (existsSync(backupPath)) {
      const { unlink } = await import('fs/promises');
      await unlink(backupPath).catch(() => {});
    }
  }

  /**
   * Read tasks with recovery from backup
   */
  async readTasksWithRecovery(loopId: string): Promise<LoopTask[]> {
    try {
      return await this.readTasks(loopId);
    } catch (error) {
      console.warn(`Tasks file corrupted, attempting recovery for ${loopId}...`);

      const backupPath = `${this.getTasksPath(loopId)}.backup`;
      if (existsSync(backupPath)) {
        const content = await readFile(backupPath, 'utf-8');
        const tasks = this.parseTasksJsonl(content);
        // Restore from backup
        await this.writeTasks(loopId, tasks);
        return tasks;
      }

      throw error;
    }
  }

  /**
   * Get tasks file path
   */
  getTasksPath(loopId: string): string {
    return join(this.baseDir, this.sanitizeLoopId(loopId), 'tasks.jsonl');
  }

  /**
   * Read tasks from JSONL file
   */
  private async readTasks(loopId: string): Promise<LoopTask[]> {
    const filePath = this.getTasksPath(loopId);

    if (!existsSync(filePath)) {
      return [];
    }

    const content = await readFile(filePath, 'utf-8');
    return this.parseTasksJsonl(content);
  }

  /**
   * Parse JSONL content into tasks array
   */
  private parseTasksJsonl(content: string): LoopTask[] {
    const tasks: LoopTask[] = [];
    const lines = content.split('\n').filter(line => line.trim().length > 0);

    for (const line of lines) {
      try {
        const task = JSON.parse(line) as LoopTask;
        tasks.push(task);
      } catch (error) {
        console.error('Failed to parse task line:', error);
      }
    }

    return tasks;
  }

  /**
   * Write tasks array to JSONL file
   */
  private async writeTasks(loopId: string, tasks: LoopTask[]): Promise<void> {
    await this.ensureLoopDir(loopId);

    const filePath = this.getTasksPath(loopId);

    // Create backup if file exists
    if (existsSync(filePath)) {
      const backupPath = `${filePath}.backup`;
      await copyFile(filePath, backupPath).catch(() => {});
    }

    // Write each task as a JSON line
    const jsonlContent = tasks.map(t => JSON.stringify(t)).join('\n');
    await writeFile(filePath, jsonlContent, 'utf-8');
  }

  /**
   * Append single task to JSONL file
   */
  private async appendTask(loopId: string, task: LoopTask): Promise<void> {
    await this.ensureLoopDir(loopId);

    const filePath = this.getTasksPath(loopId);

    // Create backup if file exists
    if (existsSync(filePath)) {
      const backupPath = `${filePath}.backup`;
      await copyFile(filePath, backupPath).catch(() => {});
    }

    // Append task as new line
    const line = JSON.stringify(task) + '\n';
    await writeFile(filePath, line, { flag: 'a' });
  }

  /**
   * Ensure loop directory exists
   */
  private async ensureLoopDir(loopId: string): Promise<void> {
    const dirPath = join(this.baseDir, this.sanitizeLoopId(loopId));
    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    const timestamp = Date.now();
    const random = randomBytes(4).toString('hex');
    return `task-${timestamp}-${random}`;
  }

  /**
   * Sanitize loop ID for filesystem usage
   */
  private sanitizeLoopId(loopId: string): string {
    // Remove any path traversal characters
    return loopId.replace(/[\/\\]/g, '-').replace(/\.\./g, '').replace(/^\./, '');
  }

  /**
   * Reorder tasks array by updating order indices sequentially
   */
  private reorderTasksByOrder(tasks: LoopTask[]): LoopTask[] {
    return tasks
      .sort((a, b) => a.order - b.order)
      .map((task, index) => ({
        ...task,
        order: index
      }));
  }
}
