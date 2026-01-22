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

// ============================================================================
// CCW-LOOP SKILL STATE (Unified Architecture)
// ============================================================================

/**
 * Skill State - Extension fields managed by ccw-loop skill
 * Stored in .workflow/.loop/{loopId}.json alongside API fields
 */
export interface SkillState {
  /** Current action being executed */
  current_action: 'init' | 'develop' | 'debug' | 'validate' | 'complete' | null;

  /** Last completed action */
  last_action: string | null;

  /** List of completed action names */
  completed_actions: string[];

  /** Execution mode */
  mode: 'interactive' | 'auto';

  /** Development phase state */
  develop: {
    total: number;
    completed: number;
    current_task?: string;
    tasks: DevelopTask[];
    last_progress_at: string | null;
  };

  /** Debug phase state */
  debug: {
    active_bug?: string;
    hypotheses_count: number;
    hypotheses: Hypothesis[];
    confirmed_hypothesis: string | null;
    iteration: number;
    last_analysis_at: string | null;
  };

  /** Validation phase state */
  validate: {
    pass_rate: number;
    coverage: number;
    test_results: TestResult[];
    passed: boolean;
    failed_tests: string[];
    last_run_at: string | null;
  };

  /** Error tracking */
  errors: Array<{
    action: string;
    message: string;
    timestamp: string;
  }>;
}

/**
 * Development task
 */
export interface DevelopTask {
  id: string;
  description: string;
  tool: 'gemini' | 'qwen' | 'codex' | 'bash';
  mode: 'analysis' | 'write';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  files_changed?: string[];
  created_at: string;
  completed_at?: string;
}

/**
 * Debug hypothesis
 */
export interface Hypothesis {
  id: string;
  description: string;
  testable_condition: string;
  logging_point: string;
  evidence_criteria: {
    confirm: string;
    reject: string;
  };
  likelihood: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'inconclusive';
  evidence?: Record<string, unknown>;
  verdict_reason?: string;
}

/**
 * Test result
 */
export interface TestResult {
  test_name: string;
  suite: string;
  status: 'passed' | 'failed' | 'skipped';
  duration_ms: number;
  error_message?: string;
  stack_trace?: string;
}

/**
 * V2 Loop Storage Format (simplified, for Dashboard API)
 * This is the unified state structure used by both API and ccw-loop skill
 */
export interface V2LoopState {
  // === API Fields (managed by loop-v2-routes.ts) ===
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

  // === Skill Extension Fields (managed by ccw-loop skill) ===
  skill_state?: SkillState;
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
