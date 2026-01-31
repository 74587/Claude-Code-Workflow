// ========================================
// FixSessionPage Component
// ========================================
// Fix session detail page for displaying fix session tasks

import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  ArrowLeft,
  Wrench,
  CheckCircle,
  XCircle,
  Clock,
  File,
  Loader2,
} from 'lucide-react';
import { useSessions } from '@/hooks/useSessions';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';

type TaskStatusFilter = 'all' | 'pending' | 'in_progress' | 'fixed' | 'failed';

interface FixTask {
  task_id: string;
  id?: string;
  title?: string;
  status: 'pending' | 'in_progress' | 'completed';
  result?: 'fixed' | 'failed';
  file?: string;
  line?: number;
  finding_title?: string;
  dimension?: string;
  attempts?: number;
  commit_hash?: string;
}

/**
 * FixSessionPage component - Display fix session tasks and progress
 */
export function FixSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { filteredSessions, isLoading, error, refetch } = useSessions({
    filter: { location: 'all' },
  });

  const [statusFilter, setStatusFilter] = React.useState<TaskStatusFilter>('all');

  // Find session
  const session = React.useMemo(
    () => filteredSessions.find((s) => s.session_id === sessionId),
    [filteredSessions, sessionId]
  );

  const tasks = React.useMemo(() => {
    if (!session?.tasks) return [];
    return session.tasks as FixTask[];
  }, [session?.tasks]);

  // Calculate statistics
  const stats = React.useMemo(() => {
    const total = tasks.length;
    const fixed = tasks.filter((t) => t.status === 'completed' && t.result === 'fixed').length;
    const failed = tasks.filter((t) => t.status === 'completed' && t.result === 'failed').length;
    const pending = tasks.filter((t) => t.status === 'pending').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const completed = fixed + failed;
    const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, fixed, failed, pending, inProgress, completed, percentComplete };
  }, [tasks]);

  // Filter tasks
  const filteredTasks = React.useMemo(() => {
    if (statusFilter === 'all') return tasks;
    if (statusFilter === 'fixed') {
      return tasks.filter((t) => t.status === 'completed' && t.result === 'fixed');
    }
    if (statusFilter === 'failed') {
      return tasks.filter((t) => t.status === 'completed' && t.result === 'failed');
    }
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  // Get status badge props
  const getStatusBadge = (task: FixTask) => {
    if (task.status === 'completed') {
      if (task.result === 'fixed') {
        return { variant: 'success' as const, label: formatMessage({ id: 'fixSession.status.fixed' }), icon: CheckCircle };
      }
      if (task.result === 'failed') {
        return { variant: 'destructive' as const, label: formatMessage({ id: 'fixSession.status.failed' }), icon: XCircle };
      }
    }
    if (task.status === 'in_progress') {
      return { variant: 'warning' as const, label: formatMessage({ id: 'fixSession.status.inProgress' }), icon: Loader2 };
    }
    return { variant: 'secondary' as const, label: formatMessage({ id: 'fixSession.status.pending' }), icon: Clock };
  };

  const handleBack = () => {
    navigate('/sessions');
  };

  const handleFilterChange = (filter: TaskStatusFilter) => {
    setStatusFilter(filter);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" disabled>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'common.actions.back' })}
          </Button>
          <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
        <XCircle className="h-5 w-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">{formatMessage({ id: 'common.errors.loadFailed' })}</p>
          <p className="text-xs mt-0.5">{error.message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {formatMessage({ id: 'common.actions.retry' })}
        </Button>
      </div>
    );
  }

  // Session not found
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'fixSession.notFound.title' })}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {formatMessage({ id: 'fixSession.notFound.message' })}
        </p>
        <Button onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {formatMessage({ id: 'common.actions.back' })}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {formatMessage({ id: 'common.actions.back' })}
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground">{session.session_id}</h1>
          {session.title && (
            <p className="text-sm text-muted-foreground mt-0.5">{session.title}</p>
          )}
        </div>
        <Badge variant="warning">
          <Wrench className="h-3 w-3 mr-1" />
          Fix
        </Badge>
      </div>

      {/* Progress Section */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {formatMessage({ id: 'fixSession.progress.title' })}
            </h3>
            <Badge variant="secondary">{session.phase || formatMessage({ id: 'fixSession.phase.execution' })}</Badge>
          </div>

          {/* Progress Bar */}
          <div className="mb-2">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${stats.percentComplete}%` }}
              />
            </div>
          </div>
          <div className="text-sm text-muted-foreground mb-6">
            <strong>{stats.completed}</strong>/{stats.total} {formatMessage({ id: 'common.tasks' })} (
            {stats.percentComplete}%)
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-background rounded-lg border">
              <div className="text-2xl font-semibold text-foreground">{stats.total}</div>
              <div className="text-sm text-muted-foreground">{formatMessage({ id: 'fixSession.stats.total' })}</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg border border-success/30 bg-success/5">
              <div className="text-2xl font-semibold text-success">{stats.fixed}</div>
              <div className="text-sm text-muted-foreground">{formatMessage({ id: 'fixSession.stats.fixed' })}</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg border border-destructive/30 bg-destructive/5">
              <div className="text-2xl font-semibold text-destructive">{stats.failed}</div>
              <div className="text-sm text-muted-foreground">{formatMessage({ id: 'fixSession.stats.failed' })}</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg border">
              <div className="text-2xl font-semibold text-foreground">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">{formatMessage({ id: 'fixSession.stats.pending' })}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Section */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <File className="h-5 w-5" />
              {formatMessage({ id: 'fixSession.tasks.title' })}
            </h3>
            <div className="flex gap-1">
              {[
                { key: 'all' as const, label: formatMessage({ id: 'fixSession.filter.all' }) },
                { key: 'pending' as const, label: formatMessage({ id: 'fixSession.filter.pending' }) },
                { key: 'in_progress' as const, label: formatMessage({ id: 'fixSession.filter.inProgress' }) },
                { key: 'fixed' as const, label: formatMessage({ id: 'fixSession.filter.fixed' }) },
                { key: 'failed' as const, label: formatMessage({ id: 'fixSession.filter.failed' }) },
              ].map((filter) => (
                <Button
                  key={filter.key}
                  variant={statusFilter === filter.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleFilterChange(filter.key)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Tasks List */}
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <File className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {formatMessage({ id: 'fixSession.empty.title' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'fixSession.empty.message' })}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredTasks.map((task) => {
                const statusBadge = getStatusBadge(task);
                const StatusIcon = statusBadge.icon;

                return (
                  <Card
                    key={task.task_id || task.id}
                    className={`hover:shadow-sm transition-shadow ${
                      task.status === 'completed' && task.result === 'failed'
                        ? 'border-destructive/30 bg-destructive/5'
                        : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-muted-foreground">
                              {task.task_id || task.id || 'N/A'}
                            </span>
                            <Badge variant={statusBadge.variant} className="gap-1">
                              <StatusIcon className="h-3 w-3" />
                              {statusBadge.label}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-foreground text-sm">
                            {task.title || formatMessage({ id: 'fixSession.task.untitled' })}
                          </h4>
                          {task.finding_title && (
                            <p className="text-sm text-muted-foreground mt-1">{task.finding_title}</p>
                          )}
                          {task.file && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                              <File className="h-3 w-3" />
                              {task.file}
                              {task.line && `:${task.line}`}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          {task.dimension && (
                            <span className="px-2 py-0.5 bg-muted rounded text-muted-foreground">
                              {task.dimension}
                            </span>
                          )}
                          {task.attempts && task.attempts > 1 && (
                            <span className="px-2 py-0.5 bg-muted rounded text-muted-foreground">
                              {formatMessage({ id: 'fixSession.task.attempts' }, { count: task.attempts })}
                            </span>
                          )}
                          {task.commit_hash && (
                            <span className="px-2 py-0.5 bg-primary-light text-primary rounded font-mono">
                              {task.commit_hash.substring(0, 7)}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Info */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground p-4 bg-background rounded-lg border">
        <div>
          <span className="font-medium">{formatMessage({ id: 'fixSession.info.created' })}:</span>{' '}
          {new Date(session.created_at).toLocaleString()}
        </div>
        {session.updated_at && (
          <div>
            <span className="font-medium">{formatMessage({ id: 'fixSession.info.updated' })}:</span>{' '}
            {new Date(session.updated_at).toLocaleString()}
          </div>
        )}
        {session.description && (
          <div className="w-full">
            <span className="font-medium">{formatMessage({ id: 'fixSession.info.description' })}:</span>{' '}
            {session.description}
          </div>
        )}
      </div>
    </div>
  );
}

export default FixSessionPage;
