// ========================================
// Tool Call Types
// ========================================
// TypeScript interfaces for tool call execution tracking

import type { CliOutputLine } from '../stores/cliStreamStore';

// ========== Tool Call Status ==========

/**
 * Status of a tool call execution
 */
export type ToolCallStatus = 'pending' | 'executing' | 'success' | 'error' | 'canceled';

// ========== Tool Call Kind ==========

/**
 * Kind/category of tool being called
 */
export type ToolCallKind =
  | 'execute'           // Command execution (e.g., exec_command)
  | 'patch'             // File patch operations (e.g., apply_patch)
  | 'thinking'          // Thinking/reasoning process
  | 'web_search'        // Web search operations
  | 'mcp_tool'          // MCP tool calls
  | 'file_operation';   // File operations (read, write, etc.)

// ========== Tool Call Execution ==========

/**
 * Output buffer for a tool call
 */
export interface ToolCallOutputBuffer {
  stdout: string;
  stderr: string;
  combined: string;
}

/**
 * Tool call execution state
 */
export interface ToolCallExecution {
  /** Unique identifier for this tool call */
  callId: string;

  /** Node ID this tool call belongs to */
  nodeId: string;

  /** Current status of the tool call */
  status: ToolCallStatus;

  /** Kind of tool being called */
  kind: ToolCallKind;

  /** Optional subtype (e.g., 'exec_command_begin', 'mcp_tool_call_begin') */
  subtype?: string;

  /** Human-readable description of the tool call */
  description: string;

  /** Start timestamp (ms since epoch) */
  startTime: number;

  /** End timestamp (ms since epoch) */
  endTime?: number;

  /** Calculated duration in milliseconds */
  duration?: number;

  /** Output lines captured during execution */
  outputLines: CliOutputLine[];

  /** Buffered output by stream type */
  outputBuffer: ToolCallOutputBuffer;

  /** Exit code for command executions */
  exitCode?: number;

  /** Error message if status is 'error' */
  error?: string;

  /** Final result data */
  result?: unknown;

  /** UI state: whether the call details are expanded */
  isExpanded?: boolean;
}

// ========== Tool Call Action Data ==========

/**
 * Data required to start a new tool call
 */
export interface ToolCallStartData {
  /** Kind of tool being called */
  kind: ToolCallKind;

  /** Optional subtype for more specific classification */
  subtype?: string;

  /** Human-readable description */
  description: string;
}

/**
 * Update data for a running tool call
 */
export interface ToolCallUpdate {
  /** Optional status update */
  status?: ToolCallStatus;

  /** Output chunk to append */
  outputChunk?: string;

  /** Which stream the chunk belongs to */
  stream?: 'stdout' | 'stderr';

  /** Output line to add (structured) */
  outputLine?: CliOutputLine;
}

/**
 * Result data for completing a tool call
 */
export interface ToolCallResult {
  /** Final status */
  status: ToolCallStatus;

  /** Exit code for command executions */
  exitCode?: number;

  /** Error message if failed */
  error?: string;

  /** Final result data */
  result?: unknown;
}

// ========== Tool Call Helpers ==========

/**
 * Default output buffer
 */
export const DEFAULT_OUTPUT_BUFFER: ToolCallOutputBuffer = {
  stdout: '',
  stderr: '',
  combined: '',
};

/**
 * Create a new tool call execution
 */
export function createToolCallExecution(
  callId: string,
  nodeId: string,
  data: ToolCallStartData
): ToolCallExecution {
  return {
    callId,
    nodeId,
    status: 'executing',
    kind: data.kind,
    subtype: data.subtype,
    description: data.description,
    startTime: Date.now(),
    outputLines: [],
    outputBuffer: { ...DEFAULT_OUTPUT_BUFFER },
  };
}

/**
 * Get tool call status icon class
 */
export function getToolCallStatusIconClass(status: ToolCallStatus): string {
  switch (status) {
    case 'pending':
      return 'text-muted-foreground';
    case 'executing':
      return 'text-primary animate-pulse';
    case 'success':
      return 'text-green-500';
    case 'error':
      return 'text-destructive';
    case 'canceled':
      return 'text-muted-foreground line-through';
  }
}

/**
 * Get tool call kind label
 */
export function getToolCallKindLabel(kind: ToolCallKind): string {
  switch (kind) {
    case 'execute':
      return 'Execute';
    case 'patch':
      return 'Patch';
    case 'thinking':
      return 'Thinking';
    case 'web_search':
      return 'Web Search';
    case 'mcp_tool':
      return 'MCP Tool';
    case 'file_operation':
      return 'File Operation';
  }
}
