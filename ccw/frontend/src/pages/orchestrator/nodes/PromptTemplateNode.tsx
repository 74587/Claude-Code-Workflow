// ========================================
// Prompt Template Node Component
// ========================================
// Unified node component for all workflow steps
// Replaces: SlashCommandNode, CliCommandNode, PromptNode,
//           FileOperationNode, ConditionalNode, ParallelNode

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MessageSquare, Link2, Terminal } from 'lucide-react';
import type { PromptTemplateNodeData } from '@/types/flow';
import { NodeWrapper } from './NodeWrapper';
import { cn } from '@/lib/utils';

interface PromptTemplateNodeProps {
  data: PromptTemplateNodeData;
  selected?: boolean;
}

// Mode badge styling
const MODE_STYLES: Record<string, string> = {
  analysis: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  write: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  mainprocess: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  async: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

// Tool badge styling
const TOOL_STYLES: Record<string, string> = {
  gemini: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  qwen: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
  codex: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  claude: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
};

export const PromptTemplateNode = memo(({ data, selected }: PromptTemplateNodeProps) => {
  // Truncate instruction for display (max 50 chars)
  const displayInstruction = data.instruction
    ? data.instruction.length > 50
      ? data.instruction.slice(0, 47) + '...'
      : data.instruction
    : 'No instruction';

  const hasContextRefs = data.contextRefs && data.contextRefs.length > 0;

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
        <MessageSquare className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium truncate flex-1">
          {data.label || 'Step'}
        </span>
        {/* Mode badge in header */}
        {data.mode && (
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', MODE_STYLES[data.mode])}>
            {data.mode}
          </span>
        )}
      </div>

      {/* Node Content */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Slash command badge or instruction preview */}
        {data.slashCommand ? (
          <div
            className="flex items-center gap-1.5 font-mono text-xs bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-2 py-1 rounded truncate"
            title={`/${data.slashCommand}${data.slashArgs ? ' ' + data.slashArgs : ''}`}
          >
            <Terminal className="w-3 h-3 shrink-0" />
            <span className="truncate">/{data.slashCommand}</span>
          </div>
        ) : (
          <div
            className="font-mono text-xs bg-muted px-2 py-1 rounded text-foreground/90 truncate"
            title={data.instruction}
          >
            {displayInstruction}
          </div>
        )}

        {/* Tool and output badges row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Tool badge */}
          {data.tool && (
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', TOOL_STYLES[data.tool])}>
              {data.tool}
            </span>
          )}

          {/* Output name badge */}
          {data.outputName && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 truncate max-w-[80px]"
              title={data.outputName}
            >
              -&gt; {data.outputName}
            </span>
          )}
        </div>

        {/* Context refs indicator */}
        {hasContextRefs && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Link2 className="w-3 h-3" />
            <span>{data.contextRefs!.length} ref{data.contextRefs!.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Execution error message */}
        {data.executionStatus === 'failed' && data.executionError && (
          <div
            className="text-[10px] text-destructive truncate max-w-[160px]"
            title={data.executionError}
          >
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

PromptTemplateNode.displayName = 'PromptTemplateNode';
