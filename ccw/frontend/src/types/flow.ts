// ========================================
// Flow Types
// ========================================
// TypeScript interfaces for Orchestrator flow editor
// Unified PromptTemplate model - all nodes are prompt templates
// See: .workflow/.analysis/ANL-前端编排器与skill设计简化分析-2026-02-04/conclusions.json

import type { Node, Edge } from '@xyflow/react';

// ========== Node Types ==========

/**
 * Single unified node type - all nodes are prompt templates
 * This replaces the previous 6-type system (slash-command, file-operation,
 * conditional, parallel, cli-command, prompt) with a single unified model.
 */
export type FlowNodeType = 'prompt-template';

/**
 * Execution status for nodes during workflow execution
 */
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Available CLI tools for execution
 */
export type CliTool = 'gemini' | 'qwen' | 'codex' | 'claude';

/**
 * Execution modes for prompt templates
 * - analysis: Read-only operations, code review, exploration
 * - write: Create/modify/delete files
 * - mainprocess: Execute in main process (blocking)
 * - async: Execute asynchronously (non-blocking)
 */
export type ExecutionMode = 'analysis' | 'write' | 'mainprocess' | 'async';

/**
 * Unified PromptTemplate node data model
 *
 * All workflow nodes are represented as prompt templates with natural language
 * instructions. This model replaces the previous 6 specialized node types:
 * - slash-command -> instruction: "Execute /command args"
 * - cli-command -> instruction + tool + mode
 * - file-operation -> instruction: "Save {{ref}} to path"
 * - conditional -> instruction: "If {{condition}} then..."
 * - parallel -> instruction: "Execute in parallel..."
 * - prompt -> instruction (direct)
 *
 * @example Slash command equivalent
 * { instruction: "Execute /workflow:plan for login feature", outputName: "plan", mode: "mainprocess" }
 *
 * @example CLI command equivalent
 * { instruction: "Analyze code architecture", outputName: "analysis", tool: "gemini", mode: "analysis" }
 *
 * @example File operation equivalent
 * { instruction: "Save {{analysis}} to ./output/result.json", contextRefs: ["analysis"] }
 *
 * @example Conditional equivalent
 * { instruction: "If {{prev.success}} is true, continue; otherwise stop", contextRefs: ["prev"] }
 */
export interface PromptTemplateNodeData {
  /**
   * Display label for the node in the editor
   */
  label: string;

  /**
   * Natural language instruction describing what to execute
   * Can include context references using {{variableName}} syntax
   */
  instruction: string;

  /**
   * Optional name for the output, allowing subsequent steps to reference it
   * via contextRefs or {{outputName}} syntax in instructions
   */
  outputName?: string;

  /**
   * Optional CLI tool to use for execution
   * If not specified, the system selects based on task requirements
   */
  tool?: CliTool;

  /**
   * Optional execution mode
   * Defaults to 'mainprocess' if not specified
   */
  mode?: ExecutionMode;

  /**
   * References to outputs from previous steps
   * Use the outputName values from earlier nodes
   */
  contextRefs?: string[];

  /**
   * Selected slash command name (e.g., "workflow:plan", "review-code")
   * When set, overrides instruction during execution.
   * Used when mode is 'mainprocess' or 'async'.
   */
  slashCommand?: string;

  /**
   * Arguments for the slash command
   * Supports {{variable}} interpolation syntax
   */
  slashArgs?: string;

  // ========== Execution State Fields ==========

  /**
   * Current execution status of this node
   */
  executionStatus?: ExecutionStatus;

  /**
   * Error message if execution failed
   */
  executionError?: string;

  /**
   * Result data from execution
   */
  executionResult?: unknown;

  /** Node description, more detailed than label */
  description?: string;

  /** Phase assignment for canvas grouping */
  phase?: 'session' | 'context' | 'plan' | 'execute' | 'review';

  /** Node classification for panel organization */
  nodeCategory?: 'phase' | 'tool' | 'command';

  /** Tag list for categorization and search */
  tags?: string[];

  /** Precondition expression */
  condition?: string;

  /** Artifact definition list */
  artifacts?: string[];

