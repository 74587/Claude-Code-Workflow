// ========================================
// EmptyState Component
// ========================================
// Empty state display for CLI viewer

import { useIntl } from 'react-intl';
import { Terminal, Play, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface EmptyStateProps {
  className?: string;
}

// ========== Component ==========

/**
 * EmptyState - Displays when no CLI executions are active
 *
 * Features:
 * - Informative empty state message
 * - Quick start hints
 * - Dark theme compatible
 */
export function EmptyState({ className }: EmptyStateProps) {
  const { formatMessage } = useIntl();

  return (
    <div
      className={cn(
        'h-full flex flex-col items-center justify-center',
        'bg-card dark:bg-surface-900',
        'text-muted-foreground',
        className
      )}
    >
      <div className="flex flex-col items-center gap-6 max-w-md text-center p-8">
        {/* Icon */}
        <div className="relative">
          <Terminal className="h-16 w-16 opacity-20" />
          <div className="absolute -bottom-1 -right-1 bg-primary/10 rounded-full p-1.5">
            <Play className="h-4 w-4 text-primary" />
          </div>
        </div>

        {/* Title */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {formatMessage({
              id: 'cliViewer.emptyState.title',
              defaultMessage: 'CLI Viewer',
            })}
          </h3>
          <p className="text-sm">
            {formatMessage({
              id: 'cliViewer.emptyState.description',
              defaultMessage: 'Start a CLI execution to see the output here.',
            })}
          </p>
        </div>

        {/* Hints */}
        <div className="flex flex-col gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 shrink-0" />
            <span>
              {formatMessage({
                id: 'cliViewer.emptyState.hint1',
                defaultMessage: 'Use "ccw cli" command to start an execution',
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 shrink-0" />
            <span>
              {formatMessage({
                id: 'cliViewer.emptyState.hint2',
                defaultMessage: 'Active executions will appear as tabs',
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmptyState;
