// ========================================
// Queue Page
// ========================================
// View and manage issue execution queues

import { useIntl } from 'react-intl';
import {
  ListTodo,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  GitMerge,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { QueueCard } from '@/components/issue/queue/QueueCard';
import { useIssueQueue, useQueueMutations } from '@/hooks';
import { cn } from '@/lib/utils';

// ========== Loading Skeleton ==========

function QueuePageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 bg-muted animate-pulse rounded w-48" />
          <div className="h-4 bg-muted animate-pulse rounded w-64" />
        </div>
        <div className="h-10 bg-muted animate-pulse rounded w-32" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <div className="h-6 bg-muted animate-pulse rounded w-16 mb-2" />
            <div className="h-4 bg-muted animate-pulse rounded w-24" />
          </Card>
        ))}
      </div>

      {/* Queue Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} className="p-4">
            <div className="h-6 bg-muted animate-pulse rounded w-32 mb-4" />
            <div className="h-4 bg-muted animate-pulse rounded w-full mb-2" />
            <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
          </Card>
        ))}
      </div>
    </div>
  );
}

// ========== Empty State ==========

function QueueEmptyState() {
  const { formatMessage } = useIntl();

  return (
    <Card className="p-12 text-center">
      <AlertCircle className="w-16 h-16 mx-auto text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-medium text-foreground">
        {formatMessage({ id: 'issues.queue.emptyState.title' })}
      </h3>
      <p className="mt-2 text-muted-foreground">
        {formatMessage({ id: 'issues.queue.emptyState.description' })}
      </p>
    </Card>
  );
}

// ========== Main Page Component ==========

export function QueuePage() {
  const { formatMessage } = useIntl();

  const { data: queueData, isLoading, isFetching, refetch, error } = useIssueQueue();
  const {
    activateQueue,
    deactivateQueue,
    deleteQueue,
    mergeQueues,
    isActivating,
    isDeactivating,
    isDeleting,
    isMerging,
  } = useQueueMutations();

  // Get queue data with proper type
  const queue = queueData;
  const taskCount = queue?.tasks?.length || 0;
  const solutionCount = queue?.solutions?.length || 0;
  const conflictCount = queue?.conflicts?.length || 0;
  const groupCount = Object.keys(queue?.grouped_items || {}).length;
  const totalItems = taskCount + solutionCount;

  const handleActivate = async (queueId: string) => {
    try {
      await activateQueue(queueId);
    } catch (err) {
      console.error('Failed to activate queue:', err);
    }
  };

  const handleDeactivate = async () => {
    try {
      await deactivateQueue();
    } catch (err) {
      console.error('Failed to deactivate queue:', err);
    }
  };

  const handleDelete = async (queueId: string) => {
    try {
      await deleteQueue(queueId);
    } catch (err) {
      console.error('Failed to delete queue:', err);
    }
  };

  const handleMerge = async (sourceId: string, targetId: string) => {
    try {
      await mergeQueues(sourceId, targetId);
    } catch (err) {
      console.error('Failed to merge queues:', err);
    }
  };

  if (isLoading) {
    return <QueuePageSkeleton />;
  }

  if (error) {
    return (
      <Card className="p-12 text-center">
        <AlertCircle className="w-16 h-16 mx-auto text-destructive/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">
          {formatMessage({ id: 'issues.queue.error.title' })}
        </h3>
        <p className="mt-2 text-muted-foreground">
          {(error as Error).message || formatMessage({ id: 'issues.queue.error.message' })}
        </p>
      </Card>
    );
  }

  if (!queue || totalItems === 0) {
    return <QueueEmptyState />;
  }

  // Check if queue is active (has items and no conflicts)
  const isActive = totalItems > 0 && conflictCount === 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-primary" />
            {formatMessage({ id: 'issues.queue.pageTitle' })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatMessage({ id: 'issues.queue.description' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', isFetching && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-info" />
            <span className="text-2xl font-bold">{totalItems}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'issues.queue.stats.totalItems' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-warning" />
            <span className="text-2xl font-bold">{groupCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'issues.queue.stats.groups' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" />
            <span className="text-2xl font-bold">{taskCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'issues.queue.stats.tasks' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            <span className="text-2xl font-bold">{solutionCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'issues.queue.stats.solutions' })}
          </p>
        </Card>
      </div>

      {/* Conflicts Warning */}
      {conflictCount > 0 && (
        <Card className="p-4 border-destructive/50 bg-destructive/5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-destructive">
                {formatMessage({ id: 'issues.queue.conflicts.title' })}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {conflictCount} {formatMessage({ id: 'issues.queue.conflicts.description' })}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Queue Card */}
      <div className="grid gap-4 md:grid-cols-2">
        <QueueCard
          key="current"
          queue={queue}
          isActive={isActive}
          onActivate={handleActivate}
          onDeactivate={handleDeactivate}
          onDelete={handleDelete}
          onMerge={handleMerge}
          isActivating={isActivating}
          isDeactivating={isDeactivating}
          isDeleting={isDeleting}
          isMerging={isMerging}
        />
      </div>

      {/* Status Footer */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isActive ? (
            <>
              <CheckCircle className="w-4 h-4 text-success" />
              {formatMessage({ id: 'issues.queue.status.ready' })}
            </>
          ) : (
            <>
              <Clock className="w-4 h-4 text-warning" />
              {formatMessage({ id: 'issues.queue.status.pending' })}
            </>
          )}
        </div>
        <Badge variant={isActive ? 'success' : 'secondary'} className="gap-1">
          {isActive ? (
            <CheckCircle className="w-3 h-3" />
          ) : (
            <Clock className="w-3 h-3" />
          )}
          {isActive
            ? formatMessage({ id: 'issues.queue.status.active' })
            : formatMessage({ id: 'issues.queue.status.inactive' })
          }
        </Badge>
      </div>
    </div>
  );
}

export default QueuePage;
