// ========================================
// ExecutionTab Component
// ========================================
// Tab component for displaying CLI execution status

import { TabsTrigger } from '@/components/ui/Tabs';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CliExecutionState } from '@/stores/cliStreamStore';

export interface ExecutionTabProps {
  execution: CliExecutionState & { id: string };
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
}

export function ExecutionTab({ execution, isActive, onClick, onClose }: ExecutionTabProps) {
  // Simplify tool name (e.g., gemini-2.5-pro -> gemini)
  const toolNameShort = execution.tool.split('-')[0];

  // Status color mapping - using softer, semantic colors
  const statusColor = {
    running: 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.4)] animate-pulse',
    completed: 'bg-slate-400 dark:bg-slate-500',
    error: 'bg-rose-500',
  }[execution.status];

  return (
    <TabsTrigger
      value={execution.id}
      onClick={onClick}
      className={cn(
        'gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border/50 group',
        isActive
          ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 shadow-sm'
          : 'bg-muted/30 hover:bg-muted/50 border-border/30',
        'transition-all'
      )}
    >
      {/* Status indicator dot */}
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusColor)} />

      {/* Simplified tool name */}
      <span className="font-medium text-[11px]">{toolNameShort}</span>

      {/* Execution mode - show on hover */}
      <span className="opacity-0 group-hover:opacity-70 text-[10px] transition-opacity">
        {execution.mode}
      </span>

      {/* Line count statistics - show on hover */}
      <span className="opacity-0 group-hover:opacity-50 text-[9px] tabular-nums transition-opacity">
        {execution.output.length}
      </span>

      {/* Close button - show on hover */}
      <button
        onClick={onClose}
        className="ml-0.5 p-0.5 rounded hover:bg-rose-500/20 transition-opacity opacity-0 group-hover:opacity-100"
        aria-label="Close execution tab"
      >
        <X className="h-2.5 w-2.5 text-rose-600 dark:text-rose-400" />
      </button>
    </TabsTrigger>
  );
}

export default ExecutionTab;
