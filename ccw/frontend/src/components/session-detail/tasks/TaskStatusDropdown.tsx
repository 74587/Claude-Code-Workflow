// ========================================
// TaskStatusDropdown Component
// ========================================
// Inline status dropdown for task items

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Circle,
  Loader2,
  CheckCircle,
  CircleX,
  Forward,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/Dropdown';
import { Badge } from '@/components/ui/Badge';
import type { TaskStatus } from '@/lib/api';

export interface TaskStatusDropdownProps {
  currentStatus: TaskStatus;
  onStatusChange: (newStatus: TaskStatus) => void | Promise<void>;
  disabled?: boolean;
  size?: 'sm' | 'default';
}

// Status configuration
const statusConfig: Record<
  TaskStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | null;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
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
    icon: CircleX,
  },
  skipped: {
    label: 'sessionDetail.tasks.status.skipped',
    variant: 'default',
    icon: Forward,
  },
};

/**
 * TaskStatusDropdown component - Inline status selector with optimistic UI
 */
export function TaskStatusDropdown({
  currentStatus,
  onStatusChange,
  disabled = false,
  size = 'sm',
}: TaskStatusDropdownProps) {
  const { formatMessage } = useIntl();
  const [isChanging, setIsChanging] = useState(false);

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (newStatus === currentStatus || isChanging) return;

    setIsChanging(true);
    try {
      await onStatusChange(newStatus);
    } catch (error) {
      console.error('[TaskStatusDropdown] Failed to update status:', error);
    } finally {
      setIsChanging(false);
    }
  };

  const currentConfig = statusConfig[currentStatus] || statusConfig.pending;
  const StatusIcon = currentConfig.icon;
  const badgeSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        disabled={disabled || isChanging}
        className="cursor-pointer"
      >
        <Badge
          variant={currentConfig.variant}
          className={`gap-1 ${badgeSize} ${isChanging ? 'opacity-50' : ''}`}
        >
          {isChanging ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <StatusIcon className="h-3 w-3" />
          )}
          {formatMessage({ id: currentConfig.label })}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {(Object.keys(statusConfig) as TaskStatus[]).map((status) => {
          const config = statusConfig[status];
          const Icon = config.icon;
          return (
            <DropdownMenuItem
              key={status}
              onClick={() => handleStatusChange(status)}
              disabled={status === currentStatus || isChanging}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              <span>{formatMessage({ id: config.label })}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
