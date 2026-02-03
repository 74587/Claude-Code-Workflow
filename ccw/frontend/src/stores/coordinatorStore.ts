// ========================================
// Coordinator Store
// ========================================
// Zustand store for managing coordinator execution state and command chains

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ========== Types ==========

/**
 * Execution status of a coordinator
 */
export type CoordinatorStatus = 'idle' | 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * Node execution status within a command chain
 */
export type NodeExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Log level for coordinator logs
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

/**
 * Command node representing a step in the coordinator pipeline
 */
export interface CommandNode {
  id: string;
  name: string;
  description?: string;
  command: string;
  status: NodeExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
  output?: string;
  parentId?: string; // For hierarchical structure
  children?: CommandNode[];
}

/**
 * Log entry for coordinator execution
 */
export interface CoordinatorLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  nodeId?: string;
  source?: 'system' | 'node' | 'user';
}

/**
 * Question to be answered during coordinator execution
 */
export interface CoordinatorQuestion {
  id: string;
  nodeId: string;
  title: string;
  description?: string;
  type: 'text' | 'single' | 'multi' | 'yes_no';
  options?: string[];
  required: boolean;
  answer?: string | string[];
}

/**
 * Pipeline details fetched from backend
 */
export interface PipelineDetails {
  id: string;
  name: string;
  description?: string;
  nodes: CommandNode[];
  totalSteps: number;
  estimatedDuration?: number;
}

/**
 * Coordinator state
 */
export interface CoordinatorState {
  // Current execution
  currentExecutionId: string | null;
  status: CoordinatorStatus;
  startedAt?: string;
  completedAt?: string;
  totalElapsedMs: number;

  // Command chain
  commandChain: CommandNode[];
  currentNodeIndex: number;
  currentNode: CommandNode | null;

  // Pipeline details
  pipelineDetails: PipelineDetails | null;
  isPipelineLoaded: boolean;

  // Logs
  logs: CoordinatorLog[];
  maxLogs: number;

  // Interactive questions
  activeQuestion: CoordinatorQuestion | null;
  pendingQuestions: CoordinatorQuestion[];

  // Execution metadata
  metadata: Record<string, unknown>;

  // Error tracking
  lastError?: string;
  errorDetails?: unknown;

  // UI state
  isLogPanelExpanded: boolean;
  autoScrollLogs: boolean;

  // Actions
  startCoordinator: (executionId: string, taskDescription: string, parameters?: Record<string, unknown>) => Promise<void>;
  pauseCoordinator: () => Promise<void>;
  resumeCoordinator: () => Promise<void>;
  cancelCoordinator: (reason?: string) => Promise<void>;
  updateNodeStatus: (nodeId: string, status: NodeExecutionStatus, result?: unknown, error?: string) => void;
  submitAnswer: (questionId: string, answer: string | string[]) => Promise<void>;
  retryNode: (nodeId: string) => Promise<void>;
  skipNode: (nodeId: string) => Promise<void>;
  fetchPipelineDetails: (executionId: string) => Promise<void>;
  syncStateFromServer: () => Promise<void>;
  addLog: (message: string, level?: LogLevel, nodeId?: string, source?: 'system' | 'node' | 'user') => void;
  clearLogs: () => void;
  setActiveQuestion: (question: CoordinatorQuestion | null) => void;
  markExecutionComplete: (success: boolean, finalResult?: unknown) => void;
  setLogPanelExpanded: (expanded: boolean) => void;
  setAutoScrollLogs: (autoScroll: boolean) => void;
  reset: () => void;
}

// ========== Constants ==========

const MAX_LOGS = 1000;
const LOG_STORAGE_KEY = 'coordinator-storage';
const COORDINATOR_STORAGE_VERSION = 1;

// ========== Helper Functions ==========

/**
 * Generate unique ID for logs and questions
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Find node by ID in command chain (handles hierarchical structure)
 */
