// ========================================
// GlobalKpiBar Component
// ========================================
// Top bar showing 3 KPI metrics spanning the full page width.
// Metrics:
//   1. Active Sessions - count from sessionManagerStore (wraps cliSessionStore)
//   2. Queue Size - pending/ready items count from useIssueQueue React Query hook
//   3. Alert Count - total alerts from all terminalMetas
//
// Per design spec (V-001): consumes sessionManagerStore, NOT cliSessionStore directly.

import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Activity, ListChecks, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useSessionManagerStore,
  selectGroups,
  selectTerminalMetas,
} from '@/stores/sessionManagerStore';
import { useIssueQueue } from '@/hooks/useIssues';
import type { TerminalStatus } from '@/types/terminal-dashboard';

// ========== KPI Item ==========

function KpiItem({
  icon: Icon,
  label,
  value,
  variant = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  variant?: 'default' | 'primary' | 'warning' | 'destructive';
}) {
  const variantStyles = {
    default: 'text-muted-foreground',
    primary: 'text-primary',
    warning: 'text-warning',
    destructive: 'text-destructive',
  };

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('w-4 h-4', variantStyles[variant])} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-semibold tabular-nums', variantStyles[variant])}>
        {value}
      </span>
    </div>
  );
}

// ========== Main Component ==========

export function GlobalKpiBar() {
  const { formatMessage } = useIntl();
  const groups = useSessionManagerStore(selectGroups);
  const terminalMetas = useSessionManagerStore(selectTerminalMetas);
  const queueQuery = useIssueQueue();

  // Derive active session count from sessionManagerStore groups
  const sessionCount = useMemo(() => {
    const allSessionIds = groups.flatMap((g) => g.sessionIds);
    // Count sessions that have 'active' status in terminalMetas
    let activeCount = 0;
    for (const sid of allSessionIds) {
      const meta = terminalMetas[sid];
      const status: TerminalStatus = meta?.status ?? 'idle';
      if (status === 'active') {
        activeCount++;
      }
    }
    // If no sessions are managed in groups, return total unique session IDs
    // This ensures the KPI shows meaningful data even before grouping
    return activeCount > 0 ? activeCount : allSessionIds.length;
  }, [groups, terminalMetas]);

  // Derive queue pending count from useIssueQueue data
  const queuePendingCount = useMemo(() => {
    const queue = queueQuery.data;
    if (!queue) return 0;
    // Count all items across grouped_items
    let count = 0;
    if (queue.grouped_items) {
      for (const items of Object.values(queue.grouped_items)) {
        count += items.length;
      }
    }
    // Also count ungrouped tasks and solutions
    if (queue.tasks) count += queue.tasks.length;
    if (queue.solutions) count += queue.solutions.length;
    return count;
  }, [queueQuery.data]);

  // Derive total alert count from all terminalMetas
  const totalAlerts = useMemo(() => {
    let count = 0;
    for (const meta of Object.values(terminalMetas)) {
      count += meta.alertCount;
    }
    return count;
  }, [terminalMetas]);

  return (
    <div className="flex items-center gap-6 px-4 py-2 border-b border-border bg-muted/30 shrink-0">
      <KpiItem
        icon={Activity}
        label={formatMessage({ id: 'terminalDashboard.kpi.activeSessions' })}
        value={sessionCount}
        variant="primary"
      />

      <div className="w-px h-4 bg-border" />

      <KpiItem
        icon={ListChecks}
        label={formatMessage({ id: 'terminalDashboard.kpi.queueSize' })}
        value={queuePendingCount}
        variant={queuePendingCount > 0 ? 'warning' : 'default'}
      />

      <div className="w-px h-4 bg-border" />

      <KpiItem
        icon={AlertTriangle}
        label={formatMessage({ id: 'terminalDashboard.kpi.alertCount' })}
        value={totalAlerts}
        variant={totalAlerts > 0 ? 'destructive' : 'default'}
      />

      <span className="text-xs text-muted-foreground ml-auto">
        {formatMessage({ id: 'terminalDashboard.page.title' })}
      </span>
    </div>
  );
}
