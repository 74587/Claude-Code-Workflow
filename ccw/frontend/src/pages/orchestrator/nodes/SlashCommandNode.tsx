// ========================================
// Slash Command Node Component
// ========================================
// Custom node for executing CCW slash commands

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Terminal } from 'lucide-react';
import type { SlashCommandNodeData } from '@/types/flow';
import { NodeWrapper } from './NodeWrapper';
import { cn } from '@/lib/utils';

interface SlashCommandNodeProps {
  data: SlashCommandNodeData;
  selected?: boolean;
}

// Mode badge styling
const MODE_STYLES = {
  mainprocess: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  async: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export const SlashCommandNode = memo(({ data, selected }: SlashCommandNodeProps) => {
  const executionMode = data.execution?.mode || 'mainprocess';

  return (
    <NodeWrapper
      status={data.executionStatus}
      selected={selected}
      accentColor="blue"
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-background"
      />

      {/* Node Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-t-md">
        <Terminal className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium truncate flex-1">
          {data.label || 'Command'}
        </span>
        {/* Execution mode badge */}
        <span
          className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded',
            MODE_STYLES[executionMode]
          )}
        >
          {executionMode}
        </span>
      </div>

      {/* Node Content */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Command name */}
        {data.command && (
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
              /{data.command}
            </span>
          </div>
        )}

        {/* Arguments (truncated) */}
        {data.args && (
          <div className="text-xs text-muted-foreground truncate max-w-[160px]">
            <span className="text-foreground/70 font-mono">{data.args}</span>
          </div>
        )}

        {/* Error handling indicator */}
        {data.onError && data.onError !== 'stop' && (
          <div className="text-[10px] text-muted-foreground">
            On error: <span className="text-foreground">{data.onError}</span>
          </div>
        )}

        {/* Execution error message */}
        {data.executionStatus === 'failed' && data.executionError && (
          <div className="text-[10px] text-destructive truncate max-w-[160px]" title={data.executionError}>
            {data.executionError}
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-background"
      />
    </NodeWrapper>
  );
});

SlashCommandNode.displayName = 'SlashCommandNode';
