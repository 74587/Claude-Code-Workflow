/**
 * Flow Execution Engine
 *
 * FlowExecutor: Executes flow definitions using DAG traversal with:
 * - Topological sorting for execution order
 * - NodeRunner for type-specific node execution
 * - Variable interpolation using {{variable}} syntax
 * - State persistence to status.json
 * - WebSocket broadcasts for real-time updates
 *
 * Integrates with:
 * - orchestrator-routes.ts for execution control endpoints
 * - websocket.ts for real-time broadcasts
 * - cli-executor for slash-command execution
 */

import { readFile, writeFile, mkdir, unlink, copyFile, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { broadcastToClients } from '../websocket.js';
import { executeCliTool } from '../../tools/cli-executor-core.js';
import type {
  Flow,
  FlowNode,
  FlowEdge,
  FlowNodeType,
  ExecutionState,
  ExecutionStatus,
  NodeExecutionState,
  NodeExecutionStatus,
  ExecutionLog,
  SlashCommandNodeData,
  FileOperationNodeData,
  ConditionalNodeData,
  ParallelNodeData,
} from '../routes/orchestrator-routes.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Execution context passed to node runners
 */
export interface ExecutionContext {
  executionId: string;
  flowId: string;
  workingDir: string;
  variables: Record<string, unknown>;
  nodeResults: Record<string, NodeResult>;
  fileContext: Array<{ path: string; content?: string; operation?: string }>;
}

/**
 * Result from executing a single node
 */
export interface NodeResult {
  success: boolean;
  output?: unknown;
  error?: string;
  branch?: 'true' | 'false';
  exitCode?: number;
}

/**
 * DAG adjacency list representation
 */
interface DAGNode {
  nodeId: string;
  node: FlowNode;
  incoming: string[];  // Dependencies (nodes that must run before this one)
  outgoing: string[];  // Dependents (nodes that run after this one)
}

/**
 * Options for FlowExecutor
 */
export interface FlowExecutorOptions {
  onNodeStarted?: (nodeId: string) => void;
  onNodeCompleted?: (nodeId: string, result: NodeResult) => void;
  onNodeFailed?: (nodeId: string, error: string) => void;
  onStateUpdate?: (state: ExecutionState) => void;
}

// ============================================================================
// Variable Interpolation
// ============================================================================

/**
 * Interpolate {{variable}} placeholders in a template string
 * Supports nested access: {{result.output}}, {{prevResult.exitCode}}
 *
 * @param template - String containing {{variable}} placeholders
 * @param variables - Object containing variable values
 * @returns Interpolated string with placeholders replaced
 */
export function interpolate(template: string, variables: Record<string, unknown>): string {
  if (!template || typeof template !== 'string') {
    return template;
  }

  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const trimmedPath = path.trim();
    const value = getNestedValue(variables, trimmedPath);

    if (value === undefined || value === null) {
      // Keep original placeholder if value not found
      return match;
    }

    // Convert to string
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

/**
 * Get nested value from object using dot notation
 * e.g., getNestedValue({a: {b: 1}}, 'a.b') returns 1
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Interpolate all string values in an object recursively
 */
export function interpolateObject<T>(obj: T, variables: Record<string, unknown>): T {
  if (typeof obj === 'string') {
    return interpolate(obj, variables) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => interpolateObject(item, variables)) as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = interpolateObject(value, variables);
    }
    return result as T;
  }

  return obj;
}

// ============================================================================
// NodeRunner - Type-specific Node Execution
// ============================================================================

/**
 * NodeRunner executes individual nodes based on their type
 */
export class NodeRunner {
  private context: ExecutionContext;

  constructor(context: ExecutionContext) {
    this.context = context;
  }

  /**
   * Execute a node and return the result
   */
  async run(node: FlowNode): Promise<NodeResult> {
    switch (node.type) {
      case 'slash-command':
        return this.runSlashCommand(node);
      case 'file-operation':
        return this.runFileOperation(node);
      case 'conditional':
        return this.runConditional(node);
      case 'parallel':
        return this.runParallel(node);
      default:
        return {
          success: false,
          error: `Unknown node type: ${(node as FlowNode).type}`
        };
    }
  }

