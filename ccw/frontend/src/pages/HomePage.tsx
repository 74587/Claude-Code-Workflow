// ========================================
// HomePage Component
// ========================================
// Dashboard home page with stat cards and recent sessions

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  FolderKanban,
  ListChecks,
  CheckCircle2,
  Clock,
  XCircle,
  Activity,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useSessions } from '@/hooks/useSessions';
import { StatCard, StatCardSkeleton } from '@/components/shared/StatCard';
import { SessionCard, SessionCardSkeleton } from '@/components/shared/SessionCard';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

/**
 * HomePage component - Dashboard overview with statistics and recent sessions
 */
export function HomePage() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();

  // Stat card configuration
  const statCards = React.useMemo(() => [
    {
      key: 'activeSessions',
      title: formatMessage({ id: 'home.stats.activeSessions' }),
      icon: FolderKanban,
      variant: 'primary' as const,
      getValue: (stats: { activeSessions: number }) => stats.activeSessions,
    },
    {
      key: 'totalTasks',
      title: formatMessage({ id: 'home.stats.totalTasks' }),
      icon: ListChecks,
      variant: 'info' as const,
      getValue: (stats: { totalTasks: number }) => stats.totalTasks,
    },
    {
      key: 'completedTasks',
      title: formatMessage({ id: 'home.stats.completedTasks' }),
      icon: CheckCircle2,
      variant: 'success' as const,
      getValue: (stats: { completedTasks: number }) => stats.completedTasks,
    },
    {
      key: 'pendingTasks',
      title: formatMessage({ id: 'home.stats.pendingTasks' }),
      icon: Clock,
      variant: 'warning' as const,
      getValue: (stats: { pendingTasks: number }) => stats.pendingTasks,
    },
    {
      key: 'failedTasks',
      title: formatMessage({ id: 'common.status.failed' }),
      icon: XCircle,
      variant: 'danger' as const,
      getValue: (stats: { failedTasks: number }) => stats.failedTasks,
    },
    {
      key: 'todayActivity',
      title: formatMessage({ id: 'common.stats.todayActivity' }),
      icon: Activity,
      variant: 'default' as const,
      getValue: (stats: { todayActivity: number }) => stats.todayActivity,
    },
  ], [formatMessage]);

  // Fetch dashboard stats
  const {
    stats,
    isLoading: statsLoading,
    isFetching: statsFetching,
    error: statsError,
    refetch: refetchStats,
  } = useDashboardStats({
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch recent sessions (active only, limited)
  const {
    activeSessions,
    isLoading: sessionsLoading,
    isFetching: sessionsFetching,
    error: sessionsError,
    refetch: refetchSessions,
  } = useSessions({
    filter: { location: 'active' },
  });

  // Get recent sessions (max 6)
  const recentSessions = React.useMemo(
    () =>
      [...activeSessions]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6),
    [activeSessions]
  );

  const handleRefresh = async () => {
    await Promise.all([refetchStats(), refetchSessions()]);
  };

  const handleSessionClick = (sessionId: string) => {
    navigate(`/sessions/${sessionId}`);
  };

  const handleViewAllSessions = () => {
    navigate('/sessions');
  };

  const isLoading = statsLoading || sessionsLoading;
  const isFetching = statsFetching || sessionsFetching;
  const hasError = statsError || sessionsError;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{formatMessage({ id: 'home.title' })}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'home.description' })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
          {formatMessage({ id: 'common.actions.refresh' })}
        </Button>
      </div>

      {/* Error alert */}
      {hasError && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">{formatMessage({ id: 'home.errors.loadFailed' })}</p>
            <p className="text-xs mt-0.5">
              {(statsError || sessionsError)?.message || formatMessage({ id: 'common.errors.unknownError' })}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            {formatMessage({ id: 'home.errors.retry' })}
          </Button>
        </div>
      )}

      {/* Stats Grid */}
      <section>
        <h2 className="text-lg font-medium text-foreground mb-4">{formatMessage({ id: 'home.sections.statistics' })}</h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {isLoading
            ? // Loading skeletons
              Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
            : // Actual stat cards
              statCards.map((card) => (
                <StatCard
                  key={card.key}
                  title={card.title}
                  value={stats ? card.getValue(stats as any) : 0}
                  icon={card.icon}
                  variant={card.variant}
                  isLoading={isFetching && !stats}
                />
              ))}
        </div>
      </section>

      {/* Recent Sessions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-foreground">{formatMessage({ id: 'home.sections.recentSessions' })}</h2>
          <Button variant="link" size="sm" onClick={handleViewAllSessions}>
            {formatMessage({ id: 'common.actions.viewAll' })}
          </Button>
        </div>

        {sessionsLoading ? (
          // Loading skeletons
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SessionCardSkeleton key={i} />
            ))}
          </div>
        ) : recentSessions.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-border rounded-lg">
            <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">{formatMessage({ id: 'home.emptyState.noSessions.title' })}</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {formatMessage({ id: 'home.emptyState.noSessions.message' })}
            </p>
          </div>
        ) : (
          // Session cards grid
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {recentSessions.map((session) => (
              <SessionCard
                key={session.session_id}
                session={session}
                onClick={handleSessionClick}
                onView={handleSessionClick}
                showActions={false}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default HomePage;
