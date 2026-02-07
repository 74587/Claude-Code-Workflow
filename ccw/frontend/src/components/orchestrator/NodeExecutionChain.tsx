// ========================================
// Node Execution Chain Component
// ========================================
// Horizontal chain display of all nodes with execution status

import { Circle, Loader2, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FlowNode } from '@/types/flow';
import type { NodeExecutionState } from '@/types/execution';

interface NodeExecutionChainProps {
  /** All nodes in the flow */
  nodes: FlowNode[];
  /** Node execution states keyed by node ID */
  nodeStates: Record<string, NodeExecutionState>;
  /** Currently selected node ID */
  selectedNodeId: string | null;
  /** Callback when a node is clicked */
  onNodeSelect: (nodeId: string) => void;
}

/**
 * Get status icon for a node
 */
function getNodeStatusIcon(status?: NodeExecutionState['status']) {
  switch (status) {
    case 'pending':
      return <Circle className="w-3.5 h-3.5 text-muted-foreground" />;
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    default:
      return <Circle className="w-3.5 h-3.5 text-muted-foreground opacity-50" />;
  }
}

/**
 * Get node card styles based on execution state
 */
function getNodeCardStyles(
  state: NodeExecutionState | undefined,
  isSelected: boolean
): string {
  const baseStyles = cn(
    'px-3 py-2 rounded-lg border transition-all duration-200',
    'hover:bg-muted/50 hover:border-primary/50',
    'min-w-[140px] max-w-[180px]'
  );

  const stateStyles = cn(
    !state && 'border-border opacity-50',
    state?.status === 'running' &&
      'border-primary bg-primary/5 animate-pulse shadow-sm shadow-primary/20',
    state?.status === 'completed' &&
      'border-green-500/50 bg-green-500/5',
    state?.status === 'failed' &&
      'border-destructive bg-destructive/10',
    state?.status === 'pending' &&
      'border-muted-foreground/30'
  );

  const selectedStyles = isSelected
    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
    : '';

  return cn(baseStyles, stateStyles, selectedStyles);
}

/**
 * NodeExecutionChain displays a horizontal chain of all nodes
 *
 * Features:
 * - Nodes arranged horizontally with arrow connectors
 * - Visual status indicators (pending/running/completed/failed)
 * - Pulse animation for running nodes
 * - Click to select a node
 * - Selected node highlighting
 */
export function NodeExecutionChain({
  nodes,
  nodeStates,
  selectedNodeId,
  onNodeSelect,
}: NodeExecutionChainProps) {
  if (nodes.length === 0) {
    return (
      <div className="p-4 border-b border-border">
        <p className="text-sm text-muted-foreground text-center">
          No nodes in flow
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-border overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max">
        {nodes.map((node, index) => {
          const state = nodeStates[node.id];
          const isSelected = selectedNodeId === node.id;
          const nodeLabel = node.data.label || node.id;

          return (
            <div key={node.id} className="flex items-center gap-2">
              {/* Node card */}
              <button
                onClick={() => onNodeSelect(node.id)}
                className={getNodeCardStyles(state, isSelected)}
                type="button"
                aria-label={`Select node ${nodeLabel}`}
                aria-selected={isSelected}
              >
                <div className="flex items-center gap-2">
                  {/* Status icon */}
                  {getNodeStatusIcon(state?.status)}

                  {/* Node label */}
                  <span className="text-sm font-medium truncate">
                    {nodeLabel}
                  </span>
                </div>
              </button>

              {/* Connector arrow */}
              {index < nodes.length - 1 && (
                <ChevronRight
                  className={cn(
                    'w-4 h-4 flex-shrink-0',
                    'text-muted-foreground/50'
                  )}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

NodeExecutionChain.displayName = 'NodeExecutionChain';