  /**
   * Execute a slash-command node
   * Integrates with executeCliTool from cli-executor
   */
  private async runSlashCommand(node: FlowNode): Promise<NodeResult> {
    const data = node.data as SlashCommandNodeData;

    // Interpolate command and args
    const command = interpolate(data.command, this.context.variables);
    const args = data.args ? interpolate(data.args, this.context.variables) : '';
    const contextHint = data.contextHint ? interpolate(data.contextHint, this.context.variables) : '';

    // Build prompt: combine command, args, and context hint
    let prompt = command;
    if (args) {
      prompt += ` ${args}`;
    }
    if (contextHint) {
      prompt = `${contextHint}\n\n${prompt}`;
    }

    // Add file context if available
    if (this.context.fileContext.length > 0) {
      const fileContextStr = this.context.fileContext
        .filter(fc => fc.content)
        .map(fc => `=== File: ${fc.path} ===\n${fc.content}`)
        .join('\n\n');

      if (fileContextStr) {
        prompt = `${fileContextStr}\n\n${prompt}`;
      }
    }

    try {
      // Use claude tool for slash-command execution
      const result = await executeCliTool({
        tool: 'claude',
        prompt,
        mode: data.execution?.mode === 'mainprocess' ? 'write' : 'analysis',
        cd: this.context.workingDir
      });

      // Store output in variables for subsequent nodes
      const outputVar = `${node.id}_output`;
      this.context.variables[outputVar] = result.stdout;
      this.context.variables[`${node.id}_exitCode`] = result.execution?.exit_code ?? 0;

      return {
        success: result.success,
        output: result.stdout,
        exitCode: result.execution?.exit_code ?? 0
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Execute a file-operation node
   * Supports: read, write, append, delete, copy, move
   */
  private async runFileOperation(node: FlowNode): Promise<NodeResult> {
    const data = node.data as FileOperationNodeData;

    // Interpolate path and content
    const filePath = interpolate(data.path, this.context.variables);
    const resolvedPath = join(this.context.workingDir, filePath);
    const encoding = (data.encoding || 'utf-8') as BufferEncoding;

    try {
      switch (data.operation) {
        case 'read': {
          const content = await readFile(resolvedPath, encoding);

          // Store in output variable if specified
          if (data.outputVariable) {
            this.context.variables[data.outputVariable] = content;
          }

          // Add to file context for subsequent nodes
          if (data.addToContext) {
            this.context.fileContext.push({ path: filePath, content });
          }

          return { success: true, output: content };
        }

        case 'write': {
          const content = data.content ? interpolate(data.content, this.context.variables) : '';

          // Ensure directory exists
          const dir = dirname(resolvedPath);
          if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true });
          }

          await writeFile(resolvedPath, content, encoding);

          if (data.addToContext) {
            this.context.fileContext.push({ path: filePath, operation: 'written' });
          }

          return { success: true, output: { path: filePath, bytesWritten: content.length } };
        }

        case 'append': {
          const content = data.content ? interpolate(data.content, this.context.variables) : '';

          // Ensure directory exists
          const dir = dirname(resolvedPath);
          if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true });
          }

          // Read existing content and append
          let existingContent = '';
          if (existsSync(resolvedPath)) {
            existingContent = await readFile(resolvedPath, encoding);
          }
          await writeFile(resolvedPath, existingContent + content, encoding);

          if (data.addToContext) {
            this.context.fileContext.push({ path: filePath, operation: 'appended' });
          }

          return { success: true, output: { path: filePath, bytesAppended: content.length } };
        }

        case 'delete': {
          if (existsSync(resolvedPath)) {
            await unlink(resolvedPath);
          }
          return { success: true, output: { path: filePath, deleted: true } };
        }

        case 'copy': {
          const destPath = data.destinationPath
            ? join(this.context.workingDir, interpolate(data.destinationPath, this.context.variables))
            : resolvedPath + '.copy';

          // Ensure destination directory exists
          const destDir = dirname(destPath);
          if (!existsSync(destDir)) {
            await mkdir(destDir, { recursive: true });
          }

          await copyFile(resolvedPath, destPath);
          return { success: true, output: { source: filePath, destination: destPath } };
        }

