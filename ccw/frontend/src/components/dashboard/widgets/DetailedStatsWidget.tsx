// ========================================
// DetailedStatsWidget Component
// ========================================
// Widget wrapper for detailed statistics cards in dashboard grid layout

import * as React from 'react';
import { useIntl } from 'react-intl';
import {
  FolderKanban,
  ListChecks,
  CheckCircle2,
  Clock,
  XCircle,
  Activity,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatCard, StatCardSkeleton } from '@/components/shared/StatCard';
import { useDashboardStats } from '@/hooks/useDashboardStats';

export interface DetailedStatsWidgetProps {
  /** Data grid attributes for react-grid-layout */
  'data-grid'?: {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
  /** Additional CSS classes */
  className?: string;
}

/**
 * DetailedStatsWidget - Dashboard widget showing detailed statistics
 *
 * Displays 6 stat cards with key metrics:
 * - Active sessions, total tasks, completed tasks
 * - Pending tasks, failed tasks, today's activity
 *
 * Wrapped with React.memo to prevent unnecessary re-renders when parent updates.
 */
function DetailedStatsWidgetComponent({ className, ...props }: DetailedStatsWidgetProps) {
  const { formatMessage } = useIntl();

  // Fetch dashboard stats
  const { stats, isLoading, isFetching } = useDashboardStats({
    refetchInterval: 60000, // Refetch every minute
  });

  // Generate mock sparkline data for last 7 days
  // TODO: Replace with real API data when backend provides trend data
  const generateSparklineData = (currentValue: number, variance = 0.3): number[] => {
    const days = 7;
    const data: number[] = [];
    let value = Math.max(0, currentValue * (1 - variance));

    for (let i = 0; i < days - 1; i++) {
      data.push(Math.round(value));
      const change = (Math.random() - 0.5) * 2 * variance * currentValue;
      value = Math.max(0, value + change);
    }

    // Last day is current value
    data.push(currentValue);
    return data;
  };

  // Stat card configuration with sparkline data
  const statCards = React.useMemo(() => [
    {
      key: 'activeSessions',
      title: formatMessage({ id: 'home.stats.activeSessions' }),
      icon: FolderKanban,
      variant: 'primary' as const,
      getValue: (stats: { activeSessions: number }) => stats.activeSessions,
      getSparkline: (stats: { activeSessions: number }) => generateSparklineData(stats.activeSessions, 0.4),
    },
    {
      key: 'totalTasks',
      title: formatMessage({ id: 'home.stats.totalTasks' }),
      icon: ListChecks,
      variant: 'info' as const,
      getValue: (stats: { totalTasks: number }) => stats.totalTasks,
      getSparkline: (stats: { totalTasks: number }) => generateSparklineData(stats.totalTasks, 0.3),
    },
    {
      key: 'completedTasks',
      title: formatMessage({ id: 'home.stats.completedTasks' }),
      icon: CheckCircle2,
      variant: 'success' as const,
      getValue: (stats: { completedTasks: number }) => stats.completedTasks,
      getSparkline: (stats: { completedTasks: number }) => generateSparklineData(stats.completedTasks, 0.25),
    },
    {
      key: 'pendingTasks',
      title: formatMessage({ id: 'home.stats.pendingTasks' }),
      icon: Clock,
      variant: 'warning' as const,
      getValue: (stats: { pendingTasks: number }) => stats.pendingTasks,
      getSparkline: (stats: { pendingTasks: number }) => generateSparklineData(stats.pendingTasks, 0.35),
    },
    {
      key: 'failedTasks',
      title: formatMessage({ id: 'common.status.failed' }),
      icon: XCircle,
      variant: 'danger' as const,
      getValue: (stats: { failedTasks: number }) => stats.failedTasks,
      getSparkline: (stats: { failedTasks: number }) => generateSparklineData(stats.failedTasks, 0.5),
    },
    {
      key: 'todayActivity',
      title: formatMessage({ id: 'common.stats.todayActivity' }),
      icon: Activity,
      variant: 'default' as const,
      getValue: (stats: { todayActivity: number }) => stats.todayActivity,
      getSparkline: (stats: { todayActivity: number }) => generateSparklineData(stats.todayActivity, 0.6),
    },
  ], [formatMessage]);

  return (
    <div {...props} className={className}>
      <Card className="h-full p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
            : statCards.map((card) => (
                <StatCard
                  key={card.key}
                  title={card.title}
                  value={stats ? card.getValue(stats as any) : 0}
                  icon={card.icon}
                  variant={card.variant}
                  isLoading={isFetching && !stats}
                  sparklineData={stats ? (card as any).getSparkline(stats as any) : undefined}
                  showSparkline={true}
                />
              ))}
        </div>
      </Card>
    </div>
  );
}

/**
 * Memoized DetailedStatsWidget - Prevents re-renders when parent updates
 * Props are compared shallowly; use useCallback for function props
 */
export const DetailedStatsWidget = React.memo(DetailedStatsWidgetComponent);

export default DetailedStatsWidget;
