// ========================================
// Execution Store
// ========================================
// Zustand store for Orchestrator execution state management

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  ExecutionStore,
  ExecutionState,
  ExecutionStatus,
  NodeExecutionState,
  ExecutionLog,
} from '../types/execution';

// Constants
const MAX_LOGS = 500;

// Initial state
const initialState = {
  // Current execution
  currentExecution: null as ExecutionState | null,

  // Node execution states
  nodeStates: {} as Record<string, NodeExecutionState>,

  // Execution logs
  logs: [] as ExecutionLog[],
  maxLogs: MAX_LOGS,

  // UI state
  isMonitorExpanded: true,
  autoScrollLogs: true,
};

export const useExecutionStore = create<ExecutionStore>()(
  devtools(
    (set) => ({
      ...initialState,

      // ========== Execution Lifecycle ==========

      startExecution: (execId: string, flowId: string) => {
        const now = new Date().toISOString();
        set(
          {
            currentExecution: {
              execId,
              flowId,
              status: 'running',
              startedAt: now,
              elapsedMs: 0,
            },
            nodeStates: {},
            logs: [],
          },
          false,
          'startExecution'
        );
      },

      setExecutionStatus: (status: ExecutionStatus, currentNodeId?: string) => {
        set(
          (state) => {
            if (!state.currentExecution) return state;
            return {
              currentExecution: {
                ...state.currentExecution,
                status,
                currentNodeId: currentNodeId ?? state.currentExecution.currentNodeId,
              },
            };
          },
          false,
          'setExecutionStatus'
        );
      },

      completeExecution: (status: 'completed' | 'failed') => {
        const now = new Date().toISOString();
        set(
          (state) => {
            if (!state.currentExecution) return state;
            const startTime = new Date(state.currentExecution.startedAt).getTime();
            const elapsedMs = Date.now() - startTime;
            return {
              currentExecution: {
                ...state.currentExecution,
                status,
                completedAt: now,
                elapsedMs,
                currentNodeId: undefined,
              },
            };
          },
          false,
          'completeExecution'
        );
      },

      clearExecution: () => {
        set(
          {
            currentExecution: null,
            nodeStates: {},
            logs: [],
          },
          false,
          'clearExecution'
        );
      },

      // ========== Node State Updates ==========

      setNodeStarted: (nodeId: string) => {
        const now = new Date().toISOString();
        set(
          (state) => ({
            nodeStates: {
              ...state.nodeStates,
              [nodeId]: {
                nodeId,
                status: 'running',
                startedAt: now,
              },
            },
          }),
          false,
          'setNodeStarted'
        );
      },

      setNodeCompleted: (nodeId: string, result?: unknown) => {
        const now = new Date().toISOString();
        set(
          (state) => ({
            nodeStates: {
              ...state.nodeStates,
              [nodeId]: {
                ...state.nodeStates[nodeId],
                nodeId,
                status: 'completed',
                completedAt: now,
                result,
              },
            },
          }),
          false,
          'setNodeCompleted'
        );
      },

      setNodeFailed: (nodeId: string, error: string) => {
        const now = new Date().toISOString();
        set(
          (state) => ({
            nodeStates: {
              ...state.nodeStates,
              [nodeId]: {
                ...state.nodeStates[nodeId],
                nodeId,
                status: 'failed',
                completedAt: now,
                error,
              },
            },
          }),
          false,
          'setNodeFailed'
        );
      },

      clearNodeStates: () => {
        set({ nodeStates: {} }, false, 'clearNodeStates');
      },

      // ========== Logs ==========

      addLog: (log: ExecutionLog) => {
        set(
          (state) => {
            const newLogs = [...state.logs, log];
            // Trim logs if exceeding max
            if (newLogs.length > state.maxLogs) {
              return { logs: newLogs.slice(-state.maxLogs) };
            }
            return { logs: newLogs };
          },
          false,
          'addLog'
        );
      },

      clearLogs: () => {
        set({ logs: [] }, false, 'clearLogs');
      },

      // ========== UI State ==========

      setMonitorExpanded: (expanded: boolean) => {
        set({ isMonitorExpanded: expanded }, false, 'setMonitorExpanded');
      },

      setAutoScrollLogs: (autoScroll: boolean) => {
        set({ autoScrollLogs: autoScroll }, false, 'setAutoScrollLogs');
      },
    }),
    { name: 'ExecutionStore' }
  )
);

// Selectors for common access patterns
export const selectCurrentExecution = (state: ExecutionStore) => state.currentExecution;
export const selectNodeStates = (state: ExecutionStore) => state.nodeStates;
export const selectLogs = (state: ExecutionStore) => state.logs;
export const selectIsMonitorExpanded = (state: ExecutionStore) => state.isMonitorExpanded;
export const selectAutoScrollLogs = (state: ExecutionStore) => state.autoScrollLogs;

// Helper to check if execution is active
export const selectIsExecuting = (state: ExecutionStore) => {
  return state.currentExecution?.status === 'running';
};

// Helper to get node status
export const selectNodeStatus = (nodeId: string) => (state: ExecutionStore) => {
  return state.nodeStates[nodeId]?.status ?? 'pending';
};
