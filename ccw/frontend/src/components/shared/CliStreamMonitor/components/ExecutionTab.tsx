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

  // Status color mapping
  const statusColor = {
    running: 'bg-green-500 animate-pulse',
    completed: 'bg-blue-500',
    error: 'bg-red-500',
  }[execution.status];

  return (
    <TabsTrigger
      value={execution.id}
      onClick={onClick}
      className={cn(
        'gap-2 text-xs px-3 py-1.5',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted/50 hover:bg-muted/70',
        'transition-colors'
      )}
    >
      {/* Status indicator dot */}
      <span className={cn('w-2 h-2 rounded-full shrink-0', statusColor)} />

      {/* Simplified tool name */}
      <span className="font-medium">{toolNameShort}</span>

      {/* Execution mode */}
      <span className="opacity-70">{execution.mode}</span>

      {/* Line count statistics */}
      <span className="text-[10px] opacity-50 tabular-nums">
        {execution.output.length} lines
      </span>

      {/* Close button */}
      <button
        onClick={onClose}
        className="ml-1 p-0.5 rounded hover:bg-destructive/20 transition-colors"
        aria-label="Close execution tab"
      >
        <X className="h-3 w-3" />
      </button>
    </TabsTrigger>
  );
}

export default ExecutionTab;
