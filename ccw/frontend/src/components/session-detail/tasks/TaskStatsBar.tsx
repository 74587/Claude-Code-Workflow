// ========================================
// TaskStatsBar Component
// ========================================
// Statistics bar with bulk action buttons for tasks

import { useIntl } from 'react-intl';
import { CheckCircle, Loader2, Circle } from 'lucide-react';
import { BulkActionButton } from './BulkActionButton';
import { cn } from '@/lib/utils';

export interface TaskStatsBarProps {
  completed: number;
  inProgress: number;
  pending: number;
  onMarkAllPending?: () => void | Promise<void>;
  onMarkAllInProgress?: () => void | Promise<void>;
  onMarkAllCompleted?: () => void | Promise<void>;
  isLoadingPending?: boolean;
  isLoadingInProgress?: boolean;
  isLoadingCompleted?: boolean;
  className?: string;
}

/**
 * TaskStatsBar component - Display task statistics with bulk action buttons
 */
export function TaskStatsBar({
  completed,
  inProgress,
  pending,
  onMarkAllPending,
  onMarkAllInProgress,
  onMarkAllCompleted,
  isLoadingPending = false,
  isLoadingInProgress = false,
  isLoadingCompleted = false,
  className = '',
}: TaskStatsBarProps) {
  const { formatMessage } = useIntl();

  return (
    <div className={cn('flex flex-wrap items-center gap-4 p-4 bg-background rounded-lg border', className)}>
      {/* Statistics */}
      <div className="flex flex-wrap items-center gap-4 flex-1">
        <span className="flex items-center gap-1.5 text-sm">
          <CheckCircle className="h-4 w-4 text-success" />
          <strong>{completed}</strong> {formatMessage({ id: 'sessionDetail.tasks.completed' })}
        </span>
        <span className="flex items-center gap-1.5 text-sm">
          <Loader2 className="h-4 w-4 text-warning" />
          <strong>{inProgress}</strong> {formatMessage({ id: 'sessionDetail.tasks.inProgress' })}
        </span>
        <span className="flex items-center gap-1.5 text-sm">
          <Circle className="h-4 w-4 text-muted-foreground" />
          <strong>{pending}</strong> {formatMessage({ id: 'sessionDetail.tasks.pending' })}
        </span>
      </div>

      {/* Bulk Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {onMarkAllPending && (
          <BulkActionButton
            icon={Circle}
            label={formatMessage({ id: 'sessionDetail.tasks.quickActions.markAllPending' })}
            onClick={onMarkAllPending}
            isLoading={isLoadingPending}
            disabled={pending === 0}
            variant="outline"
          />
        )}
        {onMarkAllInProgress && (
          <BulkActionButton
            icon={Loader2}
            label={formatMessage({ id: 'sessionDetail.tasks.quickActions.markAllInProgress' })}
            onClick={onMarkAllInProgress}
            isLoading={isLoadingInProgress}
            disabled={inProgress === 0}
            variant="outline"
          />
        )}
        {onMarkAllCompleted && (
          <BulkActionButton
            icon={CheckCircle}
            label={formatMessage({ id: 'sessionDetail.tasks.quickActions.markAllCompleted' })}
            onClick={onMarkAllCompleted}
            isLoading={isLoadingCompleted}
            disabled={completed === 0}
            variant="outline"
          />
        )}
      </div>
    </div>
  );
}
