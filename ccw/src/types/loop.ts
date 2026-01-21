/**
 * Loop System Type Definitions
 * CCW Loop System - JSON-based state management for multi-CLI orchestration
 * Reference: .workflow/.scratchpad/loop-system-complete-design-20260121.md
 */

/**
 * Loop status enumeration
 */
export enum LoopStatus {
  CREATED = 'created',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * CLI step configuration
 * Defines a single step in the CLI execution sequence
 */
export interface CliStepConfig {
  /** Step unique identifier */
  step_id: string;

  /** CLI tool name */
  tool: 'bash' | 'gemini' | 'codex' | 'qwen' | string;

  /** Execution mode (for gemini/codex/claude) */
  mode?: 'analysis' | 'write' | 'review';

  /** Bash command (when tool='bash') */
  command?: string;

  /** Prompt template with variable replacement support */
  prompt_template?: string;

  /** Step failure behavior */
  on_error?: 'continue' | 'pause' | 'fail_fast';

  /** Custom parameters */
  custom_args?: Record<string, unknown>;
}

/**
 * Error policy configuration
 */
export interface ErrorPolicy {
  /** Failure behavior */
  on_failure: 'pause' | 'retry' | 'fail_fast';

  /** Retry count */
  retry_count: number;

  /** Maximum retries (optional) */
  max_retries?: number;
}

/**
 * Loop state - complete definition
 * Single source of truth stored in loop-state.json
 */
export interface LoopState {
  /** Loop unique identifier */
  loop_id: string;

  /** Associated task ID */
  task_id: string;

  /** Current status */
  status: LoopStatus;

  /** Current iteration (1-indexed) */
  current_iteration: number;

  /** Maximum iterations */
  max_iterations: number;

  /** Current CLI step index (0-indexed) */
  current_cli_step: number;

  /** CLI execution sequence */
  cli_sequence: CliStepConfig[];

  /**
   * Session mapping table
   * Key format: {tool}_{step_index}
   * Value: conversation_id or execution_id
   */
  session_mapping: Record<string, string>;

  /**
   * State variables
   * Key format: {step_id}_{stdout|stderr}
   * Value: corresponding output content
   */
  state_variables: Record<string, string>;

  /** Success condition expression (JavaScript) */
  success_condition?: string;

  /** Error policy */
  error_policy: ErrorPolicy;

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** Completion timestamp (if applicable) */
  completed_at?: string;

  /** Failure reason (if applicable) */
  failure_reason?: string;

  /** Execution history (optional) */
  execution_history?: ExecutionRecord[];
}

/**
 * Execution record for history tracking
 */
export interface ExecutionRecord {
  iteration: number;
  step_index: number;
  step_id: string;
  tool: string;
  conversation_id: string;
  exit_code: number;
  duration_ms: number;
  timestamp: string;
}

/**
 * Task Loop control configuration
 * Extension to Task JSON schema
 */
export interface TaskLoopControl {
  /** Enable loop */
  enabled: boolean;

  /** Loop description */
  description: string;

  /** Maximum iterations */
  max_iterations: number;

  /** Success condition (JavaScript expression) */
  success_condition: string;

  /** Error policy */
  error_policy: {
    on_failure: 'pause' | 'retry' | 'fail_fast';
    max_retries?: number;
  };

  /** CLI execution sequence */
  cli_sequence: CliStepConfig[];
}

/**
 * Minimal Task interface for loop operations
 * Compatible with task JSON schema
 */
export interface Task {
  /** Task ID */
  id: string;

  /** Task title */
  title?: string;

  /** Task description */
  description?: string;

  /** Task status */
  status?: string;

  /** Task metadata */
  meta?: {
    type?: string;
    created_by?: string;
  };

  /** Task context */
  context?: {
    requirements?: string[];
    acceptance?: string[];
  };

  /** Loop control configuration */
  loop_control?: TaskLoopControl;
}