const findNodeById = (nodes: CommandNode[], nodeId: string): CommandNode | null => {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }
    if (node.children) {
      const found = findNodeById(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
};

// ========== Initial State ==========

const initialState: CoordinatorState = {
  currentExecutionId: null,
  status: 'idle',
  totalElapsedMs: 0,

  commandChain: [],
  currentNodeIndex: -1,
  currentNode: null,

  pipelineDetails: null,
  isPipelineLoaded: false,

  logs: [],
  maxLogs: MAX_LOGS,

  activeQuestion: null,
  pendingQuestions: [],

  metadata: {},

  isLogPanelExpanded: true,
  autoScrollLogs: true,

  // Actions are added in the create callback
  startCoordinator: async () => {},
  pauseCoordinator: async () => {},
  resumeCoordinator: async () => {},
  cancelCoordinator: async () => {},
  updateNodeStatus: () => {},
  submitAnswer: async () => {},
  retryNode: async () => {},
  skipNode: async () => {},
  fetchPipelineDetails: async () => {},
  syncStateFromServer: async () => {},
  addLog: () => {},
  clearLogs: () => {},
  setActiveQuestion: () => {},
  markExecutionComplete: () => {},
  setLogPanelExpanded: () => {},
  setAutoScrollLogs: () => {},
  reset: () => {},
};

// ========== Store ==========

/**
 * Coordinator store for managing orchestrator execution state
 *
 * @remarks
 * Uses Zustand with persist middleware to save execution metadata to localStorage.
 * The store manages command chains, logs, interactive questions, and execution status.
 *
 * @example
 * ```tsx
 * const { startCoordinator, status, logs } = useCoordinatorStore();
 * await startCoordinator('exec-123', 'Build and deploy application');
 * ```
 */
export const useCoordinatorStore = create<CoordinatorState>()(
  persist(
    devtools(
      (set, get) => ({
        ...initialState,

        // ========== Coordinator Lifecycle Actions ==========

        startCoordinator: async (
          executionId: string,
          taskDescription: string,
          parameters?: Record<string, unknown>
        ) => {
          set({
            currentExecutionId: executionId,
            status: 'initializing',
            startedAt: new Date().toISOString(),
            totalElapsedMs: 0,
            lastError: undefined,
            errorDetails: undefined,
            metadata: parameters || {},
          }, false, 'coordinator/startCoordinator');

          get().addLog(`Starting coordinator execution: ${taskDescription}`, 'info', undefined, 'system');

          try {
            // Fetch pipeline details from backend
            await get().fetchPipelineDetails(executionId);

            const state = get();
            set({
              status: 'running',
              currentNodeIndex: 0,
              currentNode: state.commandChain.length > 0 ? state.commandChain[0] : null,
            }, false, 'coordinator/startCoordinator-running');

            get().addLog('Coordinator running', 'success', undefined, 'system');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            set({
              status: 'failed',
              lastError: errorMessage,
              errorDetails: error,
            }, false, 'coordinator/startCoordinator-error');

            get().addLog(`Failed to start coordinator: ${errorMessage}`, 'error', undefined, 'system');
          }
        },

        pauseCoordinator: async () => {
          const state = get();
          if (state.status !== 'running') {
            get().addLog('Cannot pause - coordinator is not running', 'warn', undefined, 'system');
            return;
          }

          set({ status: 'paused' }, false, 'coordinator/pauseCoordinator');
          get().addLog('Coordinator paused', 'info', undefined, 'system');
        },

        resumeCoordinator: async () => {
          const state = get();
          if (state.status !== 'paused') {
            get().addLog('Cannot resume - coordinator is not paused', 'warn', undefined, 'system');
            return;
          }

          set({ status: 'running' }, false, 'coordinator/resumeCoordinator');
          get().addLog('Coordinator resumed', 'info', undefined, 'system');
        },

        cancelCoordinator: async (reason?: string) => {
          set({
            status: 'cancelled',
            completedAt: new Date().toISOString(),
          }, false, 'coordinator/cancelCoordinator');

          const message = reason ? `Coordinator cancelled: ${reason}` : 'Coordinator cancelled';
          get().addLog(message, 'warn', undefined, 'system');
        },

        // ========== Node Status Management ==========

        updateNodeStatus: (nodeId: string, status: NodeExecutionStatus, result?: unknown, error?: string) => {
          const state = get();
          const node = findNodeById(state.commandChain, nodeId);
          if (!node) {
            console.warn(`[CoordinatorStore] Node not found: ${nodeId}`);
            return;
          }

          // Create a deep copy of the command chain with updated node
          const updateNodeInTree = (nodes: CommandNode[]): CommandNode[] => {
            return nodes.map((n) => {
              if (n.id === nodeId) {
                const updated: CommandNode = { ...n, status };
                if (status === 'running') {
                  updated.startedAt = new Date().toISOString();
                } else if (status === 'completed') {
                  updated.completedAt = new Date().toISOString();
                  updated.result = result;
                } else if (status === 'failed') {
                  updated.completedAt = new Date().toISOString();
                  updated.error = error;
                } else if (status === 'skipped') {
                  updated.completedAt = new Date().toISOString();
                }
                return updated;
              }
              if (n.children && n.children.length > 0) {
                return { ...n, children: updateNodeInTree(n.children) };
              }
              return n;
            });
          };

          const updatedCommandChain = updateNodeInTree(state.commandChain);
          set({ commandChain: updatedCommandChain }, false, 'coordinator/updateNodeStatus');

          // Add logs after state update
          if (status === 'running') {
            get().addLog(`Node started: ${node.name}`, 'debug', nodeId, 'system');
          } else if (status === 'completed') {
            get().addLog(`Node completed: ${node.name}`, 'success', nodeId, 'system');
          } else if (status === 'failed') {
            get().addLog(`Node failed: ${node.name} - ${error || 'Unknown error'}`, 'error', nodeId, 'system');
          } else if (status === 'skipped') {
            get().addLog(`Node skipped: ${node.name}`, 'info', nodeId, 'system');
          }
        },

        // ========== Interactive Question Handling ==========

        submitAnswer: async (questionId: string, answer: string | string[]) => {
          const state = get();
          const question = state.activeQuestion || state.pendingQuestions.find((q) => q.id === questionId);

          if (!question) {
            get().addLog(`Question not found: ${questionId}`, 'warn', undefined, 'system');
            return;
          }

          // Update question with answer
          const updatedActiveQuestion =
            state.activeQuestion && state.activeQuestion.id === questionId
              ? { ...state.activeQuestion, answer }
              : state.activeQuestion;

          const updatedPendingQuestions = state.pendingQuestions.map((q) =>
            q.id === questionId ? { ...q, answer } : q
          );

          set(
            {
              activeQuestion: updatedActiveQuestion,
              pendingQuestions: updatedPendingQuestions,
            },
            false,
            'coordinator/submitAnswer'
          );

          get().addLog(
            `Answer submitted for question: ${question.title}`,
            'info',
            question.nodeId,
            'user'
          );

          // Clear active question
          set({ activeQuestion: null }, false, 'coordinator/submitAnswer-clear');
        },

        // ========== Node Control Actions ==========

        retryNode: async (nodeId: string) => {
          const state = get();
          const node = findNodeById(state.commandChain, nodeId);
          if (!node) {
            get().addLog(`Cannot retry - node not found: ${nodeId}`, 'warn', undefined, 'system');
            return;
          }

          get().addLog(`Retrying node: ${node.name}`, 'info', nodeId, 'system');

          // Recursively update node status to pending
          const resetNodeInTree = (nodes: CommandNode[]): CommandNode[] => {
            return nodes.map((n) => {
              if (n.id === nodeId) {
                return { ...n, status: 'pending', result: undefined, error: undefined };
              }
              if (n.children && n.children.length > 0) {
                return { ...n, children: resetNodeInTree(n.children) };
              }
              return n;
            });
          };

          const updatedCommandChain = resetNodeInTree(state.commandChain);
          set({ commandChain: updatedCommandChain }, false, 'coordinator/retryNode');
        },

        skipNode: async (nodeId: string) => {
          const state = get();
          const node = findNodeById(state.commandChain, nodeId);
          if (!node) {
            get().addLog(`Cannot skip - node not found: ${nodeId}`, 'warn', undefined, 'system');
            return;
          }

          get().addLog(`Skipping node: ${node.name}`, 'info', nodeId, 'system');

          // Recursively update node status to skipped
          const skipNodeInTree = (nodes: CommandNode[]): CommandNode[] => {
            return nodes.map((n) => {
              if (n.id === nodeId) {
                return { ...n, status: 'skipped', completedAt: new Date().toISOString() };
              }
              if (n.children && n.children.length > 0) {
                return { ...n, children: skipNodeInTree(n.children) };
              }
              return n;
            });
          };

          const updatedCommandChain = skipNodeInTree(state.commandChain);
          set({ commandChain: updatedCommandChain }, false, 'coordinator/skipNode');
        },

        // ========== Pipeline Details ==========

        fetchPipelineDetails: async (executionId: string) => {
          try {
            get().addLog('Fetching pipeline details', 'info', undefined, 'system');

            // Import API function dynamically to avoid circular deps
            const { fetchCoordinatorPipeline } = await import('../lib/api');

            const response = await fetchCoordinatorPipeline(executionId);

            if (!response.success || !response.data) {
              throw new Error('Failed to fetch pipeline details');
            }

            const apiData = response.data;

            // Transform API response to PipelineDetails
            const pipelineDetails: PipelineDetails = {
              id: apiData.id,
              name: apiData.name,
              description: apiData.description,
              nodes: apiData.nodes,
              totalSteps: apiData.totalSteps,
              estimatedDuration: apiData.estimatedDuration,
            };

            set({
              pipelineDetails,
              isPipelineLoaded: true,
              commandChain: apiData.nodes,
              status: apiData.status || get().status,
            }, false, 'coordinator/fetchPipelineDetails');

            // Load logs if available
            if (apiData.logs && apiData.logs.length > 0) {
              set({ logs: apiData.logs }, false, 'coordinator/fetchPipelineDetails-logs');
            }

            get().addLog('Pipeline details loaded', 'success', undefined, 'system');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            set({
              isPipelineLoaded: false,
              lastError: errorMessage,
            }, false, 'coordinator/fetchPipelineDetails-error');

            get().addLog(`Failed to fetch pipeline details: ${errorMessage}`, 'error', undefined, 'system');
            throw error;
          }
        },

        // ========== State Synchronization (for WebSocket reconnection) ==========

        syncStateFromServer: async () => {
          const state = get();

          // Only sync if we have an active execution
          if (!state.currentExecutionId) {
            get().addLog('No active execution to sync', 'debug', undefined, 'system');
            return;
          }

          try {
            get().addLog('Syncing state from server', 'info', undefined, 'system');

            // Fetch current execution state from server
            const { fetchExecutionState } = await import('../lib/api');
            const response = await fetchExecutionState(state.currentExecutionId);

            if (!response.success || !response.data) {
              throw new Error('Failed to sync execution state');
            }

            const serverState = response.data;

            // Update local state with server state
            set({
              status: serverState.status as CoordinatorStatus,
              totalElapsedMs: serverState.elapsedMs,
            }, false, 'coordinator/syncStateFromServer');

            // Fetch full pipeline details if status indicates running/paused
            if (serverState.status === 'running' || serverState.status === 'paused') {
              await get().fetchPipelineDetails(state.currentExecutionId);
            }

            get().addLog('State synchronized with server', 'success', undefined, 'system');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[CoordinatorStore] Failed to sync state:', error);
            get().addLog(`Failed to sync state from server: ${errorMessage}`, 'warn', undefined, 'system');
          }
        },

        addLog: (
          message: string,
          level: LogLevel = 'info',
          nodeId?: string,
          source: 'system' | 'node' | 'user' = 'system'
        ) => {
          const state = get();
          const log: CoordinatorLog = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            level,
            message,
            nodeId,
            source,
          };

          let updatedLogs = [...state.logs, log];

          // Keep only the last maxLogs entries
          if (updatedLogs.length > state.maxLogs) {
            updatedLogs = updatedLogs.slice(-state.maxLogs);
          }

          set({ logs: updatedLogs }, false, 'coordinator/addLog');
        },

        clearLogs: () => {
          set({ logs: [] }, false, 'coordinator/clearLogs');
        },

        // ========== Question Management ==========

        setActiveQuestion: (question: CoordinatorQuestion | null) => {
          const state = get();
          const updatedPendingQuestions =
            question && !state.pendingQuestions.find((q) => q.id === question.id)
              ? [...state.pendingQuestions, question]
              : state.pendingQuestions;

          set({
            activeQuestion: question,
            pendingQuestions: updatedPendingQuestions,
          }, false, 'coordinator/setActiveQuestion');
        },

        // ========== Execution Completion ==========

        markExecutionComplete: (success: boolean, finalResult?: unknown) => {
          const state = get();
          set({
            status: success ? 'completed' : 'failed',
            completedAt: new Date().toISOString(),
            metadata: { ...state.metadata, finalResult },
          }, false, 'coordinator/markExecutionComplete');

          const message = success
            ? 'Coordinator execution completed successfully'
            : 'Coordinator execution failed';
          get().addLog(message, success ? 'success' : 'error', undefined, 'system');
        },

        // ========== UI State ==========

        setLogPanelExpanded: (expanded: boolean) => {
          set({ isLogPanelExpanded: expanded }, false, 'coordinator/setLogPanelExpanded');
        },

        setAutoScrollLogs: (autoScroll: boolean) => {
          set({ autoScrollLogs: autoScroll }, false, 'coordinator/setAutoScrollLogs');
        },

        // ========== Reset ==========

        reset: () => {
          set({
            currentExecutionId: null,
            status: 'idle',
            startedAt: undefined,
            completedAt: undefined,
            totalElapsedMs: 0,
            commandChain: [],
            currentNodeIndex: -1,
            currentNode: null,
            pipelineDetails: null,
            isPipelineLoaded: false,
            logs: [],
            activeQuestion: null,
            pendingQuestions: [],
            metadata: {},
            lastError: undefined,
            errorDetails: undefined,
          }, false, 'coordinator/reset');

          get().addLog('Coordinator state reset', 'info', undefined, 'system');
        },
      }),
      { name: 'CoordinatorStore' }
    ),
    {
      name: LOG_STORAGE_KEY,
      version: COORDINATOR_STORAGE_VERSION,
      // Only persist metadata and basic pipeline info (not full nodes/logs)
      partialize: (state) => ({
        currentExecutionId: state.currentExecutionId,
        status: state.status,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        totalElapsedMs: state.totalElapsedMs,
        metadata: state.metadata,
        isLogPanelExpanded: state.isLogPanelExpanded,
        autoScrollLogs: state.autoScrollLogs,
        // Only persist basic pipeline info, not full nodes
        pipelineDetails: state.pipelineDetails ? {
          id: state.pipelineDetails.id,
          name: state.pipelineDetails.name,
          description: state.pipelineDetails.description,
          nodes: [], // Don't persist nodes - will be fetched from API
          totalSteps: state.pipelineDetails.totalSteps,
          estimatedDuration: state.pipelineDetails.estimatedDuration,
        } : null,
      }),
      // Rehydration callback to restore state on page load
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Check if we have an active execution that needs hydration
        const needsHydration =
          state.currentExecutionId &&
          (state.status === 'running' || state.status === 'paused' || state.status === 'initializing') &&
          (!state.pipelineDetails || state.pipelineDetails.nodes.length === 0);

        if (needsHydration && state.currentExecutionId) {
          // Log restoration
          state.addLog('Restoring coordinator state from localStorage', 'info', undefined, 'system');

          // Fetch full pipeline details from API
          state.fetchPipelineDetails(state.currentExecutionId).catch((error) => {
            console.error('[CoordinatorStore] Failed to hydrate pipeline details:', error);
            state.addLog('Failed to restore pipeline data - session may be incomplete', 'warn', undefined, 'system');
          });
        } else if (state.currentExecutionId) {
          // Just log that we restored the session
          state.addLog('Session state restored', 'info', undefined, 'system');
        }
      },
    }
  )
);

