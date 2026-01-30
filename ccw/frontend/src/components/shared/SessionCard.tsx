// ========================================
// SessionCard Component
// ========================================
// Session card with status badge and action menu

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/Dropdown';
import {
  Calendar,
  ListChecks,
  MoreVertical,
  Eye,
  Archive,
  Trash2,
  Play,
  Pause,
} from 'lucide-react';
import type { SessionMetadata } from '@/types/store';

export interface SessionCardProps {
  /** Session data */
  session: SessionMetadata;
  /** Called when view action is triggered */
  onView?: (sessionId: string) => void;
  /** Called when archive action is triggered */
  onArchive?: (sessionId: string) => void;
  /** Called when delete action is triggered */
  onDelete?: (sessionId: string) => void;
  /** Called when card is clicked */
  onClick?: (sessionId: string) => void;
  /** Optional className */
  className?: string;
  /** Show actions dropdown */
  showActions?: boolean;
  /** Disabled state for actions */
  actionsDisabled?: boolean;
}

// Status badge configuration
const statusConfig: Record<
  SessionMetadata['status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' }
> = {
  planning: { label: 'Planning', variant: 'info' },
  in_progress: { label: 'In Progress', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  archived: { label: 'Archived', variant: 'secondary' },
  paused: { label: 'Paused', variant: 'default' },
};

/**
 * Format date to localized string
 */
function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'Unknown';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Calculate progress percentage from tasks
 */
function calculateProgress(tasks: SessionMetadata['tasks']): {
  completed: number;
  total: number;
  percentage: number;
} {
  if (!tasks || tasks.length === 0) {
    return { completed: 0, total: 0, percentage: 0 };
  }

  const completed = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.length;
  const percentage = Math.round((completed / total) * 100);

  return { completed, total, percentage };
}

/**
 * SessionCard component for displaying session information
 *
 * @example
 * ```tsx
 * <SessionCard
 *   session={session}
 *   onView={(id) => navigate(`/sessions/${id}`)}
 *   onArchive={(id) => archiveSession(id)}
 *   onDelete={(id) => deleteSession(id)}
 * />
 * ```
 */
export function SessionCard({
  session,
  onView,
  onArchive,
  onDelete,
  onClick,
  className,
  showActions = true,
  actionsDisabled = false,
}: SessionCardProps) {
  const { label: statusLabel, variant: statusVariant } = statusConfig[session.status] || {
    label: 'Unknown',
    variant: 'default' as const,
  };

  const progress = calculateProgress(session.tasks);
  const isPlanning = session.status === 'planning';
  const isArchived = session.status === 'archived' || session.location === 'archived';

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on dropdown
    if ((e.target as HTMLElement).closest('[data-radix-popper-content-wrapper]')) {
      return;
    }
    onClick?.(session.session_id);
  };

  const handleAction = (
    e: React.MouseEvent,
    action: 'view' | 'archive' | 'delete'
  ) => {
    e.stopPropagation();
    switch (action) {
      case 'view':
        onView?.(session.session_id);
        break;
      case 'archive':
        onArchive?.(session.session_id);
        break;
      case 'delete':
        onDelete?.(session.session_id);
        break;
    }
  };

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30',
        isPlanning && 'border-info/30 bg-info/5',
        className
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-card-foreground truncate">
              {session.title || session.session_id}
            </h3>
            {session.title && session.title !== session.session_id && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {session.session_id}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={statusVariant}>{statusLabel}</Badge>
            {showActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                    disabled={actionsDisabled}
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => handleAction(e, 'view')}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  {!isArchived && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => handleAction(e, 'archive')}>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => handleAction(e, 'delete')}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(session.created_at)}
          </span>
          <span className="flex items-center gap-1">
            <ListChecks className="h-3.5 w-3.5" />
            {progress.total} tasks
          </span>
        </div>

        {/* Progress bar (only show if not planning and has tasks) */}
        {progress.total > 0 && !isPlanning && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-card-foreground font-medium">
                {progress.completed}/{progress.total} ({progress.percentage}%)
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Description (if exists) */}
        {session.description && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {session.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton loader for SessionCard
 */
export function SessionCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('animate-pulse', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="h-5 w-32 rounded bg-muted" />
            <div className="mt-1 h-3 w-24 rounded bg-muted" />
          </div>
          <div className="h-5 w-16 rounded-full bg-muted" />
        </div>
        <div className="mt-3 flex gap-4">
          <div className="h-4 w-20 rounded bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
        </div>
        <div className="mt-3">
          <div className="h-1.5 w-full rounded-full bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
