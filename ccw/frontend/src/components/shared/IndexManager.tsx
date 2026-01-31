// ========================================
// IndexManager Component
// ========================================
// Component for managing code index with status display and rebuild functionality

import * as React from 'react';
import { useIntl } from 'react-intl';
import { Database, RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/shared/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useIndex } from '@/hooks/useIndex';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface IndexManagerProps {
  className?: string;
}

// ========== Helper Components ==========

/**
 * Progress bar for index rebuild
 */
function IndexProgressBar({ progress, status }: { progress?: number; status: string }) {
  const { formatMessage } = useIntl();

  if (status !== 'building' || progress === undefined) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {formatMessage({ id: 'index.status.building' })}
        </span>
        <span className="font-medium text-foreground">{progress}%</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Status badge component
 */
function IndexStatusBadge({ status }: { status: string }) {
  const { formatMessage } = useIntl();

  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    idle: { variant: 'secondary', label: formatMessage({ id: 'index.status.idle' }) },
    building: { variant: 'default', label: formatMessage({ id: 'index.status.building' }) },
    completed: { variant: 'outline', label: formatMessage({ id: 'index.status.completed' }) },
    failed: { variant: 'destructive', label: formatMessage({ id: 'index.status.failed' }) },
  };

  const { variant, label } = config[status] ?? config.idle;

  return (
    <Badge variant={variant} className="text-xs">
      {label}
    </Badge>
  );
}

// ========== Main Component ==========

/**
 * IndexManager component for displaying index status and managing rebuild operations
 *
 * @example
 * ```tsx
 * <IndexManager />
 * ```
 */
export function IndexManager({ className }: IndexManagerProps) {
  const { formatMessage } = useIntl();
  const { status, isLoading, rebuildIndex, isRebuilding, rebuildError, refetch } = useIndex();

  // Auto-refresh during rebuild
  const refetchInterval = status?.status === 'building' ? 2000 : 0;
  React.useEffect(() => {
    if (status?.status === 'building') {
      const interval = setInterval(() => {
        refetch();
      }, refetchInterval);
      return () => clearInterval(interval);
    }
  }, [status?.status, refetchInterval, refetch]);

  // Handle rebuild button click
  const handleRebuild = async () => {
    try {
      await rebuildIndex({ force: false });
    } catch (error) {
      console.error('[IndexManager] Rebuild failed:', error);
    }
  };

  // Format build time (ms to human readable)
  const formatBuildTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  // Format last updated time
  const formatLastUpdated = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return formatMessage({ id: 'index.time.justNow' });
    if (diffMins < 60) return formatMessage({ id: 'index.time.minutesAgo' }, { value: diffMins });
    if (diffHours < 24) return formatMessage({ id: 'index.time.hoursAgo' }, { value: diffHours });
    return formatMessage({ id: 'index.time.daysAgo' }, { value: diffDays });
  };

  return (
    <Card className={cn('p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            {formatMessage({ id: 'index.title' })}
          </h2>
          {status && <IndexStatusBadge status={status.status} />}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRebuild}
          disabled={isRebuilding || status?.status === 'building'}
          className="h-8"
        >
          <RefreshCw className={cn('w-4 h-4 mr-1', isRebuilding && 'animate-spin')} />
          {formatMessage({ id: 'index.actions.rebuild' })}
        </Button>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-4">
        {formatMessage({ id: 'index.description' })}
      </p>

      {/* Error message */}
      {rebuildError && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">
              {formatMessage({ id: 'index.errors.rebuildFailed' })}
            </p>
            <p className="text-xs text-destructive/80 mt-1">{rebuildError.message}</p>
          </div>
        </div>
      )}

      {/* Status error */}
      {status?.error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-sm text-destructive">{status.error}</p>
        </div>
      )}

      {/* Progress Bar */}
      {status && <IndexProgressBar progress={status.progress} status={status.status} />}

      {/* Current file being indexed */}
      {status?.currentFile && status.status === 'building' && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span className="truncate">{status.currentFile}</span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {/* Total Files */}
        <StatCard
          title={formatMessage({ id: 'index.stats.totalFiles' })}
          value={status?.totalFiles ?? 0}
          icon={Database}
          variant="primary"
          isLoading={isLoading}
          description={formatMessage({ id: 'index.stats.totalFilesDesc' })}
        />

        {/* Last Updated */}
        <StatCard
          title={formatMessage({ id: 'index.stats.lastUpdated' })}
          value={status?.lastUpdated ? formatLastUpdated(status.lastUpdated) : '-'}
          icon={Clock}
          variant="info"
          isLoading={isLoading}
          description={status?.lastUpdated
            ? new Date(status.lastUpdated).toLocaleString()
            : formatMessage({ id: 'index.stats.never' })
          }
        />

        {/* Build Time */}
        <StatCard
          title={formatMessage({ id: 'index.stats.buildTime' })}
          value={status?.buildTime ? formatBuildTime(status.buildTime) : '-'}
          icon={status?.status === 'completed' ? CheckCircle2 : AlertCircle}
          variant={status?.status === 'completed' ? 'success' : 'warning'}
          isLoading={isLoading}
          description={formatMessage({ id: 'index.stats.buildTimeDesc' })}
        />
      </div>
    </Card>
  );
}

export default IndexManager;
