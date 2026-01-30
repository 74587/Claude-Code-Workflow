// ========================================
// Execution Types
// ========================================
// TypeScript interfaces for Orchestrator execution monitoring

import { z } from 'zod';

// ========== Execution Status ==========

export type ExecutionStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export type NodeExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

// ========== Log Types ==========

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface ExecutionLog {
  timestamp: string;
  level: LogLevel;
  nodeId?: string;
  message: string;
}

// ========== Node Execution State ==========

export interface NodeExecutionState {
  nodeId: string;
  status: NodeExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

// ========== Execution State ==========

export interface ExecutionState {
  execId: string;
  flowId: string;
  status: ExecutionStatus;
  currentNodeId?: string;
  startedAt: string;
  completedAt?: string;
  elapsedMs: number;
}

// ========== WebSocket Message Types ==========

// Server-side message type definitions (matching websocket.ts)
export interface OrchestratorStateUpdateMessage {
  type: 'ORCHESTRATOR_STATE_UPDATE';
  execId: string;
  status: ExecutionStatus;
  currentNodeId?: string;
  timestamp: string;
}

export interface OrchestratorNodeStartedMessage {
  type: 'ORCHESTRATOR_NODE_STARTED';
  execId: string;
  nodeId: string;
  timestamp: string;
}

export interface OrchestratorNodeCompletedMessage {
  type: 'ORCHESTRATOR_NODE_COMPLETED';
  execId: string;
  nodeId: string;
  result?: unknown;
  timestamp: string;
}

export interface OrchestratorNodeFailedMessage {
  type: 'ORCHESTRATOR_NODE_FAILED';
  execId: string;
  nodeId: string;
  error: string;
  timestamp: string;
}

export interface OrchestratorLogMessage {
  type: 'ORCHESTRATOR_LOG';
  execId: string;
  log: ExecutionLog;
  timestamp: string;
}

// Union type for all orchestrator WebSocket messages
export type OrchestratorWebSocketMessage =
  | OrchestratorStateUpdateMessage
  | OrchestratorNodeStartedMessage
  | OrchestratorNodeCompletedMessage
  | OrchestratorNodeFailedMessage
  | OrchestratorLogMessage;

// ========== Zod Schemas for WebSocket Validation ==========

const ExecutionStatusSchema = z.enum(['pending', 'running', 'paused', 'completed', 'failed']);

const ExecutionLogSchema = z.object({
  timestamp: z.string(),
  level: z.enum(['info', 'warn', 'error', 'debug']),
  nodeId: z.string().optional(),
  message: z.string(),
});

export const OrchestratorMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ORCHESTRATOR_STATE_UPDATE'),
    execId: z.string(),
    status: ExecutionStatusSchema,
    currentNodeId: z.string().optional(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('ORCHESTRATOR_NODE_STARTED'),
    execId: z.string(),
    nodeId: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('ORCHESTRATOR_NODE_COMPLETED'),
    execId: z.string(),
    nodeId: z.string(),
    result: z.unknown().optional(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('ORCHESTRATOR_NODE_FAILED'),
    execId: z.string(),
    nodeId: z.string(),
    error: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('ORCHESTRATOR_LOG'),
    execId: z.string(),
    log: ExecutionLogSchema,
    timestamp: z.string(),
  }),
]);

// ========== Execution Store Types ==========

export interface ExecutionStoreState {
  // Current execution
  currentExecution: ExecutionState | null;

  // Node execution states
  nodeStates: Record<string, NodeExecutionState>;

  // Execution logs
  logs: ExecutionLog[];
  maxLogs: number;

  // UI state
  isMonitorExpanded: boolean;
  autoScrollLogs: boolean;
}

export interface ExecutionStoreActions {
  // Execution lifecycle
  startExecution: (execId: string, flowId: string) => void;
  setExecutionStatus: (status: ExecutionStatus, currentNodeId?: string) => void;
  completeExecution: (status: 'completed' | 'failed') => void;
  clearExecution: () => void;

  // Node state updates
  setNodeStarted: (nodeId: string) => void;
  setNodeCompleted: (nodeId: string, result?: unknown) => void;
  setNodeFailed: (nodeId: string, error: string) => void;
  clearNodeStates: () => void;

  // Logs
  addLog: (log: ExecutionLog) => void;
  clearLogs: () => void;

  // UI state
  setMonitorExpanded: (expanded: boolean) => void;
  setAutoScrollLogs: (autoScroll: boolean) => void;
}

export type ExecutionStore = ExecutionStoreState & ExecutionStoreActions;

// ========== Template Types ==========

export interface FlowTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  preview?: string; // Base64 preview image or ASCII art
  author?: string;
  version: string;
  created_at: string;
  updated_at: string;
  nodeCount: number;
  edgeCount: number;
}

export interface TemplateInstallRequest {
  templateId: string;
  name?: string; // Optional custom name for the installed flow
}

export interface TemplateExportRequest {
  flowId: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
}
