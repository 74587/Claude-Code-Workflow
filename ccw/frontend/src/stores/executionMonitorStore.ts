// ========================================
// Execution Monitor Store
// ========================================
// Zustand store for execution monitoring in Terminal Dashboard.
// Tracks active executions, handles WebSocket messages, and provides control actions.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ========== Types ==========

export type ExecutionStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface StepInfo {
  id: string;
  name: string;
  status: ExecutionStatus;
  output?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ExecutionInfo {
  executionId: string;
  flowId: string;
  flowName: string;
  sessionKey: string;
  status: ExecutionStatus;
  totalSteps: number;
  completedSteps: number;
  currentStepId?: string;
  steps: StepInfo[];
  startedAt: string;
  completedAt?: string;
}

export type ExecutionWSMessageType =
  | 'EXECUTION_STARTED'
  | 'EXECUTION_STEP_START'
  | 'EXECUTION_STEP_PROGRESS'
  | 'EXECUTION_STEP_COMPLETE'
  | 'EXECUTION_STEP_FAILED'
  | 'EXECUTION_PAUSED'
  | 'EXECUTION_RESUMED'
  | 'EXECUTION_STOPPED'
  | 'EXECUTION_COMPLETED';

export interface ExecutionWSMessage {
  type: ExecutionWSMessageType;
  payload: {
    executionId: string;
    flowId: string;
    sessionKey: string;
    stepId?: string;
    stepName?: string;
    progress?: number;
    output?: string;
    error?: string;
    timestamp: string;
  };
}

// ========== State Interface ==========

interface ExecutionMonitorState {
  activeExecutions: Record<string, ExecutionInfo>;
  currentExecutionId: string | null;
  isPanelOpen: boolean;
}

interface ExecutionMonitorActions {
  handleExecutionMessage: (msg: ExecutionWSMessage) => void;
  selectExecution: (executionId: string | null) => void;
  pauseExecution: (executionId: string) => void;
  resumeExecution: (executionId: string) => void;
  stopExecution: (executionId: string) => void;
  setPanelOpen: (open: boolean) => void;
  clearExecution: (executionId: string) => void;
  clearAllExecutions: () => void;
}

type ExecutionMonitorStore = ExecutionMonitorState & ExecutionMonitorActions;

// ========== Initial State ==========

const initialState: ExecutionMonitorState = {
  activeExecutions: {},
  currentExecutionId: null,
  isPanelOpen: false,
};

// ========== Store ==========

export const useExecutionMonitorStore = create<ExecutionMonitorStore>()(
  devtools(
    (set) => ({
      ...initialState,

      handleExecutionMessage: (msg: ExecutionWSMessage) => {
        const { type, payload } = msg;
        const { executionId, flowId, sessionKey, stepId, stepName, output, error, timestamp } = payload;

        set((state) => {
          const existing = state.activeExecutions[executionId];

          switch (type) {
            case 'EXECUTION_STARTED':
              return {
                activeExecutions: {
                  ...state.activeExecutions,
                  [executionId]: {
                    executionId,
                    flowId,
                    flowName: stepName || 'Workflow',
                    sessionKey,
                    status: 'running',
                    totalSteps: 0,
                    completedSteps: 0,
                    steps: [],
                    startedAt: timestamp,
                  },
                },
                currentExecutionId: executionId,
                isPanelOpen: true,
              };

            case 'EXECUTION_STEP_START':
              if (!existing) return state;
              return {
                activeExecutions: {
                  ...state.activeExecutions,
                  [executionId]: {
                    ...existing,
                    status: 'running',
                    currentStepId: stepId,
                    steps: [
                      ...existing.steps.filter(s => s.id !== stepId),
                      {
                        id: stepId || '',
                        name: stepName || '',
                        status: 'running',
                        startedAt: timestamp,
                      },
                    ],
                  },
                },
              };

            case 'EXECUTION_STEP_PROGRESS':
              if (!existing || !stepId) return state;
              return {
                activeExecutions: {
                  ...state.activeExecutions,
                  [executionId]: {
                    ...existing,
                    steps: existing.steps.map(s =>
                      s.id === stepId
                        ? { ...s, output: (s.output || '') + (output || '') }
                        : s
                    ),
                  },
                },
              };

            case 'EXECUTION_STEP_COMPLETE':
              if (!existing) return state;
              return {
                activeExecutions: {
                  ...state.activeExecutions,
                  [executionId]: {
                    ...existing,
                    completedSteps: existing.completedSteps + 1,
                    steps: existing.steps.map(s =>
                      s.id === stepId
                        ? { ...s, status: 'completed', completedAt: timestamp }
                        : s
                    ),
                  },
                },
              };

            case 'EXECUTION_STEP_FAILED':
              if (!existing) return state;
              return {
                activeExecutions: {
                  ...state.activeExecutions,
                  [executionId]: {
                    ...existing,
                    status: 'paused',
                    steps: existing.steps.map(s =>
                      s.id === stepId
                        ? { ...s, status: 'failed', error, completedAt: timestamp }
                        : s
                    ),
                  },
                },
              };

            case 'EXECUTION_PAUSED':
              if (!existing) return state;
              return {
                activeExecutions: {
                  ...state.activeExecutions,
                  [executionId]: { ...existing, status: 'paused' },
                },
              };

            case 'EXECUTION_RESUMED':
              if (!existing) return state;
              return {
                activeExecutions: {
                  ...state.activeExecutions,
                  [executionId]: { ...existing, status: 'running' },
                },
              };

            case 'EXECUTION_STOPPED':
              if (!existing) return state;
              return {
                activeExecutions: {
                  ...state.activeExecutions,
                  [executionId]: { ...existing, status: 'cancelled', completedAt: timestamp },
                },
              };

            case 'EXECUTION_COMPLETED':
              if (!existing) return state;
              return {
                activeExecutions: {
                  ...state.activeExecutions,
                  [executionId]: { ...existing, status: 'completed', completedAt: timestamp },
                },
              };

            default:
              return state;
          }
        }, false, `handleExecutionMessage/${type}`);
      },

      selectExecution: (executionId: string | null) => {
        set({ currentExecutionId: executionId }, false, 'selectExecution');
      },

      pauseExecution: (executionId: string) => {
        // TODO: Call API to pause execution
        console.log('[ExecutionMonitor] Pause execution:', executionId);
      },

      resumeExecution: (executionId: string) => {
        // TODO: Call API to resume execution
        console.log('[ExecutionMonitor] Resume execution:', executionId);
      },

      stopExecution: (executionId: string) => {
        // TODO: Call API to stop execution
        console.log('[ExecutionMonitor] Stop execution:', executionId);
      },

      setPanelOpen: (open: boolean) => {
        set({ isPanelOpen: open }, false, 'setPanelOpen');
      },

      clearExecution: (executionId: string) => {
        set((state) => {
          const next = { ...state.activeExecutions };
          delete next[executionId];
          return {
            activeExecutions: next,
            currentExecutionId: state.currentExecutionId === executionId ? null : state.currentExecutionId,
          };
        }, false, 'clearExecution');
      },

      clearAllExecutions: () => {
        set({ activeExecutions: {}, currentExecutionId: null }, false, 'clearAllExecutions');
      },
    }),
    { name: 'ExecutionMonitorStore' }
  )
);

// ========== Selectors ==========

export const selectActiveExecutions = (state: ExecutionMonitorStore) => state.activeExecutions;
export const selectCurrentExecution = (state: ExecutionMonitorStore) =>
  state.currentExecutionId ? state.activeExecutions[state.currentExecutionId] : null;
export const selectIsPanelOpen = (state: ExecutionMonitorStore) => state.isPanelOpen;
export const selectActiveExecutionCount = (state: ExecutionMonitorStore) =>
  Object.values(state.activeExecutions).filter(e => e.status === 'running' || e.status === 'paused').length;
