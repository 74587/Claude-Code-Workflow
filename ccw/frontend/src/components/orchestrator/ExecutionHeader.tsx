// ========================================
// Execution Header Component
// ========================================
// Displays execution overview with status badge, progress bar, duration, and current node

import { Clock, ArrowRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExecutionState } from '@/types/execution';
import type { NodeExecutionState } from '@/types/execution';

interface ExecutionHeaderProps {
  /** Current execution state */
  execution: ExecutionState | null;
  /** Node execution states keyed by node ID */
  nodeStates: Record<string, NodeExecutionState>;
}

/**
 * Status badge component showing execution status
 */
function StatusBadge({ status }: { status: ExecutionState['status'] }) {
  const config = {
    pending: {
      label: 'Pending',
      className: 'bg-muted text-muted-foreground border-border',
    },
    running: {
      label: 'Running',
      className: 'bg-primary/10 text-primary border-primary/50',
    },
    paused: {
      label: 'Paused',
      className: 'bg-amber-500/10 text-amber-500 border-amber-500/50',
    },
    completed: {
      label: 'Completed',
      className: 'bg-green-500/10 text-green-500 border-green-500/50',
    },
    failed: {
      label: 'Failed',
      className: 'bg-destructive/10 text-destructive border-destructive/50',
    },
  };

  const { label, className } = config[status];

  return (
    <span
      className={cn(
        'px-2.5 py-1 rounded-md text-xs font-medium border',
        className
      )}
    >
      {label}
    </span>
  );
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * ExecutionHeader component displays the execution overview
 *
 * Shows:
 * - Status badge (pending/running/completed/failed)
 * - Progress bar with completion percentage
 * - Elapsed time
 * - Current executing node (if any)
 * - Error message (if failed)
 */
export function ExecutionHeader({ execution, nodeStates }: ExecutionHeaderProps) {
  if (!execution) {
    return (
      <div className="p-4 border-b border-border">
        <p className="text-sm text-muted-foreground text-center">
          No execution in progress
        </p>
      </div>
    );
  }

  // Calculate progress
  const completedCount = Object.values(nodeStates).filter(
    (n) => n.status === 'completed'
  ).length;
  const totalCount = Object.keys(nodeStates).length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Get current node info
  const currentNodeState = execution.currentNodeId
    ? nodeStates[execution.currentNodeId]
    : null;

  return (
    <div className="p-4 border-b border-border space-y-3">
      {/* Status and Progress */}
      <div className="flex items-center gap-4">
        <StatusBadge status={execution.status} />

        {/* Progress bar */}
        <div className="flex-1">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300 ease-out',
                execution.status === 'failed' && 'bg-destructive',
                execution.status === 'completed' && 'bg-green-500',
                (execution.status === 'running' || execution.status === 'pending') &&
                  'bg-primary'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Completion count */}
        <span className="text-sm text-muted-foreground tabular-nums">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Details: Duration, Current Node, Error */}
      <div className="flex items-center gap-6 text-sm">
        {/* Elapsed time */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="tabular-nums">{formatDuration(execution.elapsedMs)}</span>
        </div>

        {/* Current node */}
        {currentNodeState && execution.status === 'running' && (
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Current:</span>
            <span className="font-medium">{execution.currentNodeId}</span>
          </div>
        )}

        {/* Error message */}
        {execution.status === 'failed' && (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span>Execution failed</span>
          </div>
        )}
      </div>
    </div>
  );
}

ExecutionHeader.displayName = 'ExecutionHeader';