  /**
   * Index signature for React Flow compatibility
   */
  [key: string]: unknown;
}

/**
 * NodeData type - unified to single PromptTemplateNodeData
 * @deprecated Individual node data types are deprecated.
 * Use PromptTemplateNodeData directly.
 */
export type NodeData = PromptTemplateNodeData;

/**
 * Extended Node type for React Flow with unified PromptTemplate model
 */
export type FlowNode = Node<PromptTemplateNodeData, FlowNodeType>;

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
  leftPanelTab: 'templates' | 'nodes';
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
  addNode: (position: { x: number; y: number }) => string;
  addNodeFromTemplate: (templateId: string, position: { x: number; y: number }) => string;
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
  setLeftPanelTab: (tab: 'templates' | 'nodes') => void;

  // Utility
  resetFlow: () => void;
  getSelectedNode: () => FlowNode | undefined;
  markModified: () => void;
}

export type FlowStore = FlowState & FlowActions;

// ========== Node Type Configuration ==========

/**
 * Configuration for the unified prompt-template node type
 */
export interface NodeTypeConfig {
  type: FlowNodeType;
  label: string;
  description: string;
  icon: string;
  color: string;
  defaultData: PromptTemplateNodeData;
  handles: {
    inputs: number;
    outputs: number;
  };
}

/**
 * Single unified node type configuration
 * Replaces the previous 6 separate configurations
 */
export const NODE_TYPE_CONFIGS: Record<FlowNodeType, NodeTypeConfig> = {
  'prompt-template': {
    type: 'prompt-template',
    label: 'Prompt Template',
    description: 'Natural language instruction for workflow step',
    icon: 'MessageSquare',
    color: 'bg-blue-500',
    defaultData: {
      label: 'New Step',
      instruction: '',
      outputName: undefined,
      tool: undefined,
      mode: undefined,
      contextRefs: [],
    },
    handles: { inputs: 1, outputs: 1 },
  },
};

// ========== Quick Templates ==========

/**
 * Quick template definition for common prompt patterns
 */
export interface QuickTemplate {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  data: Partial<PromptTemplateNodeData>;
  /** Category for palette organization */
  category: 'phase' | 'tool' | 'command';
}

/**
 * Predefined quick templates for common workflow patterns
 * All use 'prompt-template' type with preset configurations
 */
