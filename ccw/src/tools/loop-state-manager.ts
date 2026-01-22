/**
 * Loop State Manager
 * CCW Loop System - JSON state persistence layer
 * Reference: .workflow/.scratchpad/loop-system-complete-design-20260121.md section 4.1
 */

import { readFile, writeFile, unlink, mkdir, copyFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { LoopState, LoopStatus, TaskLoopControl } from '../types/loop.js';

export class LoopStateManager {
  private baseDir: string;

  constructor(workflowDir: string) {
    // State files stored in .workflow/.loop/
    this.baseDir = join(workflowDir, '.workflow', '.loop');
  }

  /**
   * Create new loop state
   */
  async createState(loopId: string, taskId: string, config: TaskLoopControl): Promise<LoopState> {
    await this.ensureDir();

    const state: LoopState = {
      loop_id: loopId,
      task_id: taskId,
      status: 'created' as LoopStatus,
      current_iteration: 1,
      max_iterations: config.max_iterations,
      current_cli_step: 0,
      cli_sequence: config.cli_sequence,
      session_mapping: {},
      state_variables: {},
      success_condition: config.success_condition,
      error_policy: {
        on_failure: config.error_policy.on_failure,
        retry_count: 0,
        max_retries: config.error_policy.max_retries || 3
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      execution_history: []
    };

    await this.writeState(loopId, state);
    return state;
  }

  /**
   * Read loop state
   */
  async readState(loopId: string): Promise<LoopState> {
    const filePath = this.getStateFilePath(loopId);

    if (!existsSync(filePath)) {
      throw new Error(`Loop state not found: ${loopId}`);
    }

    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as LoopState;
  }

  /**
   * Update loop state
   */
  async updateState(loopId: string, updates: Partial<LoopState>): Promise<LoopState> {
    const currentState = await this.readState(loopId);

    const newState: LoopState = {
      ...currentState,
      ...updates,
      updated_at: new Date().toISOString()
    };

    await this.writeState(loopId, newState);
    return newState;
  }

  /**
   * Delete loop state
   */
  async deleteState(loopId: string): Promise<void> {
    const filePath = this.getStateFilePath(loopId);

    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  }

  /**
   * List all loop states
   */
  async listStates(): Promise<LoopState[]> {
    if (!existsSync(this.baseDir)) {
      return [];
    }

    const { readdir } = await import('fs/promises');
    const files = await readdir(this.baseDir);
    const stateFiles = files.filter(f => f.startsWith('loop-') && f.endsWith('.json'));

    const states: LoopState[] = [];
    for (const file of stateFiles) {
      const loopId = file.replace('.json', '');
      try {
        const state = await this.readState(loopId);
        states.push(state);
      } catch (err) {
        console.error(`Failed to read state ${loopId}:`, err);
      }
    }

    return states;
  }

  /**
   * Read state with recovery from backup
   */
  async readStateWithRecovery(loopId: string): Promise<LoopState> {
    try {
      return await this.readState(loopId);
    } catch (error) {
      console.warn(`State file corrupted, attempting recovery for ${loopId}...`);

      // Try reading from backup
      const backupFile = `${this.getStateFilePath(loopId)}.backup`;
      if (existsSync(backupFile)) {
        const content = await readFile(backupFile, 'utf-8');
        const state = JSON.parse(content) as LoopState;
        // Restore from backup
        await this.writeState(loopId, state);
        return state;
      }

      throw error;
    }
  }

  /**
   * Get state file path
   */
  getStateFilePath(loopId: string): string {
    return join(this.baseDir, `${loopId}.json`);
  }

  /**
   * Ensure directory exists
   */
  private async ensureDir(): Promise<void> {
    if (!existsSync(this.baseDir)) {
      await mkdir(this.baseDir, { recursive: true });
    }
  }

  /**
   * Write state file with automatic backup
   */
  private async writeState(loopId: string, state: LoopState): Promise<void> {
    const filePath = this.getStateFilePath(loopId);

    // Create backup if file exists
    if (existsSync(filePath)) {
      const backupPath = `${filePath}.backup`;
      await copyFile(filePath, backupPath).catch(() => {
        // Ignore backup errors
      });
    }

    await writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
  }
}
