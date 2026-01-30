// ========================================
// TaskListTab Component
// ========================================
// Tasks tab for session detail page

import { useIntl } from 'react-intl';
import {
  ListChecks,
  Loader2,
  Circle,
  CheckCircle,
  Code,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { SessionMetadata, TaskData } from '@/types/store';

export interface TaskListTabProps {
  session: SessionMetadata;
  onTaskClick?: (task: TaskData) => void;
}

// Status configuration
const taskStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | null; icon: React.ComponentType<{ className?: string }> }> = {
  pending: {
    label: 'sessionDetail.tasks.status.pending',
    variant: 'secondary',
    icon: Circle,
  },
  in_progress: {
    label: 'sessionDetail.tasks.status.inProgress',
    variant: 'warning',
    icon: Loader2,
  },
  completed: {
    label: 'sessionDetail.tasks.status.completed',
    variant: 'success',
    icon: CheckCircle,
  },
  blocked: {
    label: 'sessionDetail.tasks.status.blocked',
    variant: 'destructive',
    icon: Circle,
  },
  skipped: {
    label: 'sessionDetail.tasks.status.skipped',
    variant: 'default',
    icon: Circle,
  },
};

/**
 * TaskListTab component - Display tasks in a list format
 */
export function TaskListTab({ session, onTaskClick }: TaskListTabProps) {
  const { formatMessage } = useIntl();

  const tasks = session.tasks || [];
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const blocked = tasks.filter((t) => t.status === 'blocked').length;

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-background rounded-lg border">
        <span className="flex items-center gap-1 text-sm">
          <CheckCircle className="h-4 w-4 text-success" />
          <strong>{completed}</strong> {formatMessage({ id: 'sessionDetail.tasks.completed' })}
        </span>
        <span className="flex items-center gap-1 text-sm">
          <Loader2 className="h-4 w-4 text-warning" />
          <strong>{inProgress}</strong> {formatMessage({ id: 'sessionDetail.tasks.inProgress' })}
        </span>
        <span className="flex items-center gap-1 text-sm">
          <Circle className="h-4 w-4 text-muted-foreground" />
          <strong>{pending}</strong> {formatMessage({ id: 'sessionDetail.tasks.pending' })}
        </span>
        {blocked > 0 && (
          <span className="flex items-center gap-1 text-sm">
            <Circle className="h-4 w-4 text-destructive" />
            <strong>{blocked}</strong> {formatMessage({ id: 'sessionDetail.tasks.blocked' })}
          </span>
        )}
      </div>

      {/* Tasks List */}
      {tasks.length === 0 ? (
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
          {tasks.map((task, index) => {
            const currentStatusConfig = task.status ? taskStatusConfig[task.status] : taskStatusConfig.pending;
            const StatusIcon = currentStatusConfig.icon;

            return (
              <Card
                key={task.task_id || index}
                className={`hover:shadow-sm transition-shadow ${onTaskClick ? 'cursor-pointer hover:shadow-md' : ''}`}
                onClick={() => onTaskClick?.(task as TaskData)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">
                          {task.task_id}
                        </span>
                        <Badge variant={currentStatusConfig.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {formatMessage({ id: currentStatusConfig.label })}
                        </Badge>
                        {task.priority && (
                          <Badge variant="outline" className="text-xs">
                            {task.priority}
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
