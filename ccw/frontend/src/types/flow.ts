// ========================================
// Flow Types
// ========================================
// TypeScript interfaces for Orchestrator flow editor

import type { Node, Edge } from '@xyflow/react';

// ========== Node Types ==========

export type FlowNodeType = 'slash-command' | 'file-operation' | 'conditional' | 'parallel';

// Execution status for nodes during workflow execution
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

// Base interface for all node data - must have index signature for React Flow compatibility
interface BaseNodeData {
  label: string;
  executionStatus?: ExecutionStatus;
  executionError?: string;
  executionResult?: unknown;
  [key: string]: unknown;
}

// Slash Command Node Data
export interface SlashCommandNodeData extends BaseNodeData {
  command: string;
  args?: string;
  execution: {
    mode: 'analysis' | 'write';
    timeout?: number;
  };
  contextHint?: string;
  onError?: 'continue' | 'stop' | 'retry';
}

// File Operation Node Data
export interface FileOperationNodeData extends BaseNodeData {
  operation: 'read' | 'write' | 'append' | 'delete' | 'copy' | 'move';
  path: string;
  content?: string;
  destinationPath?: string;
  encoding?: 'utf8' | 'ascii' | 'base64';
  outputVariable?: string;
  addToContext?: boolean;
}

// Conditional Node Data
export interface ConditionalNodeData extends BaseNodeData {
  condition: string;
  trueLabel?: string;
  falseLabel?: string;
}

// Parallel Node Data
export interface ParallelNodeData extends BaseNodeData {
  joinMode: 'all' | 'any' | 'none';
  branchCount?: number; // Number of parallel branches (default: 2)
  timeout?: number;
  failFast?: boolean;
}

// Union type for all node data
export type NodeData =
  | SlashCommandNodeData
  | FileOperationNodeData
  | ConditionalNodeData
  | ParallelNodeData;

// Extended Node type for React Flow
export type FlowNode = Node<NodeData, FlowNodeType>;

// ========== Edge Types ==========

export interface FlowEdgeData {
  label?: string;
  condition?: string;
  [key: string]: unknown;
}

export type FlowEdge = Edge<FlowEdgeData>;

// ========== Flow Definition ==========

export interface FlowMetadata {
  source?: 'template' | 'custom' | 'imported';
  templateId?: string;
  tags?: string[];
  category?: string;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  version: number;
  created_at: string;
  updated_at: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: Record<string, unknown>;
  metadata: FlowMetadata;
}

// ========== Flow Store Types ==========

export interface FlowState {
  // Current flow
  currentFlow: Flow | null;
  isModified: boolean;

  // Nodes and edges (React Flow state)
  nodes: FlowNode[];
  edges: FlowEdge[];

  // Selection state
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  // Flow list
  flows: Flow[];
  isLoadingFlows: boolean;

  // UI state
  isPaletteOpen: boolean;
  isPropertyPanelOpen: boolean;
}

export interface FlowActions {
  // Flow CRUD
  setCurrentFlow: (flow: Flow | null) => void;
  createFlow: (name: string, description?: string) => Flow;
  saveFlow: () => Promise<boolean>;
  loadFlow: (id: string) => Promise<boolean>;
  deleteFlow: (id: string) => Promise<boolean>;
  duplicateFlow: (id: string) => Promise<Flow | null>;

  // Node operations
  addNode: (type: FlowNodeType, position: { x: number; y: number }) => string;
  updateNode: (id: string, data: Partial<NodeData>) => void;
  removeNode: (id: string) => void;
  setNodes: (nodes: FlowNode[]) => void;

  // Edge operations
  addEdge: (source: string, target: string, sourceHandle?: string, targetHandle?: string) => string;
  updateEdge: (id: string, data: Partial<FlowEdgeData>) => void;
  removeEdge: (id: string) => void;
  setEdges: (edges: FlowEdge[]) => void;

  // Selection
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;

  // Flow list
  fetchFlows: () => Promise<void>;

  // UI state
  setIsPaletteOpen: (open: boolean) => void;
  setIsPropertyPanelOpen: (open: boolean) => void;

  // Utility
  resetFlow: () => void;
  getSelectedNode: () => FlowNode | undefined;
  markModified: () => void;
}

export type FlowStore = FlowState & FlowActions;

// ========== Node Type Configuration ==========

export interface NodeTypeConfig {
  type: FlowNodeType;
  label: string;
  description: string;
  icon: string;
  color: string;
  defaultData: NodeData;
  handles: {
    inputs: number;
    outputs: number;
  };
}

export const NODE_TYPE_CONFIGS: Record<FlowNodeType, NodeTypeConfig> = {
  'slash-command': {
    type: 'slash-command',
    label: 'Slash Command',
    description: 'Execute CCW slash commands',
    icon: 'Terminal',
    color: 'bg-blue-500',
    defaultData: {
      label: 'New Command',
      command: '',
      args: '',
      execution: { mode: 'analysis' },
      onError: 'stop',
    } as SlashCommandNodeData,
    handles: { inputs: 1, outputs: 1 },
  },
  'file-operation': {
    type: 'file-operation',
    label: 'File Operation',
    description: 'Read/write/delete files',
    icon: 'FileText',
    color: 'bg-green-500',
    defaultData: {
      label: 'File Operation',
      operation: 'read',
      path: '',
      addToContext: false,
    } as FileOperationNodeData,
    handles: { inputs: 1, outputs: 1 },
  },
  conditional: {
    type: 'conditional',
    label: 'Conditional',
    description: 'Branch based on condition',
    icon: 'GitBranch',
    color: 'bg-amber-500',
    defaultData: {
      label: 'Condition',
      condition: '',
      trueLabel: 'True',
      falseLabel: 'False',
    } as ConditionalNodeData,
    handles: { inputs: 1, outputs: 2 },
  },
  parallel: {
    type: 'parallel',
    label: 'Parallel',
    description: 'Execute branches in parallel',
    icon: 'GitMerge',
    color: 'bg-purple-500',
    defaultData: {
      label: 'Parallel',
      joinMode: 'all',
      failFast: false,
    } as ParallelNodeData,
    handles: { inputs: 1, outputs: 2 },
  },
};
