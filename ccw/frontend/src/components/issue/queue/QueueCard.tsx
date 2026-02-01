// ========================================
// QueueCard Component
// ========================================
// Card component for displaying queue information and actions

import { useIntl } from 'react-intl';
import { ListTodo, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ExecutionGroup } from './ExecutionGroup';
import { QueueActions } from './QueueActions';
import { cn } from '@/lib/utils';
import type { IssueQueue } from '@/lib/api';

// ========== Types ==========

export interface QueueCardProps {
  queue: IssueQueue;
  isActive?: boolean;
  onActivate?: (queueId: string) => void;
  onDeactivate?: () => void;
  onDelete?: (queueId: string) => void;
  onMerge?: (sourceId: string, targetId: string) => void;
  onSplit?: (sourceQueueId: string, itemIds: string[]) => void;
  onItemClick?: (item: import('@/lib/api').QueueItem) => void;
  isActivating?: boolean;
  isDeactivating?: boolean;
  isDeleting?: boolean;
  isMerging?: boolean;
  isSplitting?: boolean;
  className?: string;
}

// ========== Component ==========

export function QueueCard({
  queue,
  isActive = false,
  onActivate,
  onDeactivate,
  onDelete,
  onMerge,
  onSplit,
  onItemClick,
  isActivating = false,
  isDeactivating = false,
  isDeleting = false,
  isMerging = false,
  isSplitting = false,
  className,
}: QueueCardProps) {
  const { formatMessage } = useIntl();

  // Get queue ID - IssueQueue interface doesn't have an id field, using tasks array as key
  const queueId = (queue.tasks || []).join(',') || (queue.solutions || []).join(',') || 'unknown';

  // Calculate item counts
  const taskCount = queue.tasks?.length || 0;
  const solutionCount = queue.solutions?.length || 0;
  const conflictCount = queue.conflicts?.length || 0;
  const totalItems = taskCount + solutionCount;
  const groupCount = Object.keys(queue.grouped_items || {}).length;

  // Get execution groups from grouped_items
  const executionGroups = Object.entries(queue.grouped_items || {}).map(([name, items]) => ({
    id: name,
    type: name.toLowerCase().includes('parallel') ? 'parallel' as const : 'sequential' as const,
    items: items || [],
  }));

  return (
    <Card className={cn(
      "p-4 transition-all",
      isActive && "border-primary shadow-sm",
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={cn(
            "p-2 rounded-lg",
            isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            <ListTodo className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate">
              {formatMessage({ id: 'issues.queue.title' })}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {queueId.substring(0, 20)}{queueId.length > 20 ? '...' : ''}
            </p>
          </div>
        </div>

        {isActive && (
          <Badge variant="success" className="gap-1 shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            {formatMessage({ id: 'issues.queue.status.active' })}
          </Badge>
        )}

        <QueueActions
          queue={queue}
          isActive={isActive}
          onActivate={onActivate}
          onDeactivate={onDeactivate}
          onDelete={onDelete}
          onMerge={onMerge}
          onSplit={onSplit}
          isActivating={isActivating}
          isDeactivating={isDeactivating}
          isDeleting={isDeleting}
          isMerging={isMerging}
          isSplitting={isSplitting}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{formatMessage({ id: 'issues.queue.items' })}:</span>
          <span className="font-medium">{totalItems}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{formatMessage({ id: 'issues.queue.groups' })}:</span>
          <span className="font-medium">{groupCount}</span>
        </div>
      </div>

      {/* Conflicts Warning */}
      {conflictCount > 0 && (
        <div className="flex items-center gap-2 p-2 mb-4 bg-destructive/10 rounded-md">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-sm text-destructive">
            {conflictCount} {formatMessage({ id: 'issues.queue.conflicts' })}
          </span>
        </div>
      )}

      {/* Execution Groups */}
      {executionGroups.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            {formatMessage({ id: 'issues.queue.executionGroups' })}
          </p>
          <div className="space-y-2">
            {executionGroups.map((group) => (
              <ExecutionGroup
                key={group.id}
                group={group.id}
                items={group.items}
                type={group.type}
                onItemClick={onItemClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {executionGroups.length === 0 && totalItems === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{formatMessage({ id: 'issues.queue.empty' })}</p>
        </div>
      )}
    </Card>
  );
}

export default QueueCard;
