// ========================================
// Node Wrapper Component
// ========================================
// Shared wrapper for all custom nodes with execution status styling

import { ReactNode } from 'react';
import {
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { ExecutionStatus } from '@/types/flow';
import { cn } from '@/lib/utils';

interface NodeWrapperProps {
  children: ReactNode;
  status?: ExecutionStatus;
  selected?: boolean;
  accentColor: string;
  className?: string;
}

// Status styling configuration
const STATUS_STYLES: Record<ExecutionStatus, string> = {
  pending: 'border-muted bg-card',
  running: 'border-primary bg-primary/10 animate-pulse',
  completed: 'border-green-500 bg-green-500/10',
  failed: 'border-destructive bg-destructive/10',
};

// Selection ring styles per accent color
const SELECTION_STYLES: Record<string, string> = {
  blue: 'ring-2 ring-blue-500/20 border-blue-500',
  green: 'ring-2 ring-green-500/20 border-green-500',
  amber: 'ring-2 ring-amber-500/20 border-amber-500',
  purple: 'ring-2 ring-purple-500/20 border-purple-500',
  sky: 'ring-2 ring-sky-500/20 border-sky-500',
  cyan: 'ring-2 ring-cyan-500/20 border-cyan-500',
  teal: 'ring-2 ring-teal-500/20 border-teal-500',
  orange: 'ring-2 ring-orange-500/20 border-orange-500',
  indigo: 'ring-2 ring-indigo-500/20 border-indigo-500',
};

// Status icons
function StatusIcon({ status }: { status: ExecutionStatus }) {
  switch (status) {
    case 'pending':
      return <Circle className="w-3 h-3 text-muted-foreground" />;
    case 'running':
      return <Loader2 className="w-3 h-3 text-primary animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    case 'failed':
      return <XCircle className="w-3 h-3 text-destructive" />;
  }
}

export function NodeWrapper({
  children,
  status = 'pending',
  selected = false,
  accentColor,
  className,
}: NodeWrapperProps) {
  return (
    <div
      className={cn(
        'relative min-w-[180px] rounded-lg border-2 shadow-md transition-all',
        STATUS_STYLES[status],
        selected && SELECTION_STYLES[accentColor],
        className
      )}
    >
      {/* Status indicator */}
      <div className="absolute -top-2 -right-2 z-10 bg-background rounded-full p-0.5 shadow-sm border border-border">
        <StatusIcon status={status} />
      </div>

      {/* Node content (includes handles, header, body) */}
      {children}
    </div>
  );
}

NodeWrapper.displayName = 'NodeWrapper';
