// ========================================
// CoordinatorTaskCard Component
// ========================================
// Task card component for displaying task overview in horizontal list

import { useIntl } from 'react-intl';
import { Clock, CheckCircle, XCircle, Loader2, CircleDashed } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export interface TaskStatus {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: { completed: number; total: number };
  startedAt?: string;
  completedAt?: string;
}

export interface CoordinatorTaskCardProps {
  task: TaskStatus;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * Task card component displaying task status and progress
 * Used in horizontal scrolling task list
 */
export function CoordinatorTaskCard({
  task,
  isSelected,
  onClick,
  className,
}: CoordinatorTaskCardProps) {
  const { formatMessage } = useIntl();

  // Map status to badge variant
  const getStatusVariant = (status: TaskStatus['status']) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'running':
        return 'warning';
      case 'completed':
        return 'success';
      case 'failed':
        return 'destructive';
      case 'cancelled':
        return 'outline';
      default:
        return 'default';
    }
  };

  // Get status icon
  const getStatusIcon = (status: TaskStatus['status']) => {
    switch (status) {
      case 'pending':
        return <CircleDashed className="w-3 h-3" />;
      case 'running':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3" />;
      case 'failed':
        return <XCircle className="w-3 h-3" />;
      case 'cancelled':
        return <XCircle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  // Format time display
  const formatTime = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  };

  const displayTime = task.startedAt ? formatTime(task.startedAt) : null;

  return (
    <Card
      className={cn(
        'min-w-[180px] max-w-[220px] p-4 cursor-pointer transition-all duration-200',
        'hover:border-primary/50 hover:shadow-md',
        isSelected && 'border-primary ring-1 ring-primary/20',
        className
      )}
      onClick={onClick}
    >
      {/* Task Name */}
      <h3 className="font-medium text-sm text-foreground truncate mb-2" title={task.name}>
        {task.name}
      </h3>

      {/* Status Badge */}
      <div className="mb-3">
        <Badge variant={getStatusVariant(task.status)} className="gap-1">
          {getStatusIcon(task.status)}
          {formatMessage({ id: `coordinator.status.${task.status}` })}
        </Badge>
      </div>

      {/* Progress */}
      <div className="text-xs text-muted-foreground mb-2">
        <span className="font-medium">{task.progress.completed}</span>
        <span>/</span>
        <span>{task.progress.total}</span>
        <span className="ml-1">
          {formatMessage({ id: 'coordinator.taskCard.nodes' })}
        </span>
      </div>

      {/* Time */}
      {displayTime && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{displayTime}</span>
          <span className="ml-1">
            {formatMessage({ id: 'coordinator.taskCard.started' })}
          </span>
        </div>
      )}
    </Card>
  );
}

export default CoordinatorTaskCard;