// ========== Helper Hooks ==========

/**
 * Hook to get coordinator actions
 * Useful for components that only need actions, not the full state
 */
export const useCoordinatorActions = () => {
  return useCoordinatorStore((state) => ({
    startCoordinator: state.startCoordinator,
    pauseCoordinator: state.pauseCoordinator,
    resumeCoordinator: state.resumeCoordinator,
    cancelCoordinator: state.cancelCoordinator,
    updateNodeStatus: state.updateNodeStatus,
    submitAnswer: state.submitAnswer,
    retryNode: state.retryNode,
    skipNode: state.skipNode,
    fetchPipelineDetails: state.fetchPipelineDetails,
    syncStateFromServer: state.syncStateFromServer,
    addLog: state.addLog,
    clearLogs: state.clearLogs,
    setActiveQuestion: state.setActiveQuestion,
    markExecutionComplete: state.markExecutionComplete,
    setLogPanelExpanded: state.setLogPanelExpanded,
    setAutoScrollLogs: state.setAutoScrollLogs,
    reset: state.reset,
  }));
};

// ========== Selectors ==========

/**
 * Select current execution status
 */
export const selectCoordinatorStatus = (state: CoordinatorState) => state.status;

/**
 * Select current execution ID
 */
export const selectCurrentExecutionId = (state: CoordinatorState) => state.currentExecutionId;

/**
 * Select all logs
 */
export const selectCoordinatorLogs = (state: CoordinatorState) => state.logs;

/**
 * Select active question
 */
export const selectActiveQuestion = (state: CoordinatorState) => state.activeQuestion;

/**
 * Select command chain
 */
export const selectCommandChain = (state: CoordinatorState) => state.commandChain;

/**
 * Select current node
 */
export const selectCurrentNode = (state: CoordinatorState) => state.currentNode;

/**
 * Select pipeline details
 */
export const selectPipelineDetails = (state: CoordinatorState) => state.pipelineDetails;

/**
 * Select is pipeline loaded
 */
export const selectIsPipelineLoaded = (state: CoordinatorState) => state.isPipelineLoaded;
