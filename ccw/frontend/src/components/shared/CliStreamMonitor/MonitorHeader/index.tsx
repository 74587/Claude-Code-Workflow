// ========================================
// MonitorHeader Component
// ========================================
// Header component for CLI Stream Monitor

import { memo } from 'react';
import { useIntl } from 'react-intl';
import { X, Activity, ChevronDown, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface MonitorHeaderProps {
  /** Callback when close button is clicked */
  onClose: () => void;
  /** Number of active (running) executions */
  activeCount?: number;
  /** Total number of executions */
  totalCount?: number;
  /** Number of executions with errors */
  errorCount?: number;
  /** Current execution ID for popup navigation */
  currentExecutionId?: string;
}

/**
 * MonitorHeader - Header component for CLI Stream Monitor
 *
 * Displays:
 * - Left: Close button + title
 * - Right: Live status indicator + execution count badge
 */
export const MonitorHeader = memo(function MonitorHeader({
  onClose,
  activeCount = 0,
  totalCount = 0,
  errorCount = 0,
  currentExecutionId,
}: MonitorHeaderProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const hasActive = activeCount > 0;
  const hasErrors = errorCount > 0;

  const handlePopOut = () => {
    const url = currentExecutionId
      ? `/cli-viewer?executionId=${currentExecutionId}`
      : '/cli-viewer';
    navigate(url);
    onClose();
  };

  return (
    <header
      className={cn(
        // Layout
        'flex items-center justify-between',
        // Sizing
        'h-14 px-4',
        // Colors
        'bg-card dark:bg-surface-900',
        // Border
        'border-b border-border'
      )}
    >
      {/* Left side: Close button + Title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="shrink-0"
          aria-label="Close monitor"
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2 min-w-0">
          <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
          <h1 className="text-base font-semibold text-foreground truncate">
            {formatMessage({ id: 'cliMonitor.title' })}
          </h1>
        </div>
      </div>

      {/* Right side: Pop out + Status + Count badge */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Pop out to full page button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePopOut}
          className="h-8 w-8"
          title={formatMessage({ id: 'cliMonitor.popOutToPage' })}
          aria-label={formatMessage({ id: 'cliMonitor.openInViewer' })}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>

        {/* Live status indicator */}
        {hasActive && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  hasErrors
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-green-500 animate-pulse'
                )}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-foreground">
                {formatMessage({ id: 'cliMonitor.live' })}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        {/* Execution count badge */}
        {totalCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/50">
            <span className="text-xs text-muted-foreground">
              {formatMessage({ id: 'cliMonitor.executions' }, { count: totalCount })}
            </span>
            {activeCount > 0 && (
              <span className="text-xs font-medium text-foreground">
                {formatMessage({ id: 'cliMonitor.active' }, { count: activeCount })}
              </span>
            )}
          </div>
        )}
      </div>
    </header>
  );
});

export default MonitorHeader;
