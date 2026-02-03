// ========================================
// CLI Command Node Component
// ========================================
// Custom node for executing CLI tools with AI models

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Terminal } from 'lucide-react';
import type { CliCommandNodeData } from '@/types/flow';
import { NodeWrapper } from './NodeWrapper';
import { cn } from '@/lib/utils';

interface CliCommandNodeProps {
  data: CliCommandNodeData;
  selected?: boolean;
}

// Mode badge styling
const MODE_STYLES = {
  analysis: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  write: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  review: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

// Tool badge styling
const TOOL_STYLES = {
  gemini: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
  qwen: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800',
  codex: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 border border-purple-200 dark:border-purple-800',
};

export const CliCommandNode = memo(({ data, selected }: CliCommandNodeProps) => {
  const mode = data.mode || 'analysis';
  const tool = data.tool || 'gemini';

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
        <Terminal className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium truncate flex-1">
          {data.label || 'CLI Command'}
        </span>
        {/* Tool badge */}
        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/20', TOOL_STYLES[tool])}>
          {tool}
        </span>
      </div>

      {/* Node Content */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Command name */}
        {data.command && (
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
              ccw cli {data.command}
            </span>
          </div>
        )}

        {/* Arguments (truncated) */}
        {data.args && (
          <div className="text-xs text-muted-foreground truncate max-w-[160px]">
            <span className="text-foreground/70 font-mono">{data.args}</span>
          </div>
        )}

        {/* Mode badge */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Mode:</span>
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', MODE_STYLES[mode])}>
            {mode}
          </span>
        </div>

        {/* Output variable indicator */}
        {data.outputVariable && (
          <div className="text-[10px] text-muted-foreground">
            {'->'} {data.outputVariable}
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
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-background"
      />
    </NodeWrapper>
  );
});

CliCommandNode.displayName = 'CliCommandNode';
