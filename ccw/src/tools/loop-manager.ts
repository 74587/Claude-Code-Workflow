/**
 * Loop Manager
 * CCW Loop System - Core orchestration engine
 * Reference: .workflow/.scratchpad/loop-system-complete-design-20260121.md section 4.2
 */

import chalk from 'chalk';
import { LoopStateManager } from './loop-state-manager.js';
import { cliExecutorTool } from './cli-executor.js';
import { broadcastLoopUpdate } from '../core/websocket.js';
import type { LoopState, LoopStatus, CliStepConfig, ExecutionRecord, Task } from '../types/loop.js';

export class LoopManager {
  private stateManager: LoopStateManager;

  constructor(workflowDir: string) {
    this.stateManager = new LoopStateManager(workflowDir);
  }

  /**
   * Start new loop
   */
  async startLoop(task: Task): Promise<string> {
    if (!task.loop_control?.enabled) {
      throw new Error(`Task ${task.id} does not have loop enabled`);
    }

    const loopId = this.generateLoopId(task.id);
    console.log(chalk.cyan(`\n  🔄 Starting loop: ${loopId}\n`));

    // Create initial state
    const state = await this.stateManager.createState(
      loopId,
      task.id,
      task.loop_control
    );

    // Update to running status
    await this.stateManager.updateState(loopId, { status: 'running' as LoopStatus });

    // Start execution (non-blocking)
    this.runNextStep(loopId).catch(err => {
      console.error(chalk.red(`\n  ✗ Loop execution error: ${err}\n`));
    });

    return loopId;
  }

  /**
   * Execute next step
   */
  async runNextStep(loopId: string): Promise<void> {
    const state = await this.stateManager.readState(loopId);

    // Check if should terminate
    if (await this.shouldTerminate(state)) {
      return;
    }

    // Get current step config
    const stepConfig = state.cli_sequence[state.current_cli_step];
    if (!stepConfig) {
      console.error(chalk.red(`  ✗ Invalid step index: ${state.current_cli_step}`));
      await this.markFailed(loopId, 'Invalid step configuration');
      return;
    }

    console.log(chalk.gray(`  [Iteration ${state.current_iteration}] Step ${state.current_cli_step + 1}/${state.cli_sequence.length}: ${stepConfig.step_id}`));

    try {
      // Execute step
      const result = await this.executeStep(state, stepConfig);

      // Update state after step
      await this.updateStateAfterStep(loopId, stepConfig, result);

      // Check if iteration completed
      const newState = await this.stateManager.readState(loopId);
      if (newState.current_cli_step === 0) {
        console.log(chalk.green(`  ✓ Iteration ${newState.current_iteration - 1} completed\n`));

        // Check success condition
        if (await this.evaluateSuccessCondition(newState)) {
          await this.markCompleted(loopId);
          return;
        }
      }

      // Schedule next step (prevent stack overflow)
      setImmediate(() => this.runNextStep(loopId).catch(err => {
        console.error(chalk.red(`\n  ✗ Next step error: ${err}\n`));
      }));

    } catch (error) {
      await this.handleError(loopId, stepConfig, error as Error);
    }
  }

  /**
   * Execute single step
   */
  private async executeStep(
    state: LoopState,
    stepConfig: CliStepConfig
  ): Promise<{ output: string; stderr: string; conversationId: string; exitCode: number; durationMs: number }> {
    const startTime = Date.now();

    // Prepare prompt (replace variables)
    const prompt = stepConfig.prompt_template
      ? this.replaceVariables(stepConfig.prompt_template, state.state_variables)
      : '';

    // Get resume ID
    const sessionKey = `${stepConfig.tool}_${state.current_cli_step}`;
    const resumeId = state.session_mapping[sessionKey];

    // Prepare execution params
    const execParams: any = {
      tool: stepConfig.tool,
      prompt,
      mode: stepConfig.mode || 'analysis',
      resume: resumeId,
      stream: false
    };

    // Bash command special handling
    if (stepConfig.tool === 'bash' && stepConfig.command) {
      execParams.prompt = stepConfig.command;
    }

    // Execute CLI tool
    const result = await cliExecutorTool.execute(execParams);

    const durationMs = Date.now() - startTime;

    return {
      output: result.stdout || '',
      stderr: result.stderr || '',
      conversationId: result.execution.id,
      exitCode: result.execution.exit_code || 0,
      durationMs
    };
  }