        case 'move': {
          const destPath = data.destinationPath
            ? join(this.context.workingDir, interpolate(data.destinationPath, this.context.variables))
            : resolvedPath;

          if (destPath === resolvedPath) {
            return { success: false, error: 'Source and destination are the same' };
          }

          // Ensure destination directory exists
          const destDir = dirname(destPath);
          if (!existsSync(destDir)) {
            await mkdir(destDir, { recursive: true });
          }

          await rename(resolvedPath, destPath);
          return { success: true, output: { source: filePath, destination: destPath } };
        }

        default:
          return { success: false, error: `Unknown file operation: ${data.operation}` };
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Execute a conditional node
   * Evaluates condition and returns branch decision
   */
  private async runConditional(node: FlowNode): Promise<NodeResult> {
    const data = node.data as ConditionalNodeData;

    // Interpolate condition
    const condition = interpolate(data.condition, this.context.variables);

    try {
      // Evaluate condition in a safe context
      const result = this.evaluateCondition(condition);

      return {
        success: true,
        output: result,
        branch: result ? 'true' : 'false'
      };
    } catch (error) {
      return {
        success: false,
        error: `Condition evaluation failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Safely evaluate a condition expression
   * Uses Function constructor with limited scope
   */
  private evaluateCondition(condition: string): boolean {
    // Create a safe evaluation context with common comparison helpers
    const safeContext = {
      // Allow access to variables
      ...this.context.variables,
      // Add helper functions
      isEmpty: (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0),
      isNotEmpty: (v: unknown) => !(v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)),
      contains: (str: string, search: string) => String(str).includes(search),
      startsWith: (str: string, search: string) => String(str).startsWith(search),
      endsWith: (str: string, search: string) => String(str).endsWith(search),
    };

    // Build a safe evaluation function
    const keys = Object.keys(safeContext);
    const values = Object.values(safeContext);

    try {
      // Create function with explicit parameters to prevent scope leakage
      const evalFn = new Function(...keys, `return (${condition})`);
      const result = evalFn(...values);
      return Boolean(result);
    } catch (error) {
      // If direct evaluation fails, try simpler comparison
      // Handle common patterns like "value >= 0.95"
      const simpleMatch = condition.match(/^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/);
      if (simpleMatch) {
        const [, left, op, right] = simpleMatch;
        const leftVal = this.parseValue(left.trim());
        const rightVal = this.parseValue(right.trim());

        switch (op) {
          case '===': return leftVal === rightVal;
          case '!==': return leftVal !== rightVal;
          case '==': return leftVal == rightVal;
          case '!=': return leftVal != rightVal;
          case '>=': return Number(leftVal) >= Number(rightVal);
          case '<=': return Number(leftVal) <= Number(rightVal);
          case '>': return Number(leftVal) > Number(rightVal);
          case '<': return Number(leftVal) < Number(rightVal);
        }
      }

      throw error;
    }
  }

  /**
   * Parse a value from condition string
   */
  private parseValue(val: string): unknown {
    // Check for number
    if (/^-?\d+(\.\d+)?$/.test(val)) {
      return parseFloat(val);
    }
    // Check for boolean
    if (val === 'true') return true;
    if (val === 'false') return false;
    // Check for null/undefined
    if (val === 'null') return null;
    if (val === 'undefined') return undefined;
    // Check for quoted string
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      return val.slice(1, -1);
    }
    // Otherwise, try to get from context
    return this.context.variables[val] ?? val;
  }

  /**
   * Execute a parallel node
   * Forks execution into multiple branches
   */
  private async runParallel(node: FlowNode): Promise<NodeResult> {
    const data = node.data as ParallelNodeData;

    // Parallel node doesn't execute directly - it's a control flow marker
    // The FlowExecutor handles the actual parallel execution based on outgoing edges
    // This method returns success to indicate the fork point was reached

    return {
      success: true,
      output: {
        joinMode: data.joinMode,
        timeout: data.timeout,
        failFast: data.failFast
      }
    };
  }
}

// ============================================================================
// FlowExecutor - Main Execution Engine
// ============================================================================

/**
 * FlowExecutor orchestrates the execution of a flow definition
 * using DAG traversal with topological sorting
 */
export class FlowExecutor {
  private flow: Flow;
  private executionId: string;
  private workflowDir: string;
  private options: FlowExecutorOptions;
  private state: ExecutionState;
  private dag: Map<string, DAGNode>;
  private pauseRequested: boolean = false;
  private stopRequested: boolean = false;

  constructor(
    flow: Flow,
    executionId: string,
    workflowDir: string,
    options: FlowExecutorOptions = {}
  ) {
    this.flow = flow;
    this.executionId = executionId;
    this.workflowDir = workflowDir;
    this.options = options;
    this.dag = new Map();

    // Initialize execution state
    this.state = this.createInitialState();
  }

  /**
   * Create initial execution state
   */
  private createInitialState(): ExecutionState {
    const nodeStates: Record<string, NodeExecutionState> = {};
    for (const node of this.flow.nodes) {
      nodeStates[node.id] = { status: 'pending' };
    }

    return {
      id: this.executionId,
      flowId: this.flow.id,
      status: 'pending',
      variables: { ...this.flow.variables },
      nodeStates,
      logs: []
    };
  }

  /**
   * Build DAG from flow nodes and edges
   * Returns adjacency list representation
   */
  buildDAG(): Map<string, DAGNode> {
    this.dag.clear();

    // Initialize DAG nodes
    for (const node of this.flow.nodes) {
      this.dag.set(node.id, {
        nodeId: node.id,
        node,
        incoming: [],
        outgoing: []
      });
    }

    // Add edges
    for (const edge of this.flow.edges) {
      const sourceNode = this.dag.get(edge.source);
      const targetNode = this.dag.get(edge.target);

      if (sourceNode && targetNode) {
        sourceNode.outgoing.push(edge.target);
        targetNode.incoming.push(edge.source);
      }
    }

    return this.dag;
  }

  /**
   * Perform topological sort using Kahn's algorithm
   * Returns nodes in execution order
   */
  topologicalSort(): FlowNode[] {
    if (this.dag.size === 0) {
      this.buildDAG();
    }

    const sorted: FlowNode[] = [];
    const inDegree = new Map<string, number>();
    const queue: string[] = [];

    // Calculate in-degrees
    for (const [nodeId, dagNode] of this.dag) {
      inDegree.set(nodeId, dagNode.incoming.length);
      if (dagNode.incoming.length === 0) {
        queue.push(nodeId);
      }
    }

    // Process nodes with zero in-degree
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const dagNode = this.dag.get(nodeId);

      if (dagNode) {
        sorted.push(dagNode.node);

        // Reduce in-degree of dependents
        for (const dependentId of dagNode.outgoing) {
          const currentDegree = inDegree.get(dependentId) || 0;
          const newDegree = currentDegree - 1;
          inDegree.set(dependentId, newDegree);

          if (newDegree === 0) {
            queue.push(dependentId);
          }
        }
      }
    }

    // Check for cycles
    if (sorted.length !== this.flow.nodes.length) {
      this.addLog('error', 'Flow contains cycles - cannot execute');
      throw new Error('Flow contains cycles - cannot perform topological sort');
    }

    return sorted;
  }

  /**
   * Get nodes ready for execution (all dependencies completed)
   */
  private getReadyNodes(sortedNodes: FlowNode[]): FlowNode[] {
    const ready: FlowNode[] = [];

    for (const node of sortedNodes) {
      const nodeState = this.state.nodeStates[node.id];

      // Skip if already completed, failed, or skipped
      if (nodeState.status !== 'pending') {
        continue;
      }

      // Check if all dependencies are completed
      const dagNode = this.dag.get(node.id);
      if (!dagNode) continue;

      const allDepsCompleted = dagNode.incoming.every(depId => {
        const depState = this.state.nodeStates[depId];
        return depState && (depState.status === 'completed' || depState.status === 'skipped');
      });

      // For conditional branches, check if we should skip
      if (allDepsCompleted) {
        const shouldSkip = this.shouldSkipNode(node);
        if (shouldSkip) {
          nodeState.status = 'skipped';
          continue;
        }
        ready.push(node);
      }
    }

    return ready;
  }

  /**
   * Check if a node should be skipped based on conditional branching
   */
  private shouldSkipNode(node: FlowNode): boolean {
    const dagNode = this.dag.get(node.id);
    if (!dagNode) return false;

    // Check if this node is on a conditional branch that wasn't taken
    for (const depId of dagNode.incoming) {
      const depState = this.state.nodeStates[depId];
      const depNode = this.flow.nodes.find(n => n.id === depId);

      if (depNode?.type === 'conditional' && depState.status === 'completed') {
        const result = this.state.nodeStates[depId].result as NodeResult;
        const branch = result?.branch;

        // Find the edge from conditional to this node
        const edge = this.flow.edges.find(e => e.source === depId && e.target === node.id);
        if (edge) {
          // Check if edge label matches the branch taken
          const edgeLabel = edge.sourceHandle || edge.label || 'true';
          if (branch && edgeLabel !== branch) {
            return true;  // Skip this branch
          }
        }
      }
    }

    return false;
  }

  /**
   * Main execution method
   * Executes the flow and returns final state
   */
  async execute(initialVariables?: Record<string, unknown>): Promise<ExecutionState> {
    // Merge initial variables
    if (initialVariables) {
      this.state.variables = { ...this.state.variables, ...initialVariables };
    }

    // Build DAG and get execution order
    this.buildDAG();
    const sortedNodes = this.topologicalSort();

    // Start execution
    this.state.status = 'running';
    this.state.startedAt = new Date().toISOString();
    this.addLog('info', `Starting execution of flow: ${this.flow.name}`);
    await this.persistState();
    this.broadcastStateUpdate();

    // Create execution context
    const context: ExecutionContext = {
      executionId: this.executionId,
      flowId: this.flow.id,
      workingDir: this.workflowDir,
      variables: this.state.variables,
      nodeResults: {},
      fileContext: []
    };

    try {
      // Main execution loop
      while (true) {
        // Check for pause/stop requests
        if (this.stopRequested) {
          this.state.status = 'failed';
          this.addLog('warn', 'Execution stopped by user');
          break;
        }

        if (this.pauseRequested) {
          this.state.status = 'paused';
          this.addLog('info', 'Execution paused');
          await this.persistState();
          this.broadcastStateUpdate();
          return this.state;
        }

        // Get nodes ready for execution
        const readyNodes = this.getReadyNodes(sortedNodes);

        // If no ready nodes and not all completed, check for completion
        if (readyNodes.length === 0) {
          const allCompleted = Object.values(this.state.nodeStates).every(
            s => s.status === 'completed' || s.status === 'failed' || s.status === 'skipped'
          );

          if (allCompleted) {
            // Check if any nodes failed
            const anyFailed = Object.values(this.state.nodeStates).some(s => s.status === 'failed');
            this.state.status = anyFailed ? 'failed' : 'completed';
            break;
          }

          // Should not happen if DAG is valid
          throw new Error('Execution stuck: no ready nodes but not all completed');
        }

        // Execute ready nodes
        // For now, execute sequentially; parallel nodes handle their own forking
        for (const node of readyNodes) {
          if (this.stopRequested || this.pauseRequested) break;

          await this.executeNode(node, context);
        }
      }
    } catch (error) {
      this.state.status = 'failed';
      this.addLog('error', `Execution failed: ${(error as Error).message}`);
    }

    // Finalize
    this.state.completedAt = new Date().toISOString();
    this.addLog('info', `Execution ${this.state.status}: ${this.flow.name}`);
    await this.persistState();
    this.broadcastStateUpdate();

    return this.state;
  }

  /**
   * Execute a single node
   */
  private async executeNode(node: FlowNode, context: ExecutionContext): Promise<void> {
    const nodeState = this.state.nodeStates[node.id];
    const now = new Date().toISOString();

    // Update state to running
    nodeState.status = 'running';
    nodeState.startedAt = now;
    this.state.currentNodeId = node.id;
    await this.persistState();

    // Broadcast node started
    this.broadcastNodeStarted(node.id);
    this.options.onNodeStarted?.(node.id);
    this.addLog('info', `Starting node: ${node.id} (${node.type})`, node.id);

    try {
      // Create node runner with current context
      const runner = new NodeRunner(context);

      // Execute the node
      const result = await runner.run(node);

      // Handle parallel node specially
      if (node.type === 'parallel') {
        await this.executeParallelBranches(node, context);
      }

      // Update node state
      nodeState.status = result.success ? 'completed' : 'failed';
      nodeState.completedAt = new Date().toISOString();
      nodeState.result = result;

      if (!result.success && result.error) {
        nodeState.error = result.error;
      }

      // Store result in context
      context.nodeResults[node.id] = result;
      context.variables[`${node.id}_result`] = result;

      // Sync variables back to state
      this.state.variables = context.variables;

      await this.persistState();

      if (result.success) {
        this.broadcastNodeCompleted(node.id, result);
        this.options.onNodeCompleted?.(node.id, result);
        this.addLog('info', `Completed node: ${node.id}`, node.id);
      } else {
        // Handle error based on node's onError setting
        const nodeData = node.data as SlashCommandNodeData;
        const onError = nodeData.onError || 'fail';

        this.addLog('error', `Node failed: ${node.id} - ${result.error}`, node.id);
        this.broadcastNodeFailed(node.id, result.error || 'Unknown error');
        this.options.onNodeFailed?.(node.id, result.error || 'Unknown error');

        if (onError === 'fail') {
          throw new Error(`Node ${node.id} failed: ${result.error}`);
        } else if (onError === 'pause') {
          this.pauseRequested = true;
        }
        // 'continue' - just move on to next node
      }
    } catch (error) {
      nodeState.status = 'failed';
      nodeState.completedAt = new Date().toISOString();
      nodeState.error = (error as Error).message;

      await this.persistState();
      this.broadcastNodeFailed(node.id, (error as Error).message);
      this.options.onNodeFailed?.(node.id, (error as Error).message);

      throw error;
    }
  }

  /**
   * Execute parallel branches
   */
  private async executeParallelBranches(parallelNode: FlowNode, context: ExecutionContext): Promise<void> {
    const data = parallelNode.data as ParallelNodeData;
    const dagNode = this.dag.get(parallelNode.id);

    if (!dagNode) return;

    // Get branch starting nodes (direct outgoing edges from parallel node)
    const branchNodeIds = dagNode.outgoing;
    if (branchNodeIds.length === 0) return;

    this.addLog('info', `Executing ${branchNodeIds.length} parallel branches`, parallelNode.id);

    // Create promises for each branch
    const branchPromises = branchNodeIds.map(async (branchNodeId) => {
      const branchNode = this.flow.nodes.find(n => n.id === branchNodeId);
      if (!branchNode) return { success: false, error: 'Branch node not found' };

      try {
        await this.executeNode(branchNode, context);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Execute based on join mode
    const timeout = data.timeout || 300000; // Default 5 minutes

    try {
      if (data.joinMode === 'all') {
        // Wait for all branches to complete
        const results = await Promise.all(
          branchPromises.map(p =>
            Promise.race([
              p,
              new Promise<{ success: false; error: string }>((_, reject) =>
                setTimeout(() => reject(new Error('Branch timeout')), timeout)
              )
            ])
          )
        );

        // Check if any failed (and failFast is enabled)
        if (data.failFast) {
          const failed = results.find(r => !r.success);
          if (failed && 'error' in failed) {
            throw new Error(`Parallel branch failed: ${failed.error}`);
          }
        }
      } else if (data.joinMode === 'any') {
        // Wait for first branch to complete
        await Promise.race([
          Promise.race(branchPromises),
          new Promise((_, reject) => setTimeout(() => reject(new Error('All branches timeout')), timeout))
        ]);
      } else {
        // 'none' - fire and forget, don't wait
        // Just trigger the branches without awaiting
        for (const promise of branchPromises) {
          promise.catch(() => {}); // Suppress unhandled rejection
        }
      }
    } catch (error) {
      this.addLog('error', `Parallel execution failed: ${(error as Error).message}`, parallelNode.id);
      throw error;
    }
  }

  /**
   * Request pause (will pause at next safe point)
   */
  pause(): void {
    this.pauseRequested = true;
    this.addLog('info', 'Pause requested');
  }

  /**
   * Resume from paused state
   */
  async resume(additionalVariables?: Record<string, unknown>): Promise<ExecutionState> {
    if (this.state.status !== 'paused') {
      throw new Error('Cannot resume: execution is not paused');
    }

    this.pauseRequested = false;

    if (additionalVariables) {
      this.state.variables = { ...this.state.variables, ...additionalVariables };
    }

    // Continue execution
    return this.execute();
  }

  /**
   * Request stop (will stop at next safe point)
   */
  stop(): void {
    this.stopRequested = true;
    this.addLog('warn', 'Stop requested');
  }

  /**
   * Get current execution state
   */
  getState(): ExecutionState {
    return { ...this.state };
  }

  // ============================================================================
  // State Persistence
  // ============================================================================

  /**
   * Persist execution state to disk
   */
  private async persistState(): Promise<void> {
    const executionsDir = join(this.workflowDir, '.workflow', '.orchestrator', 'executions');
    const execDir = join(executionsDir, this.executionId);
    const statusPath = join(execDir, 'status.json');

    try {
      if (!existsSync(execDir)) {
        await mkdir(execDir, { recursive: true });
      }

      await writeFile(statusPath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (error) {
      console.error(`[FlowExecutor] Failed to persist state: ${(error as Error).message}`);
    }
  }

  // ============================================================================
  // WebSocket Broadcasts
  // ============================================================================

  /**
   * Broadcast state update
   */
  private broadcastStateUpdate(): void {
    try {
      broadcastToClients({
        type: 'ORCHESTRATOR_STATE_UPDATE',
        execId: this.executionId,
        status: this.state.status,
        currentNodeId: this.state.currentNodeId,
        timestamp: new Date().toISOString()
      });
      this.options.onStateUpdate?.(this.state);
    } catch (error) {
      // Ignore broadcast errors
    }
  }

  /**
   * Broadcast node started event
   */
  private broadcastNodeStarted(nodeId: string): void {
    try {
      broadcastToClients({
        type: 'ORCHESTRATOR_NODE_STARTED',
        execId: this.executionId,
        nodeId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Ignore broadcast errors
    }
  }

  /**
   * Broadcast node completed event
   */
  private broadcastNodeCompleted(nodeId: string, result: NodeResult): void {
    try {
      broadcastToClients({
        type: 'ORCHESTRATOR_NODE_COMPLETED',
        execId: this.executionId,
        nodeId,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Ignore broadcast errors
    }
  }

  /**
   * Broadcast node failed event
   */
  private broadcastNodeFailed(nodeId: string, error: string): void {
    try {
      broadcastToClients({
        type: 'ORCHESTRATOR_NODE_FAILED',
        execId: this.executionId,
        nodeId,
        error,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Ignore broadcast errors
    }
  }

  // ============================================================================
  // Logging
  // ============================================================================

  /**
   * Add log entry to execution state
   */
  private addLog(level: ExecutionLog['level'], message: string, nodeId?: string): void {
    const log: ExecutionLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(nodeId && { nodeId })
    };

    this.state.logs.push(log);

    // Also broadcast log entry
    try {
      broadcastToClients({
        type: 'ORCHESTRATOR_LOG',
        execId: this.executionId,
        log
      });
    } catch (error) {
      // Ignore broadcast errors
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create and execute a flow
 * Convenience function for simple execution scenarios
 */
export async function executeFlow(
  flow: Flow,
  executionId: string,
  workflowDir: string,
  options?: FlowExecutorOptions & { variables?: Record<string, unknown> }
): Promise<ExecutionState> {
  const { variables, ...executorOptions } = options || {};
  const executor = new FlowExecutor(flow, executionId, workflowDir, executorOptions);
  return executor.execute(variables);
}

/**
 * Load flow from storage and execute
 */
export async function executeFlowById(
  flowId: string,
  executionId: string,
  workflowDir: string,
  options?: FlowExecutorOptions & { variables?: Record<string, unknown> }
): Promise<ExecutionState> {
  const flowsDir = join(workflowDir, '.workflow', '.orchestrator', 'flows');
  const flowPath = join(flowsDir, `${flowId}.json`);

  if (!existsSync(flowPath)) {
    throw new Error(`Flow not found: ${flowId}`);
  }

  const content = await readFile(flowPath, 'utf-8');
  const flow = JSON.parse(content) as Flow;

  return executeFlow(flow, executionId, workflowDir, options);
}
