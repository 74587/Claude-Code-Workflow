// ========================================
// LiteTasksPage Component
// ========================================
// Lite-plan and lite-fix task list page with TaskDrawer

import * as React from 'react';
import { useIntl } from 'react-intl';
import {
  ArrowLeft,
  Zap,
  Wrench,
  FileEdit,
  MessagesSquare,
  Calendar,
  ListChecks,
  XCircle,
  Activity,
  Repeat,
  MessageCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useLiteTasks } from '@/hooks/useLiteTasks';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { TaskDrawer } from '@/components/shared/TaskDrawer';
import type { LiteTask, LiteTaskSession } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

type LiteTaskTab = 'lite-plan' | 'lite-fix' | 'multi-cli-plan';

/**
 * Get i18n text from label object (supports {en, zh} format)
 */
function getI18nText(label: string | { en?: string; zh?: string } | undefined, fallback: string): string {
  if (!label) return fallback;
  if (typeof label === 'string') return label;
  return label.en || label.zh || fallback;
}

/**
 * LiteTasksPage component - Display lite-plan and lite-fix sessions with expandable tasks
 */
export function LiteTasksPage() {
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { litePlan, liteFix, multiCliPlan, isLoading, error, refetch } = useLiteTasks();
  const [activeTab, setActiveTab] = React.useState<LiteTaskTab>('lite-plan');
  const [expandedSessionId, setExpandedSessionId] = React.useState<string | null>(null);
  const [selectedTask, setSelectedTask] = React.useState<LiteTask | null>(null);

  const handleBack = () => {
    navigate('/sessions');
  };

  // Get status badge color
  const getStatusColor = (status?: string) => {
    const statusColors: Record<string, string> = {
      decided: 'success',
      converged: 'success',
      plan_generated: 'success',
      completed: 'success',
      exploring: 'info',
      initialized: 'info',
      analyzing: 'warning',
      debating: 'warning',
      blocked: 'destructive',
      conflict: 'destructive',
    };
    return statusColors[status || ''] || 'secondary';
  };

  // Render lite task card with expandable tasks
  const renderLiteTaskCard = (session: LiteTaskSession) => {
    const isLitePlan = session.type === 'lite-plan';
    const taskCount = session.tasks?.length || 0;
    const isExpanded = expandedSessionId === session.id;

    return (
      <div key={session.id}>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground text-sm">{session.id}</h3>
                </div>
              </div>
              <Badge variant={isLitePlan ? 'secondary' : 'warning'} className="gap-1 flex-shrink-0">
                {isLitePlan ? <FileEdit className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
                {formatMessage({ id: isLitePlan ? 'liteTasks.type.plan' : 'liteTasks.type.fix' })}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {session.createdAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(session.createdAt).toLocaleDateString()}
                </span>
              )}
              <span className="flex items-center gap-1">
                <ListChecks className="h-3.5 w-3.5" />
                {taskCount} {formatMessage({ id: 'session.tasks' })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Expanded tasks list */}
        {isExpanded && session.tasks && session.tasks.length > 0 && (
          <div className="mt-2 ml-6 space-y-2 pb-2">
            {session.tasks.map((task, index) => {
              const taskStatusColor = task.status === 'completed' ? 'success' :
                                    task.status === 'in_progress' ? 'warning' :
                                    task.status === 'failed' ? 'destructive' : 'secondary';

              return (
                <Card
                  key={task.id || index}
                  className="cursor-pointer hover:shadow-sm hover:border-primary/50 transition-all border-border"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTask(task);
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-muted-foreground">
                            {task.task_id || `#${index + 1}`}
                          </span>
                          <Badge variant={taskStatusColor as 'success' | 'warning' | 'destructive' | 'secondary'} className="text-xs">
                            {task.status}
                          </Badge>
                        </div>
                        <h4 className="text-sm font-medium text-foreground">
                          {task.title || 'Untitled Task'}
                        </h4>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render multi-cli plan card
  const renderMultiCliCard = (session: LiteTaskSession) => {
    const metadata = session.metadata || {};
    const latestSynthesis = session.latestSynthesis || {};
    const roundCount = (metadata.roundId as number) || session.roundCount || 1;
    const topicTitle = getI18nText(
      latestSynthesis.title as string | { en?: string; zh?: string } | undefined,
      'Discussion Topic'
    );
    const status = latestSynthesis.status || session.status || 'analyzing';
    const createdAt = (metadata.timestamp as string) || session.createdAt || '';

    return (
      <Card
        key={session.id}
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setExpandedSessionId(expandedSessionId === session.id ? null : session.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                {expandedSessionId === session.id ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground text-sm">{session.id}</h3>
              </div>
            </div>
            <Badge variant="secondary" className="gap-1 flex-shrink-0">
              <MessagesSquare className="h-3 w-3" />
              {formatMessage({ id: 'liteTasks.type.multiCli' })}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
            <MessageCircle className="h-4 w-4" />
            <span className="line-clamp-1">{topicTitle}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {createdAt && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(createdAt).toLocaleDateString()}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Repeat className="h-3.5 w-3.5" />
              {roundCount} {formatMessage({ id: 'liteTasks.rounds' })}
            </span>
            <Badge variant={getStatusColor(status) as 'success' | 'info' | 'warning' | 'destructive' | 'secondary'} className="gap-1">
              <Activity className="h-3 w-3" />
              {status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
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

  const totalSessions = litePlan.length + liteFix.length + multiCliPlan.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'common.actions.back' })}
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {formatMessage({ id: 'liteTasks.title' })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatMessage({ id: 'liteTasks.subtitle' }, { count: totalSessions })}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LiteTaskTab)}>
        <TabsList>
          <TabsTrigger value="lite-plan">
            <FileEdit className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'liteTasks.type.plan' })}
            <Badge variant="secondary" className="ml-2">
              {litePlan.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="lite-fix">
            <Wrench className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'liteTasks.type.fix' })}
            <Badge variant="secondary" className="ml-2">
              {liteFix.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="multi-cli-plan">
            <MessagesSquare className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'liteTasks.type.multiCli' })}
            <Badge variant="secondary" className="ml-2">
              {multiCliPlan.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Lite Plan Tab */}
        <TabsContent value="lite-plan" className="mt-4">
          {litePlan.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Zap className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {formatMessage({ id: 'liteTasks.empty.title' }, { type: 'lite-plan' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'liteTasks.empty.message' })}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">{litePlan.map(renderLiteTaskCard)}</div>
          )}
        </TabsContent>

        {/* Lite Fix Tab */}
        <TabsContent value="lite-fix" className="mt-4">
          {liteFix.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Zap className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {formatMessage({ id: 'liteTasks.empty.title' }, { type: 'lite-fix' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'liteTasks.empty.message' })}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">{liteFix.map(renderLiteTaskCard)}</div>
          )}
        </TabsContent>

        {/* Multi-CLI Plan Tab */}
        <TabsContent value="multi-cli-plan" className="mt-4">
          {multiCliPlan.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Zap className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {formatMessage({ id: 'liteTasks.empty.title' }, { type: 'multi-cli-plan' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'liteTasks.empty.message' })}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">{multiCliPlan.map(renderMultiCliCard)}</div>
          )}
        </TabsContent>
      </Tabs>

      {/* TaskDrawer */}
      <TaskDrawer
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}

export default LiteTasksPage;
