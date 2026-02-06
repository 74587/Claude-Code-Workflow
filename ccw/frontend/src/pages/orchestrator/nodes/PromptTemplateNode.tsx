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

// Phase color strip mapping
const PHASE_COLORS: Record<string, string> = {
  session: 'bg-sky-500',
  context: 'bg-cyan-500',
  plan: 'bg-amber-500',
  execute: 'bg-green-500',
  review: 'bg-purple-500',
};

// Phase-based node theme: header bg, handle color, accent for selection ring
const PHASE_THEME: Record<string, { header: string; handle: string; accent: string }> = {
  session: { header: 'bg-sky-500', handle: '!bg-sky-500', accent: 'sky' },
  context: { header: 'bg-cyan-500', handle: '!bg-cyan-500', accent: 'cyan' },
  plan: { header: 'bg-amber-500', handle: '!bg-amber-500', accent: 'amber' },
  execute: { header: 'bg-green-500', handle: '!bg-green-500', accent: 'green' },
  review: { header: 'bg-purple-500', handle: '!bg-purple-500', accent: 'purple' },
};

// nodeCategory-based fallback theme (when no phase set)
const CATEGORY_THEME: Record<string, { header: string; handle: string; accent: string }> = {
  tool: { header: 'bg-teal-500', handle: '!bg-teal-500', accent: 'teal' },
  command: { header: 'bg-blue-500', handle: '!bg-blue-500', accent: 'blue' },
};

const DEFAULT_THEME = { header: 'bg-blue-500', handle: '!bg-blue-500', accent: 'blue' };

// Execution status indicators
const STATUS_INDICATORS: Record<string, { color: string; label: string }> = {
  pending: { color: 'text-slate-400', label: 'Ready' },
  running: { color: 'text-amber-500', label: 'Running' },
  completed: { color: 'text-emerald-500', label: 'Done' },
  failed: { color: 'text-red-500', label: 'Failed' },
};

export const PromptTemplateNode = memo(({ data, selected }: PromptTemplateNodeProps) => {
  // Truncate instruction for display (max 50 chars)
  const displayInstruction = data.instruction
    ? data.instruction.length > 50
      ? data.instruction.slice(0, 47) + '...'
      : data.instruction
    : 'No instruction';

  const hasContextRefs = data.contextRefs && data.contextRefs.length > 0;
  const hasPhase = data.phase && PHASE_COLORS[data.phase];
  const statusInfo = data.executionStatus ? STATUS_INDICATORS[data.executionStatus] : null;
  const hasArtifacts = data.artifacts && data.artifacts.length > 0;
  const hasTags = data.tags && data.tags.length > 0;

  // Resolve node theme based on phase → nodeCategory → default
  const theme = (data.phase && PHASE_THEME[data.phase])
    || (data.nodeCategory && CATEGORY_THEME[data.nodeCategory])
    || DEFAULT_THEME;

  return (
    <NodeWrapper
      status={data.executionStatus}
      selected={selected}
      accentColor={theme.accent}
    >
      {/* Phase color strip + content layout */}
      <div className="flex">
        {/* Phase color strip (left border) */}
        {hasPhase && (
          <div className={cn('w-1 rounded-l-md flex-shrink-0', PHASE_COLORS[data.phase!])} />
        )}

        <div className="flex-1 min-w-0">
          {/* Input Handle */}
          <Handle
            type="target"
            position={Position.Top}
            className={cn('!w-3 !h-3 !border-2 !border-background', theme.handle)}
          />

          {/* Node Header */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 text-white',
            theme.header,
            hasPhase ? 'rounded-tr-md' : 'rounded-t-md'
          )}>
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium truncate flex-1">
              {data.label || 'Step'}
            </span>
            {/* Execution status indicator */}
            {statusInfo && (
              <span className={cn('flex items-center gap-1 text-[10px] font-medium', statusInfo.color)}>
                <span className={cn('inline-block w-1.5 h-1.5 rounded-full bg-current')} />
                {statusInfo.label}
              </span>
            )}
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

            {/* Tags display */}
            {hasTags && (
              <div className="flex items-center gap-1 flex-wrap">
                {data.tags!.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border"
                  >
                    {tag}
                  </span>
                ))}
                {data.tags!.length > 2 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{data.tags!.length - 2}
                  </span>
                )}
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

            {/* Artifacts display */}
            {hasArtifacts && (
              <div className="pt-0.5 border-t border-border/50 space-y-0.5">
                {data.artifacts!.map((artifact) => (
                  <div
                    key={artifact}
                    className="text-xs text-muted-foreground truncate"
                    title={artifact}
                  >
                    &rarr; {artifact}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Output Handle */}
          <Handle
            type="source"
            position={Position.Bottom}
            className={cn('!w-3 !h-3 !border-2 !border-background', theme.handle)}
          />
        </div>
      </div>
    </NodeWrapper>
  );
});

PromptTemplateNode.displayName = 'PromptTemplateNode';
