// ========================================
// Parallel Node Component
// ========================================
// Custom node for parallel execution with multiple branch outputs

import { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitMerge, Layers, Timer, AlertTriangle } from 'lucide-react';
import type { ParallelNodeData } from '@/types/flow';
import { NodeWrapper } from './NodeWrapper';
import { cn } from '@/lib/utils';

interface ParallelNodeProps {
  data: ParallelNodeData;
  selected?: boolean;
}

// Join mode configuration
const JOIN_MODE_CONFIG: Record<string, { label: string; color: string }> = {
  all: { label: 'Wait All', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  any: { label: 'Wait Any', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  none: { label: 'Fire & Forget', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
};

export const ParallelNode = memo(({ data, selected }: ParallelNodeProps) => {
  const joinMode = data.joinMode || 'all';
  const branchCount = Math.max(2, Math.min(data.branchCount || 2, 5)); // Clamp between 2-5
  const joinConfig = JOIN_MODE_CONFIG[joinMode] || JOIN_MODE_CONFIG.all;

  // Calculate branch handle positions
  const branchPositions = useMemo(() => {
    const positions: number[] = [];
    const step = 100 / (branchCount + 1);
    for (let i = 1; i <= branchCount; i++) {
      positions.push(step * i);
    }
    return positions;
  }, [branchCount]);

  return (
    <NodeWrapper
      status={data.executionStatus}
      selected={selected}
      accentColor="purple"
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-background"
      />

      {/* Node Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-t-md">
        <GitMerge className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium truncate flex-1">
          {data.label || 'Parallel'}
        </span>
        {/* Branch count indicator */}
        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
          {branchCount}x
        </span>
      </div>

      {/* Node Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Join mode badge */}
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', joinConfig.color)}>
            {joinConfig.label}
          </span>
        </div>

        {/* Additional settings row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Timeout indicator */}
          {data.timeout && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Timer className="w-3 h-3" />
              <span>{data.timeout}ms</span>
            </div>
          )}

          {/* Fail fast indicator */}
          {data.failFast && (
            <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              <span>Fail Fast</span>
            </div>
          )}
        </div>

        {/* Branch labels */}
        <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
          {branchPositions.map((_, index) => (
            <span key={index} className="text-purple-600 dark:text-purple-400">
              B{index + 1}
            </span>
          ))}
        </div>

        {/* Execution error message */}
        {data.executionStatus === 'failed' && data.executionError && (
          <div
            className="text-[10px] text-destructive truncate"
            title={data.executionError}
          >
            {data.executionError}
          </div>
        )}
      </div>

      {/* Dynamic Branch Output Handles */}
      {branchPositions.map((position, index) => (
        <Handle
          key={`branch-${index + 1}`}
          type="source"
          position={Position.Bottom}
          id={`branch-${index + 1}`}
          className="!w-3 !h-3 !bg-purple-500 !border-2 !border-background"
          style={{ left: `${position}%` }}
        />
      ))}
    </NodeWrapper>
  );
});

ParallelNode.displayName = 'ParallelNode';
