// ========================================
// LiteTaskDetailPage Component
// ========================================
// Lite task detail page with flowchart visualization

import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  ArrowLeft,
  FileEdit,
  Wrench,
  Calendar,
  Loader2,
  XCircle,
  CheckCircle,
  Clock,
  Code,
  Zap,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useLiteTaskSession } from '@/hooks/useLiteTasks';
import { Flowchart } from '@/components/shared/Flowchart';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import type { LiteTask } from '@/lib/api';

/**
 * LiteTaskDetailPage component - Display single lite task session with flowchart
 */
export function LiteTaskDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { formatMessage } = useIntl();

  // Determine type from URL or state
  const [sessionType, setSessionType] = React.useState<'lite-plan' | 'lite-fix' | 'multi-cli-plan'>('lite-plan');
  const { session, isLoading, error, refetch } = useLiteTaskSession(sessionId, sessionType);

  // Track expanded tasks
  const [expandedTasks, setExpandedTasks] = React.useState<Set<string>>(new Set());

  // Try to detect type from session data
  React.useEffect(() => {
    if (session?.type) {
      setSessionType(session.type);
    }
  }, [session]);

  const handleBack = () => {
    navigate('/lite-tasks');
  };

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Get task status badge
  const getTaskStatusBadge = (task: LiteTask) => {
    switch (task.status) {
      case 'completed':
        return { variant: 'success' as const, label: formatMessage({ id: 'sessionDetail.status.completed' }), icon: CheckCircle };
      case 'in_progress':
        return { variant: 'warning' as const, label: formatMessage({ id: 'sessionDetail.status.inProgress' }), icon: Loader2 };
      case 'blocked':
        return { variant: 'destructive' as const, label: formatMessage({ id: 'sessionDetail.status.blocked' }), icon: XCircle };
      case 'failed':
        return { variant: 'destructive' as const, label: formatMessage({ id: 'fixSession.status.failed' }), icon: XCircle };
      default:
        return { variant: 'secondary' as const, label: formatMessage({ id: 'sessionDetail.status.pending' }), icon: Clock };
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" disabled>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'common.back' })}
          </Button>
          <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
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
        <Zap className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'liteTasksDetail.notFound.title' })}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {formatMessage({ id: 'liteTasksDetail.notFound.message' })}
        </p>
        <Button onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {formatMessage({ id: 'common.back' })}
        </Button>
      </div>
    );
  }

  const tasks = session.tasks || [];
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const isLitePlan = session.type === 'lite-plan';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'common.back' })}
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {session.title || session.id || session.session_id}
            </h1>
            {(session.title || (session.session_id && session.session_id !== session.id)) && (
              <p className="text-sm text-muted-foreground mt-0.5">{session.id || session.session_id}</p>
            )}
          </div>
        </div>
        <Badge variant={isLitePlan ? 'info' : 'warning'} className="gap-1">
          {isLitePlan ? <FileEdit className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
          {formatMessage({ id: isLitePlan ? 'liteTasks.type.plan' : 'liteTasks.type.fix' })}
        </Badge>
      </div>

      {/* Info Bar */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground p-4 bg-background rounded-lg border">
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <span className="font-medium">{formatMessage({ id: 'sessionDetail.info.created' })}:</span>{' '}
          {session.createdAt ? new Date(session.createdAt).toLocaleString() : 'N/A'}
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle className="h-4 w-4" />
          <span className="font-medium">{formatMessage({ id: 'sessionDetail.info.tasks' })}:</span>{' '}
          {completedTasks}/{tasks.length}
        </div>
      </div>

      {/* Description (if exists) */}
      {session.description && (
        <div className="p-4 bg-background rounded-lg border">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {formatMessage({ id: 'sessionDetail.info.description' })}
          </h3>
          <p className="text-sm text-muted-foreground">{session.description}</p>
        </div>
      )}

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {formatMessage({ id: 'liteTasksDetail.empty.title' })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {formatMessage({ id: 'liteTasksDetail.empty.message' })}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task, index) => {
            const taskId = task.task_id || task.id || `T${index + 1}`;
            const isExpanded = expandedTasks.has(taskId);
            const statusBadge = getTaskStatusBadge(task);
            const StatusIcon = statusBadge.icon;
            const hasFlowchart = task.flow_control?.implementation_approach &&
              task.flow_control.implementation_approach.length > 0;

            return (
              <Card key={taskId} className="overflow-hidden">
                <CardContent className="p-4">
                  {/* Task Header */}
                  <div
                    className="flex items-start justify-between gap-3 cursor-pointer"
                    onClick={() => toggleTaskExpanded(taskId)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{taskId}</span>
                        <Badge variant={statusBadge.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusBadge.label}
                        </Badge>
                        {task.priority && (
                          <Badge variant="outline" className="text-xs">
                            {task.priority}
                          </Badge>
                        )}
                        {hasFlowchart && (
                          <Badge variant="info" className="gap-1">
                            <Code className="h-3 w-3" />
                            {formatMessage({ id: 'liteTasksDetail.flowchart' })}
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium text-foreground text-sm">
                        {task.title || formatMessage({ id: 'sessionDetail.tasks.untitled' })}
                      </h4>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      {task.context?.depends_on && task.context.depends_on.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Code className="h-3 w-3" />
                          <span>Depends on: {task.context.depends_on.join(', ')}</span>
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="flex-shrink-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border">
                      {/* Flowchart */}
                      {hasFlowchart && task.flow_control && (
                        <div className="mb-4">
                          <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            <Code className="h-4 w-4" />
                            {formatMessage({ id: 'liteTasksDetail.implementationFlow' })}
                          </h5>
                          <Flowchart flowControl={task.flow_control} className="border border-border rounded-lg" />
                        </div>
                      )}

                      {/* Focus Paths */}
                      {task.context?.focus_paths && task.context.focus_paths.length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-sm font-semibold text-foreground mb-2">
                            {formatMessage({ id: 'liteTasksDetail.focusPaths' })}
                          </h5>
                          <div className="space-y-1">
                            {task.context.focus_paths.map((path, idx) => (
                              <code
                                key={idx}
                                className="block text-xs bg-muted px-2 py-1 rounded font-mono"
                              >
                                {path}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Acceptance Criteria */}
                      {task.context?.acceptance && task.context.acceptance.length > 0 && (
                        <div>
                          <h5 className="text-sm font-semibold text-foreground mb-2">
                            {formatMessage({ id: 'liteTasksDetail.acceptanceCriteria' })}
                          </h5>
                          <ul className="space-y-1">
                            {task.context.acceptance.map((criteria, idx) => (
                              <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                <span className="text-primary font-bold">{idx + 1}.</span>
                                <span>{criteria}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LiteTaskDetailPage;