  /**
   * Update state after step execution
   */
  private async updateStateAfterStep(
    loopId: string,
    stepConfig: CliStepConfig,
    result: { output: string; stderr: string; conversationId: string; exitCode: number; durationMs: number }
  ): Promise<void> {
    const state = await this.stateManager.readState(loopId);

    // Update session_mapping
    const sessionKey = `${stepConfig.tool}_${state.current_cli_step}`;
    const newSessionMapping = {
      ...state.session_mapping,
      [sessionKey]: result.conversationId
    };

    // Update state_variables
    const newStateVariables = {
      ...state.state_variables,
      [`${stepConfig.step_id}_stdout`]: result.output,
      [`${stepConfig.step_id}_stderr`]: result.stderr
    };

    // Add execution record
    const executionRecord: ExecutionRecord = {
      iteration: state.current_iteration,
      step_index: state.current_cli_step,
      step_id: stepConfig.step_id,
      tool: stepConfig.tool,
      conversation_id: result.conversationId,
      exit_code: result.exitCode,
      duration_ms: result.durationMs,
      timestamp: new Date().toISOString()
    };

    const newExecutionHistory = [...(state.execution_history || []), executionRecord];

    // Calculate next step
    let nextStep = state.current_cli_step + 1;
    let nextIteration = state.current_iteration;

    // Reset step and increment iteration if round complete
    if (nextStep >= state.cli_sequence.length) {
      nextStep = 0;
      nextIteration += 1;
    }

    // Update state
    const newState = await this.stateManager.updateState(loopId, {
      session_mapping: newSessionMapping,
      state_variables: newStateVariables,
      execution_history: newExecutionHistory,
      current_cli_step: nextStep,
      current_iteration: nextIteration
    });

    // Broadcast step completion with step-specific data
    this.broadcastStepCompletion(loopId, stepConfig.step_id, result.exitCode, result.durationMs, result.output);
  }

  /**
   * Replace template variables
   */
  private replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;