export const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    id: 'slash-command-main',
    label: 'Slash Command',
    description: 'Execute /workflow commands (main thread)',
    icon: 'Terminal',
    color: 'bg-rose-500',
    category: 'command',
    data: {
      label: 'Slash Command',
      instruction: '',
      slashCommand: '',
      slashArgs: '',
      mode: 'mainprocess',
      nodeCategory: 'command',
    },
  },
  {
    id: 'slash-command-async',
    label: 'Slash Command (Async)',
    description: 'Execute /workflow commands (background)',
    icon: 'Terminal',
    color: 'bg-rose-400',
    category: 'command',
    data: {
      label: 'Slash Command (Async)',
      instruction: '',
      slashCommand: '',
      slashArgs: '',
      mode: 'async',
      nodeCategory: 'command',
    },
  },
  {
    id: 'analysis',
    label: 'Analysis',
    description: 'Code review, architecture analysis',
    icon: 'Search',
    color: 'bg-emerald-500',
    category: 'command',
    data: {
      label: 'Analyze',
      instruction: 'Analyze the code for:\n1. Architecture patterns\n2. Code quality\n3. Potential issues',
      tool: 'gemini',
      mode: 'analysis',
      nodeCategory: 'command',
    },
  },
  {
    id: 'implementation',
    label: 'Implementation',
    description: 'Write code, create files',
    icon: 'Code',
    color: 'bg-violet-500',
    category: 'command',
    data: {
      label: 'Implement',
      instruction: 'Implement the following:\n\n[Describe what to implement]',
      tool: 'codex',
      mode: 'write',
      nodeCategory: 'command',
    },
  },
  // ========== Phase Templates ==========
  {
    id: 'phase-session',
    label: 'Session',
    description: 'Initialize workflow session and environment',
    icon: 'FolderOpen',
    color: 'bg-sky-500',
    category: 'phase',
    data: {
      label: 'Session Setup',
      instruction: 'Initialize workflow session:\n- Set project context\n- Load configuration\n- Validate environment',
      phase: 'session',
      nodeCategory: 'phase',
      mode: 'mainprocess',
    },
  },
  {
    id: 'phase-context',
    label: 'Context',
    description: 'Collect and prepare context information',
    icon: 'Database',
    color: 'bg-cyan-500',
    category: 'phase',
    data: {
      label: 'Context Gathering',
      instruction: 'Gather context:\n- Analyze codebase structure\n- Identify relevant files\n- Build context package',
      phase: 'context',
      nodeCategory: 'phase',
      mode: 'analysis',
      tool: 'gemini',
      artifacts: ['context-package.json'],
    },
  },
  {
    id: 'phase-plan',
    label: 'Plan',
    description: 'Generate execution plan and task breakdown',
    icon: 'ListTodo',
    color: 'bg-amber-500',
    category: 'phase',
    data: {
      label: 'Planning',
      instruction: 'Create execution plan:\n- Break requirements into tasks\n- Identify dependencies\n- Evaluate complexity',
      phase: 'plan',
      nodeCategory: 'phase',
      mode: 'analysis',
      tool: 'gemini',
      artifacts: ['execution-plan.md'],
    },
  },
  {
    id: 'phase-execute',
    label: 'Execute',
    description: 'Execute tasks according to plan',
    icon: 'Play',
    color: 'bg-green-500',
    category: 'phase',
    data: {
      label: 'Execution',
      instruction: 'Execute planned tasks:\n- Follow dependency order\n- Apply code changes\n- Run validation',
      phase: 'execute',
      nodeCategory: 'phase',
      mode: 'write',
      tool: 'codex',
    },
  },
  {
    id: 'phase-review',
    label: 'Review',
    description: 'Review results and validate output',
    icon: 'CheckCircle',
    color: 'bg-purple-500',
    category: 'phase',
    data: {
      label: 'Review',
      instruction: 'Review execution results:\n- Validate code changes\n- Run tests\n- Check regressions',
      phase: 'review',
      nodeCategory: 'phase',
      mode: 'analysis',
      tool: 'gemini',
    },
  },
  // ========== Tool Templates ==========
  {
    id: 'tool-context-gather',
    label: 'Context Gather',
    description: 'Automated context collection tool',
    icon: 'FolderSearch',
    color: 'bg-teal-500',
    category: 'tool',
    data: {
      label: 'Context Gather',
      instruction: 'Collect project context:\n- Scan file structure\n- Identify key modules\n- Extract type definitions\n- Map dependencies',
      tool: 'gemini',
      mode: 'analysis',
      nodeCategory: 'tool',
      phase: 'context',
      outputName: 'context',
      artifacts: ['context-package.json'],
    },
  },
  {
    id: 'tool-conflict-resolution',
    label: 'Conflict Resolution',
    description: 'Resolve code conflicts and inconsistencies',
    icon: 'GitMerge',
    color: 'bg-orange-500',
    category: 'tool',
    data: {
      label: 'Conflict Resolution',
      instruction: 'Resolve conflicts:\n- Identify conflicting changes\n- Analyze intent of each side\n- Generate merge solution\n- Verify consistency',
      tool: 'gemini',
      mode: 'analysis',
      nodeCategory: 'tool',
      phase: 'execute',
      outputName: 'resolution',
    },
  },
  {
    id: 'tool-task-generate',
    label: 'Task Generate',
    description: 'Generate task breakdown from requirements',
    icon: 'ListChecks',
    color: 'bg-indigo-500',
    category: 'tool',
    data: {
      label: 'Task Generation',
      instruction: 'Generate tasks:\n- Parse requirements\n- Break into atomic tasks\n- Set dependencies\n- Assign priorities',
      tool: 'gemini',
      mode: 'analysis',
      nodeCategory: 'tool',
      phase: 'plan',
      outputName: 'tasks',
      artifacts: ['task-list.json'],
    },
  },
];
