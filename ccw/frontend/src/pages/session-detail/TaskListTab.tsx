// ========================================
// TaskListTab Component
// ========================================
// Tasks tab for session detail page

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  ListChecks,
  Code,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { TaskStatsBar, TaskStatusDropdown } from '@/components/session-detail/tasks';
import type { SessionMetadata, TaskData } from '@/types/store';
import type { TaskStatus } from '@/lib/api';
import { bulkUpdateTaskStatus, updateTaskStatus } from '@/lib/api';

export interface TaskListTabProps {
  session: SessionMetadata;
  onTaskClick?: (task: TaskData) => void;
}

export interface TaskListTabProps {
  session: SessionMetadata;
  onTaskClick?: (task: TaskData) => void;
}

/**
 * TaskListTab component - Display tasks in a list format
 */
export function TaskListTab({ session, onTaskClick }: TaskListTabProps) {
  const { formatMessage } = useIntl();

  const tasks = session.tasks || [];
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;

  // Loading states for bulk actions
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [isLoadingInProgress, setIsLoadingInProgress] = useState(false);
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false);

  // Local task state for optimistic updates
  const [localTasks, setLocalTasks] = useState<TaskData[]>(tasks);

  // Update local tasks when session tasks change
  if (tasks !== localTasks && !isLoadingPending && !isLoadingInProgress && !isLoadingCompleted) {
    setLocalTasks(tasks);
  }

  // Get session path for API calls
  const sessionPath = (session as any).path || session.session_id;

  // Bulk action handlers
  const handleMarkAllPending = async () => {
    const targetTasks = localTasks.filter((t) => t.status === 'pending');
    if (targetTasks.length === 0) return;

    setIsLoadingPending(true);
    try {
      const taskIds = targetTasks.map((t) => t.task_id);
      const result = await bulkUpdateTaskStatus(sessionPath, taskIds, 'pending');
      if (result.success) {
        // Optimistic update - will be refreshed when parent re-renders
      } else {
        console.error('[TaskListTab] Failed to mark all as pending:', result.error);
      }
    } catch (error) {
      console.error('[TaskListTab] Failed to mark all as pending:', error);
    } finally {
      setIsLoadingPending(false);
    }
  };

  const handleMarkAllInProgress = async () => {
    const targetTasks = localTasks.filter((t) => t.status === 'in_progress');
    if (targetTasks.length === 0) return;

    setIsLoadingInProgress(true);
    try {
      const taskIds = targetTasks.map((t) => t.task_id);
      const result = await bulkUpdateTaskStatus(sessionPath, taskIds, 'in_progress');
      if (result.success) {
        // Optimistic update - will be refreshed when parent re-renders
      } else {
        console.error('[TaskListTab] Failed to mark all as in_progress:', result.error);
      }
    } catch (error) {
      console.error('[TaskListTab] Failed to mark all as in_progress:', error);
    } finally {
      setIsLoadingInProgress(false);
    }
  };

  const handleMarkAllCompleted = async () => {
    const targetTasks = localTasks.filter((t) => t.status === 'completed');
    if (targetTasks.length === 0) return;

    setIsLoadingCompleted(true);
    try {
      const taskIds = targetTasks.map((t) => t.task_id);
      const result = await bulkUpdateTaskStatus(sessionPath, taskIds, 'completed');
      if (result.success) {
        // Optimistic update - will be refreshed when parent re-renders
      } else {
        console.error('[TaskListTab] Failed to mark all as completed:', result.error);
      }
    } catch (error) {
      console.error('[TaskListTab] Failed to mark all as completed:', error);
    } finally {
      setIsLoadingCompleted(false);
    }
  };

  // Individual task status change handler
  const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const previousTasks = [...localTasks];
    const previousTask = previousTasks.find((t) => t.task_id === taskId);

    if (!previousTask) return;

    // Optimistic update
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.task_id === taskId ? { ...t, status: newStatus } : t
      )
    );

    try {
      const result = await updateTaskStatus(sessionPath, taskId, newStatus);
      if (!result.success) {
        // Rollback on error
        setLocalTasks(previousTasks);
        console.error('[TaskListTab] Failed to update task status:', result.error);
      }
    } catch (error) {
      // Rollback on error
      setLocalTasks(previousTasks);
      console.error('[TaskListTab] Failed to update task status:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats Bar with Bulk Actions */}
      <TaskStatsBar
        completed={completed}
        inProgress={inProgress}
        pending={pending}
        onMarkAllPending={handleMarkAllPending}
        onMarkAllInProgress={handleMarkAllInProgress}
        onMarkAllCompleted={handleMarkAllCompleted}
        isLoadingPending={isLoadingPending}
        isLoadingInProgress={isLoadingInProgress}
        isLoadingCompleted={isLoadingCompleted}
      />

      {/* Tasks List */}
      {localTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ListChecks className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {formatMessage({ id: 'sessionDetail.tasks.empty.title' })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatMessage({ id: 'sessionDetail.tasks.empty.message' })}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {localTasks.map((task, index) => {
            return (
              <Card
                key={task.task_id || index}
                className={`hover:shadow-sm transition-shadow ${onTaskClick ? 'cursor-pointer hover:shadow-md' : ''}`}
                onClick={() => onTaskClick?.(task as TaskData)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">
                          {task.task_id}
                        </span>
                        <TaskStatusDropdown
                          currentStatus={task.status as TaskStatus}
                          onStatusChange={(newStatus) => handleTaskStatusChange(task.task_id, newStatus)}
                          size="sm"
                        />
                        {task.priority && (
                          <span className="text-xs text-muted-foreground">
                            {task.priority}
                          </span>
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
                      {task.depends_on && task.depends_on.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Code className="h-3 w-3" />
                          <span>Depends on: {task.depends_on.join(', ')}</span>
                        </div>
                      )}
                    </div>
                    {task.created_at && (
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(task.created_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