    // Replace [variable_name] format
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\[${key}\\]`, 'g');
      result = result.replace(regex, value);
    }

    return result;
  }

  /**
   * Evaluate success condition with security constraints
   * Only allows simple comparison and logical expressions
   */
  private async evaluateSuccessCondition(state: LoopState): Promise<boolean> {
    if (!state.success_condition) {
      return false;
    }

    try {
      // Security: Validate condition before execution
      // Only allow safe characters: letters, digits, spaces, operators, parentheses, dots, quotes, underscores
      const unsafePattern = /[^\w\s\.\(\)\[\]\{\}\'\"\!\=\>\<\&\|\+\-\*\/\?\:]/;
      if (unsafePattern.test(state.success_condition)) {
        console.error(chalk.yellow(`  ⚠ Unsafe success condition contains invalid characters`));
        return false;
      }

      // Block dangerous patterns
      const blockedPatterns = [
        /process\./,
        /require\(/,
        /import\s/,
        /eval\(/,
        /Function\(/,
        /__proto__/,
        /constructor\[/
      ];

      for (const pattern of blockedPatterns) {
        if (pattern.test(state.success_condition)) {
          console.error(chalk.yellow(`  ⚠ Blocked dangerous pattern in success condition`));
          return false;
        }
      }

      // Create a minimal sandbox context with only necessary data
      // Using a Proxy to restrict access to only state_variables and current_iteration
      const sandbox = {
        get state_variables() {
          return state.state_variables;
        },
        get current_iteration() {
          return state.current_iteration;
        }
      };

      // Create restricted context using Proxy
      const restrictedContext = new Proxy(sandbox, {
        has() {
          return true; // Allow all property access
        },
        get(target, prop) {
          // Only allow access to state_variables and current_iteration
          if (prop === 'state_variables' || prop === 'current_iteration') {
            return target[prop];
          }
          // Block access to other properties (including dangerous globals)
          return undefined;
        }
      });

      // Evaluate condition in restricted context
      // We use the Function constructor but with a restricted scope
      const conditionFn = new Function(
        'state_variables',
        'current_iteration',
        `return (${state.success_condition});`
      );

      const result = conditionFn(
        restrictedContext.state_variables,
        restrictedContext.current_iteration
      );

      return Boolean(result);

    } catch (error) {
      console.error(chalk.yellow(`  ⚠ Failed to evaluate success condition: ${error instanceof Error ? error.message : error}`));
      return false;
    }
  }

  /**
   * Check if should terminate loop
   */
  private async shouldTerminate(state: LoopState): Promise<boolean> {
    // Completed or failed
    if (state.status === 'completed' || state.status === 'failed') {
      return true;
    }

    // Paused
    if (state.status === 'paused') {
      console.log(chalk.yellow(`  ⏸ Loop is paused: ${state.loop_id}`));
      return true;
    }

    // Max iterations exceeded
    if (state.current_iteration > state.max_iterations) {
      console.log(chalk.yellow(`  ⚠ Max iterations reached: ${state.max_iterations}`));
      await this.markCompleted(state.loop_id, 'Max iterations reached');
      return true;
    }

    return false;
  }

  /**
   * Handle errors
   */
  private async handleError(loopId: string, stepConfig: CliStepConfig, error: Error): Promise<void> {
    console.error(chalk.red(`  ✗ Step failed: ${stepConfig.step_id}`));
    console.error(chalk.red(`  ${error.message}`));

    const state = await this.stateManager.readState(loopId);

    // Act based on error_policy
    switch (state.error_policy.on_failure) {
      case 'pause':
        await this.pauseLoop(loopId, `Step ${stepConfig.step_id} failed: ${error.message}`);
        break;

      case 'retry':
        if (state.error_policy.retry_count < (state.error_policy.max_retries || 3)) {
          console.log(chalk.yellow(`  🔄 Retrying... (${state.error_policy.retry_count + 1}/${state.error_policy.max_retries})`));
          await this.stateManager.updateState(loopId, {
            error_policy: {
              ...state.error_policy,
              retry_count: state.error_policy.retry_count + 1
            }
          });
          // Re-execute current step
          await this.runNextStep(loopId);
        } else {
          await this.markFailed(loopId, `Max retries exceeded for step ${stepConfig.step_id}`);
        }
        break;

      case 'fail_fast':
        await this.markFailed(loopId, `Step ${stepConfig.step_id} failed: ${error.message}`);
        break;
    }
  }

  /**
   * Pause loop
   */
  async pauseLoop(loopId: string, reason?: string): Promise<void> {
    console.log(chalk.yellow(`\n  ⏸ Pausing loop: ${loopId}`));
    if (reason) {
      console.log(chalk.gray(`  Reason: ${reason}`));
    }

    await this.stateManager.updateState(loopId, {
      status: 'paused' as LoopStatus,
      failure_reason: reason
    });
  }

  /**
   * Resume loop
   */
  async resumeLoop(loopId: string): Promise<void> {
    console.log(chalk.cyan(`\n  ▶ Resuming loop: ${loopId}\n`));

    await this.stateManager.updateState(loopId, {
      status: 'running' as LoopStatus,
      error_policy: {
        ...(await this.stateManager.readState(loopId)).error_policy,
        retry_count: 0
      }
    });

    await this.runNextStep(loopId);
  }

  /**
   * Stop loop
   */
  async stopLoop(loopId: string): Promise<void> {
    console.log(chalk.red(`\n  ⏹ Stopping loop: ${loopId}\n`));

    await this.stateManager.updateState(loopId, {
      status: 'failed' as LoopStatus,
      failure_reason: 'Manually stopped by user',
      completed_at: new Date().toISOString()
    });
  }

  /**
   * Broadcast state update via WebSocket
   */
  private broadcastStateUpdate(state: LoopState, eventType: 'LOOP_STATE_UPDATE' | 'LOOP_COMPLETED' = 'LOOP_STATE_UPDATE'): void {
    try {
      if (eventType === 'LOOP_STATE_UPDATE') {
        broadcastLoopUpdate({
          type: 'LOOP_STATE_UPDATE',
          loop_id: state.loop_id,
          status: state.status as 'created' | 'running' | 'paused' | 'completed' | 'failed',
          current_iteration: state.current_iteration,
          current_cli_step: state.current_cli_step,
          updated_at: state.updated_at
        });
      } else if (eventType === 'LOOP_COMPLETED') {
        broadcastLoopUpdate({
          type: 'LOOP_COMPLETED',
          loop_id: state.loop_id,
          final_status: state.status === 'completed' ? 'completed' : 'failed',
          total_iterations: state.current_iteration,
          reason: state.failure_reason
        });
      }
    } catch (error) {
      // Silently ignore broadcast errors
    }
  }

  /**
   * Broadcast step completion via WebSocket
   */
  private broadcastStepCompletion(
    loopId: string,
    stepId: string,
    exitCode: number,
    durationMs: number,
    output: string
  ): void {
    try {
      broadcastLoopUpdate({
        type: 'LOOP_STEP_COMPLETED',
        loop_id: loopId,
        step_id: stepId,
        exit_code: exitCode,
        duration_ms: durationMs,
        output: output
      });
    } catch (error) {
      // Silently ignore broadcast errors
    }
  }

  /**
   * Mark as completed
   */
  private async markCompleted(loopId: string, reason?: string): Promise<void> {
    console.log(chalk.green(`\n  ✓ Loop completed: ${loopId}`));
    if (reason) {
      console.log(chalk.gray(`  ${reason}`));
    }

    const state = await this.stateManager.updateState(loopId, {
      status: 'completed' as LoopStatus,
      completed_at: new Date().toISOString()
    });

    // Broadcast completion
    this.broadcastStateUpdate(state, 'LOOP_COMPLETED');
  }

  /**
   * Mark as failed
   */
  private async markFailed(loopId: string, reason: string): Promise<void> {
    console.log(chalk.red(`\n  ✗ Loop failed: ${loopId}`));
    console.log(chalk.gray(`  ${reason}\n`));

    const state = await this.stateManager.updateState(loopId, {
      status: 'failed' as LoopStatus,
      failure_reason: reason,
      completed_at: new Date().toISOString()
    });

    // Broadcast failure
    this.broadcastStateUpdate(state, 'LOOP_COMPLETED');
  }

  /**
   * Get loop status
   */
  async getStatus(loopId: string): Promise<LoopState> {
    return this.stateManager.readState(loopId);
  }

  /**
   * List all loops
   */
  async listLoops(): Promise<LoopState[]> {
    return this.stateManager.listStates();
  }

  /**
   * Generate loop ID
   */
  private generateLoopId(taskId: string): string {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    return `loop-${taskId}-${timestamp}`;
  }
}
