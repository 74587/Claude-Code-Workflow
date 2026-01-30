// ========================================
// CLI Stream Store
// ========================================
// Zustand store for managing CLI streaming output

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ========== Types ==========

/**
 * Output line type for CLI streaming
 */
export interface CliOutputLine {
  type: 'stdout' | 'stderr' | 'metadata' | 'thought' | 'system' | 'tool_call';
  content: string;
  timestamp: number;
}

/**
 * CLI execution status
 */
export type CliExecutionStatus = 'running' | 'completed' | 'error';

/**
 * CLI execution state
 */
export interface CliExecutionState {
  tool: string;
  mode: string;
  status: CliExecutionStatus;
  output: CliOutputLine[];
  startTime: number;
  endTime?: number;
  recovered?: boolean;
}

/**
 * CLI stream state interface
 */
interface CliStreamState {
  outputs: Record<string, CliOutputLine[]>;
  executions: Record<string, CliExecutionState>;
  currentExecutionId: string | null;

  // Legacy methods
  addOutput: (executionId: string, line: CliOutputLine) => void;
  clearOutputs: (executionId: string) => void;
  getOutputs: (executionId: string) => CliOutputLine[];

  // Multi-execution methods
  getAllExecutions: () => CliExecutionState[];
  upsertExecution: (executionId: string, exec: Partial<CliExecutionState> & { tool?: string; mode?: string }) => void;
  removeExecution: (executionId: string) => void;
  setCurrentExecution: (executionId: string | null) => void;
}

// ========== Constants ==========

/**
 * Maximum number of output lines to keep per execution
 * Prevents memory issues for long-running executions
 */
const MAX_OUTPUT_LINES = 5000;

// ========== Store ==========

/**
 * Zustand store for CLI streaming output
 *
 * @remarks
 * Manages streaming output from CLI executions in memory.
 * Each execution has its own output array, accessible by executionId.
 *
 * @example
 * ```tsx
 * const addOutput = useCliStreamStore(state => state.addOutput);
 * addOutput('exec-123', { type: 'stdout', content: 'Hello', timestamp: Date.now() });
 * ```
 */
export const useCliStreamStore = create<CliStreamState>()(
  devtools(
    (set, get) => ({
      outputs: {},
      executions: {},
      currentExecutionId: null,

      addOutput: (executionId: string, line: CliOutputLine) => {
        set((state) => {
          const current = state.outputs[executionId] || [];
          const updated = [...current, line];

          // Trim if too long to prevent memory issues
          if (updated.length > MAX_OUTPUT_LINES) {
            return {
              outputs: {
                ...state.outputs,
                [executionId]: updated.slice(-MAX_OUTPUT_LINES),
              },
            };
          }

          return {
            outputs: {
              ...state.outputs,
              [executionId]: updated,
            },
          };
        }, false, 'cliStream/addOutput');

        // Also update in executions
        const state = get();
        if (state.executions[executionId]) {
          set((state) => ({
            executions: {
              ...state.executions,
              [executionId]: {
                ...state.executions[executionId],
                output: [...state.executions[executionId].output, line],
              },
            },
          }), false, 'cliStream/updateExecutionOutput');
        }
      },

      clearOutputs: (executionId: string) => {
        set(
          (state) => ({
            outputs: {
              ...state.outputs,
              [executionId]: [],
            },
          }),
          false,
          'cliStream/clearOutputs'
        );
      },

      getOutputs: (executionId: string) => {
        return get().outputs[executionId] || [];
      },

      // Multi-execution methods
      getAllExecutions: () => {
        return Object.values(get().executions);
      },

      upsertExecution: (executionId: string, exec: Partial<CliExecutionState> & { tool?: string; mode?: string }) => {
        set((state) => {
          const existing = state.executions[executionId];
          const updated: CliExecutionState = existing
            ? { ...existing, ...exec }
            : {
                tool: exec.tool || 'cli',
                mode: exec.mode || 'analysis',
                status: exec.status || 'running',
                output: exec.output || [],
                startTime: exec.startTime || Date.now(),
                endTime: exec.endTime,
                recovered: exec.recovered,
              };

          return {
            executions: {
              ...state.executions,
              [executionId]: updated,
            },
          };
        }, false, 'cliStream/upsertExecution');
      },

      removeExecution: (executionId: string) => {
        set((state) => {
          const newExecutions = { ...state.executions };
          delete newExecutions[executionId];
          return {
            executions: newExecutions,
            currentExecutionId: state.currentExecutionId === executionId ? null : state.currentExecutionId,
          };
        }, false, 'cliStream/removeExecution');
      },

      setCurrentExecution: (executionId: string | null) => {
        set({ currentExecutionId: executionId }, false, 'cliStream/setCurrentExecution');
      },
    }),
    { name: 'CliStreamStore' }
  )
);

// ========== Selectors ==========

/**
 * Selector for getting outputs by execution ID
 */
export const selectOutputs = (state: CliStreamState, executionId: string) =>
  state.outputs[executionId] || [];

/**
 * Selector for getting addOutput action
 */
export const selectAddOutput = (state: CliStreamState) => state.addOutput;

/**
 * Selector for getting clearOutputs action
 */
export const selectClearOutputs = (state: CliStreamState) => state.clearOutputs;

/**
 * Selector for getting all executions
 */
export const selectAllExecutions = (state: CliStreamState) => state.executions;

/**
 * Selector for getting current execution ID
 */
export const selectCurrentExecutionId = (state: CliStreamState) => state.currentExecutionId;

/**
 * Selector for getting active execution count
 */
export const selectActiveExecutionCount = (state: CliStreamState) =>
  Object.values(state.executions).filter(e => e.status === 'running').length;
