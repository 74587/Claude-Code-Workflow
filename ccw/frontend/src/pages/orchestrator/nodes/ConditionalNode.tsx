// ========================================
// Conditional Node Component
// ========================================
// Custom node for conditional branching with true/false outputs

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch, Check, X } from 'lucide-react';
import type { ConditionalNodeData } from '@/types/flow';
import { NodeWrapper } from './NodeWrapper';

interface ConditionalNodeProps {
  data: ConditionalNodeData;
  selected?: boolean;
}

export const ConditionalNode = memo(({ data, selected }: ConditionalNodeProps) => {
  // Truncate condition for display
  const displayCondition = data.condition
    ? data.condition.length > 30
      ? data.condition.slice(0, 27) + '...'
      : data.condition
    : 'No condition';

  return (
    <NodeWrapper
      status={data.executionStatus}
      selected={selected}
      accentColor="amber"
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-background"
      />

      {/* Node Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-t-md">
        <GitBranch className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium truncate flex-1">
          {data.label || 'Condition'}
        </span>
      </div>

      {/* Node Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Condition expression */}
        <div
          className="font-mono text-xs bg-muted px-2 py-1 rounded text-foreground/90 truncate"
          title={data.condition}
        >
          {displayCondition}
        </div>

        {/* Branch labels */}
        <div className="flex justify-between items-center pt-1">
          <div className="flex items-center gap-1">
            <Check className="w-3 h-3 text-green-500" />
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
              {data.trueLabel || 'True'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <X className="w-3 h-3 text-red-500" />
            <span className="text-xs text-red-600 dark:text-red-400 font-medium">
              {data.falseLabel || 'False'}
            </span>
          </div>
        </div>

        {/* Execution result indicator */}
        {data.executionStatus === 'completed' && data.executionResult !== undefined && (
          <div className="text-[10px] text-muted-foreground text-center">
            Result:{' '}
            <span
              className={
                data.executionResult
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }
            >
              {data.executionResult ? 'true' : 'false'}
            </span>
          </div>
        )}

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

      {/* Output Handles (True and False) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-background"
        style={{ left: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-background"
        style={{ left: '70%' }}
      />
    </NodeWrapper>
  );
});

ConditionalNode.displayName = 'ConditionalNode';
