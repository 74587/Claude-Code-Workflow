// ========================================
// Prompt Node Component
// ========================================
// Custom node for constructing AI prompts with context

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileText } from 'lucide-react';
import type { PromptNodeData } from '@/types/flow';
import { NodeWrapper } from './NodeWrapper';
import { cn } from '@/lib/utils';

interface PromptNodeProps {
  data: PromptNodeData;
  selected?: boolean;
}

// Prompt type badge styling
const PROMPT_TYPE_STYLES = {
  organize: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  refine: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  summarize: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  transform: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  custom: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

// Prompt type labels for display
const PROMPT_TYPE_LABELS: Record<PromptNodeData['promptType'], string> = {
  organize: 'Organize',
  refine: 'Refine',
  summarize: 'Summarize',
  transform: 'Transform',
  custom: 'Custom',
};

export const PromptNode = memo(({ data, selected }: PromptNodeProps) => {
  const promptType = data.promptType || 'custom';

  // Truncate prompt text for display
  const displayPrompt = data.promptText
    ? data.promptText.length > 40
      ? data.promptText.slice(0, 37) + '...'
      : data.promptText
    : 'No prompt';

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
        <FileText className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium truncate flex-1">
          {data.label || 'Prompt'}
        </span>
        {/* Prompt type badge */}
        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', PROMPT_TYPE_STYLES[promptType])}>
          {PROMPT_TYPE_LABELS[promptType]}
        </span>
      </div>

      {/* Node Content */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Prompt text preview */}
        <div
          className="font-mono text-xs bg-muted px-2 py-1 rounded text-foreground/90 truncate"
          title={data.promptText}
        >
          {displayPrompt}
        </div>

        {/* Source nodes count */}
        {data.sourceNodes && data.sourceNodes.length > 0 && (
          <div className="text-[10px] text-muted-foreground">
            Sources: {data.sourceNodes.length} node{data.sourceNodes.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Context template indicator */}
        {data.contextTemplate && (
          <div className="text-[10px] text-muted-foreground truncate max-w-[160px]" title={data.contextTemplate}>
            Template: {data.contextTemplate.slice(0, 20)}...
          </div>
        )}

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
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-background"
      />
    </NodeWrapper>
  );
});

PromptNode.displayName = 'PromptNode';
