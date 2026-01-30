// ========================================
// SessionDetailPage Component
// ========================================
// Session detail page with tabs for tasks, context, and summary

import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  ArrowLeft,
  Calendar,
  ListChecks,
  Package,
  FileText,
  XCircle,
} from 'lucide-react';
import { useSessionDetail } from '@/hooks/useSessionDetail';
import { TaskListTab } from './session-detail/TaskListTab';
import { ContextTab } from './session-detail/ContextTab';
import { SummaryTab } from './session-detail/SummaryTab';
import { TaskDrawer } from '@/components/shared/TaskDrawer';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import type { TaskData } from '@/types/store';

type TabValue = 'tasks' | 'context' | 'summary';

/**
 * SessionDetailPage component - Main session detail page with tabs
 */
export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { sessionDetail, isLoading, error, refetch } = useSessionDetail(sessionId!);
  const [activeTab, setActiveTab] = React.useState<TabValue>('tasks');
  const [selectedTask, setSelectedTask] = React.useState<TaskData | null>(null);

  const handleBack = () => {
    navigate('/sessions');
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

  // Session not found
  if (!sessionDetail) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'sessionDetail.notFound.title' })}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {formatMessage({ id: 'sessionDetail.notFound.message' })}
        </p>
        <Button onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {formatMessage({ id: 'common.actions.back' })}
        </Button>
      </div>
    );
  }

  const { session, context, summary } = sessionDetail;
  const tasks = session.tasks || [];
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;

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
              {session.title || session.session_id}
            </h1>
            {session.title && session.title !== session.session_id && (
              <p className="text-sm text-muted-foreground mt-0.5">{session.session_id}</p>
            )}
          </div>
        </div>
        <Badge variant={session.status === 'completed' ? 'success' : 'secondary'}>
          {formatMessage({ id: `sessions.status.${session.status}` })}
        </Badge>
      </div>

      {/* Info Bar */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground p-4 bg-background rounded-lg border">
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <span className="font-medium">{formatMessage({ id: 'sessionDetail.info.created' })}:</span>{' '}
          {new Date(session.created_at).toLocaleString()}
        </div>
        {session.updated_at && (
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">{formatMessage({ id: 'sessionDetail.info.updated' })}:</span>{' '}
            {new Date(session.updated_at).toLocaleString()}
          </div>
        )}
        <div className="flex items-center gap-1">
          <ListChecks className="h-4 w-4" />
          <span className="font-medium">{formatMessage({ id: 'sessionDetail.info.tasks' })}:</span>{' '}
          {completedTasks}/{tasks.length}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="tasks">
            <ListChecks className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'sessionDetail.tabs.tasks' })}
            <Badge variant="secondary" className="ml-2">
              {tasks.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="context">
            <Package className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'sessionDetail.tabs.context' })}
          </TabsTrigger>
          <TabsTrigger value="summary">
            <FileText className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'sessionDetail.tabs.summary' })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <TaskListTab session={session} onTaskClick={setSelectedTask} />
        </TabsContent>

        <TabsContent value="context" className="mt-4">
          <ContextTab context={context} />
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          <SummaryTab summary={summary} />
        </TabsContent>
      </Tabs>

      {/* Description (if exists) */}
      {session.description && (
        <div className="p-4 bg-background rounded-lg border">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {formatMessage({ id: 'sessionDetail.info.description' })}
          </h3>
          <p className="text-sm text-muted-foreground">{session.description}</p>
        </div>
      )}

      {/* TaskDrawer */}
      <TaskDrawer
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}

export default SessionDetailPage;
