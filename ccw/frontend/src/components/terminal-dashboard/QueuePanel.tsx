// ========================================
// QueuePanel Component
// ========================================
// Queue list panel for the terminal dashboard middle column.
// Consumes existing useIssueQueue() React Query hook for queue data
// and bridges queueExecutionStore for execution status per item.
// Integrates with issueQueueIntegrationStore for association chain
// highlighting and selection state.

import { useMemo, useCallback } from 'react';
import { useIntl } from 'react-intl';
import {
  ListChecks,
  Loader2,
  AlertTriangle,
  ArrowDownToLine,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
  Ban,
  Terminal,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { useIssueQueue } from '@/hooks/useIssues';
import {
  useIssueQueueIntegrationStore,
  selectAssociationChain,
} from '@/stores/issueQueueIntegrationStore';
import {
  useQueueExecutionStore,
  selectByQueueItem,
} from '@/stores/queueExecutionStore';
import type { QueueItem } from '@/lib/api';

// ========== Status Config ==========

type QueueItemStatus = QueueItem['status'];

const STATUS_CONFIG: Record<QueueItemStatus, {
  variant: 'info' | 'success' | 'destructive' | 'secondary' | 'warning' | 'outline';
  icon: typeof Clock;
  label: string;
}> = {
  pending: { variant: 'secondary', icon: Clock, label: 'Pending' },
  ready: { variant: 'info', icon: Zap, label: 'Ready' },
  executing: { variant: 'warning', icon: Loader2, label: 'Executing' },
  completed: { variant: 'success', icon: CheckCircle, label: 'Completed' },
  failed: { variant: 'destructive', icon: XCircle, label: 'Failed' },
  blocked: { variant: 'outline', icon: Ban, label: 'Blocked' },
};

// ========== Queue Item Row ==========

function QueueItemRow({
  item,
  isHighlighted,
  onSelect,
}: {
  item: QueueItem;
  isHighlighted: boolean;
  onSelect: () => void;
}) {
  const { formatMessage } = useIntl();
  const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  // Bridge to queueExecutionStore for execution status
  const executions = useQueueExecutionStore(selectByQueueItem(item.item_id));
  const activeExec = executions.find((e) => e.status === 'running') ?? executions[0];

  return (
    <button
      type="button"
      className={cn(
        'w-full text-left px-3 py-2 rounded-md transition-colors',
        'hover:bg-muted/60 focus:outline-none focus:ring-1 focus:ring-primary/30',
        isHighlighted && 'bg-accent/50 ring-1 ring-accent/30'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon
            className={cn(
              'w-3.5 h-3.5 shrink-0',
              item.status === 'executing' && 'animate-spin'
            )}
          />
          <span className="text-sm font-medium text-foreground truncate font-mono">
            {item.item_id}
          </span>
        </div>
        <Badge variant={config.variant} className="text-[10px] px-1.5 py-0 shrink-0">
          {formatMessage({ id: `terminalDashboard.queuePanel.status.${item.status}` })}
        </Badge>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground pl-5">
        <span className="font-mono">{item.issue_id}</span>
        <span className="text-border">|</span>
        <span>
          {formatMessage(
            { id: 'terminalDashboard.queuePanel.order' },
            { order: item.execution_order }
          )}
        </span>
        <span className="text-border">|</span>
        <span>{item.execution_group}</span>
        {activeExec?.sessionKey && (
          <>
            <span className="text-border">|</span>
            <span className="flex items-center gap-0.5">
              <Terminal className="w-3 h-3" />
              {activeExec.sessionKey}
            </span>
          </>
        )}
      </div>
      {item.depends_on.length > 0 && (
        <div className="mt-0.5 text-[10px] text-muted-foreground/70 pl-5 truncate">
          {formatMessage(
            { id: 'terminalDashboard.queuePanel.dependsOn' },
            { deps: item.depends_on.join(', ') }
          )}
        </div>
      )}
    </button>
  );
}

// ========== Empty State ==========

function QueueEmptyState() {
  const { formatMessage } = useIntl();
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
      <div className="text-center">
        <ListChecks className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">{formatMessage({ id: 'terminalDashboard.queuePanel.noItems' })}</p>
        <p className="text-xs mt-1 opacity-70">
          {formatMessage({ id: 'terminalDashboard.queuePanel.noItemsDesc' })}
        </p>
      </div>
    </div>
  );
}

// ========== Error State ==========

function QueueErrorState({ error }: { error: Error }) {
  const { formatMessage } = useIntl();
  return (
    <div className="flex-1 flex items-center justify-center text-destructive p-4">
      <div className="text-center">
        <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-60" />
        <p className="text-sm">{formatMessage({ id: 'terminalDashboard.queuePanel.error' })}</p>
        <p className="text-xs mt-1 opacity-70">{error.message}</p>
      </div>
    </div>
  );
}

// ========== Main Component ==========

export function QueuePanel() {
  const { formatMessage } = useIntl();
  const queueQuery = useIssueQueue();
  const associationChain = useIssueQueueIntegrationStore(selectAssociationChain);
  const buildAssociationChain = useIssueQueueIntegrationStore((s) => s.buildAssociationChain);

  // Flatten all queue items from grouped_items
  const allItems = useMemo(() => {
    if (!queueQuery.data) return [];
    const grouped = queueQuery.data.grouped_items ?? {};
    const items: QueueItem[] = [];
    for (const group of Object.values(grouped)) {
      items.push(...group);
    }
    // Sort by execution_order
    items.sort((a, b) => a.execution_order - b.execution_order);
    return items;
  }, [queueQuery.data]);

  // Count active items (pending + ready + executing)
  const activeCount = useMemo(() => {
    return allItems.filter(
      (item) => item.status === 'pending' || item.status === 'ready' || item.status === 'executing'
    ).length;
  }, [allItems]);

  const handleSelect = useCallback(
    (queueItemId: string) => {
      buildAssociationChain(queueItemId, 'queue');
    },
    [buildAssociationChain]
  );

  // Loading state
  if (queueQuery.isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ListChecks className="w-4 h-4" />
            {formatMessage({ id: 'terminalDashboard.queuePanel.title' })}
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Error state
  if (queueQuery.error) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ListChecks className="w-4 h-4" />
            {formatMessage({ id: 'terminalDashboard.queuePanel.title' })}
          </h3>
        </div>
        <QueueErrorState error={queueQuery.error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with flow indicator */}
      <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ArrowDownToLine className="w-4 h-4 text-muted-foreground" />
          <ListChecks className="w-4 h-4" />
          {formatMessage({ id: 'terminalDashboard.queuePanel.title' })}
        </h3>
        {activeCount > 0 && (
          <Badge variant="info" className="text-[10px] px-1.5 py-0">
            {activeCount}
          </Badge>
        )}
      </div>

      {/* Queue Item List */}
      {allItems.length === 0 ? (
        <QueueEmptyState />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
          {allItems.map((item) => (
            <QueueItemRow
              key={item.item_id}
              item={item}
              isHighlighted={associationChain?.queueItemId === item.item_id}
              onSelect={() => handleSelect(item.item_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
