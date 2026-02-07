// ========================================
// SessionCard Component
// ========================================
// Session card with status badge and action menu

import * as React from 'react';
import { useIntl } from 'react-intl';
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
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileText,
  Search,
  TestTube,
  File,
  Settings,
  Zap,
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

// Status variant configuration (without labels for i18n)
const statusVariantConfig: Record<
  SessionMetadata['status'],
  { variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' }
> = {
  planning: { variant: 'info' },
  in_progress: { variant: 'warning' },
  completed: { variant: 'success' },
  archived: { variant: 'secondary' },
  paused: { variant: 'default' },
};

// Status label keys for i18n
const statusLabelKeys: Record<SessionMetadata['status'], string> = {
  planning: 'sessions.status.planning',
  in_progress: 'sessions.status.inProgress',
  completed: 'sessions.status.completed',
  archived: 'sessions.status.archived',
  paused: 'sessions.status.paused',
};

// Type variant configuration for session type badges (unique colors for each type)
const typeVariantConfig: Record<
  NonNullable<SessionMetadata['type']>,
  { variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' | 'review'; icon: React.ElementType }
> = {
  review: { variant: 'review', icon: Search },       // Purple
  'tdd': { variant: 'success', icon: TestTube },    // Green
  test: { variant: 'info', icon: FileText },        // Blue
  docs: { variant: 'warning', icon: File },         // Orange/Yellow
  workflow: { variant: 'default', icon: Settings }, // Primary (blue-violet)
  'lite-plan': { variant: 'secondary', icon: FileText }, // Gray/Neutral
  'lite-fix': { variant: 'destructive', icon: Zap },    // Red
};

// Type label keys for i18n
const typeLabelKeys: Record<NonNullable<SessionMetadata['type']>, string> = {
  review: 'sessions.type.review',
  tdd: 'sessions.type.tdd',
  test: 'sessions.type.test',
  docs: 'sessions.type.docs',
  workflow: 'sessions.type.workflow',
  'lite-plan': 'sessions.type.lite-plan',
  'lite-fix': 'sessions.type.lite-fix',
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
 * Task status breakdown returned by calculateProgress
 */
interface TaskStatusBreakdown {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  inProgress: number;
  percentage: number;
}

/**
 * Calculate progress and status breakdown from tasks
 */
function calculateProgress(tasks: SessionMetadata['tasks']): TaskStatusBreakdown {
  if (!tasks || tasks.length === 0) {
    return { total: 0, completed: 0, failed: 0, pending: 0, inProgress: 0, percentage: 0 };
  }

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const failed = tasks.filter((t) => t.status === 'blocked' || t.status === 'skipped').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const percentage = Math.round((completed / total) * 100);

  return { total, completed, failed, pending, inProgress, percentage };
}

/**
 * Severity breakdown for review sessions
 */
interface SeverityBreakdown {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/**
 * Calculate severity breakdown from review dimensions
 */
function calculateSeverityBreakdown(review: SessionMetadata['review']): SeverityBreakdown {
  if (!review?.dimensions || review.dimensions.length === 0) {
    return { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
  }

  let critical = 0, high = 0, medium = 0, low = 0;

  review.dimensions.forEach(dim => {
    if (dim.findings) {
      dim.findings.forEach(finding => {
        const severity = finding.severity?.toLowerCase();
        if (severity === 'critical') critical++;
        else if (severity === 'high') high++;
        else if (severity === 'medium') medium++;
        else if (severity === 'low') low++;
      });
    }
  });

  const total = critical + high + medium + low;
  return { total, critical, high, medium, low };
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
  const { formatMessage } = useIntl();

  const { variant: statusVariant } = statusVariantConfig[session.status] || {
    variant: 'default' as const,
  };
  const statusLabel = statusLabelKeys[session.status]
    ? formatMessage({ id: statusLabelKeys[session.status] })
    : formatMessage({ id: 'common.status.unknown' });

  // Type badge configuration (graceful degradation when type is undefined)
  const typeConfig = session.type ? typeVariantConfig[session.type] : null;
  const typeLabel = session.type && typeLabelKeys[session.type]
    ? formatMessage({ id: typeLabelKeys[session.type] })
    : null;

  const progress = calculateProgress(session.tasks);
  const severity = calculateSeverityBreakdown(session.review);
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
        {/* Header - Type badge + Session ID as title */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {/* Type badge BEFORE title */}
              {typeConfig && typeLabel && (
                <Badge variant={typeConfig.variant} className="gap-1 flex-shrink-0">
                  <typeConfig.icon className="h-3 w-3" />
                  {typeLabel}
                </Badge>
              )}
              <h3 className="font-bold text-card-foreground text-sm tracking-wide uppercase truncate">
                {session.session_id}
              </h3>
            </div>
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
                    <span className="sr-only">{formatMessage({ id: 'common.aria.actions' })}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => handleAction(e, 'view')}>
                    <Eye className="mr-2 h-4 w-4" />
                    {formatMessage({ id: 'sessions.actions.viewDetails' })}
                  </DropdownMenuItem>
                  {!isArchived && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => handleAction(e, 'archive')}>
                        <Archive className="mr-2 h-4 w-4" />
                        {formatMessage({ id: 'sessions.actions.archive' })}
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => handleAction(e, 'delete')}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {formatMessage({ id: 'sessions.actions.delete' })}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Title as description */}
        {session.title && (
          <p className="text-sm text-foreground line-clamp-2 mb-3">
            {session.title}
          </p>
        )}

        {/* Meta info - different based on session type */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(session.created_at)}
          </span>

          {/* Review sessions: Show findings and dimensions */}
          {session.type === 'review' ? (
            <>
              {session.review?.dimensions && session.review.dimensions.length > 0 && (
                <span className="flex items-center gap-1">
                  <Search className="h-3.5 w-3.5" />
                  {session.review.dimensions.length} {formatMessage({ id: 'sessions.card.dimensions' })}
                </span>
              )}
              {session.review?.findings !== undefined && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {typeof session.review.findings === 'number'
                    ? session.review.findings
                    : session.review.dimensions?.reduce((sum, dim) => sum + (dim.findings?.length || 0), 0) || 0
                  } {formatMessage({ id: 'sessions.card.findings' })}
                </span>
              )}
            </>
          ) : (
            <>
              {/* Workflow/other sessions: Show tasks */}
              <span className="flex items-center gap-1">
                <ListChecks className="h-3.5 w-3.5" />
                {progress.total} {formatMessage({ id: 'sessions.card.tasks' })}
              </span>
              {progress.total > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  {progress.completed} {formatMessage({ id: 'sessions.card.completed' })}
                </span>
              )}
            </>
          )}
          {session.updated_at && session.updated_at !== session.created_at && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatMessage({ id: 'sessions.card.updated' })}: {formatDate(session.updated_at)}
            </span>
          )}
        </div>

        {/* Task status badges - only for non-review sessions */}
        {session.type !== 'review' && progress.total > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {progress.inProgress > 0 && (
              <Badge variant="info" className="gap-1 px-1.5 py-0 text-[10px]">
                <RefreshCw className="h-3 w-3" />
                {progress.inProgress} {formatMessage({ id: 'sessions.taskStatus.inProgress' })}
              </Badge>
            )}
            {progress.completed > 0 && (
              <Badge variant="success" className="gap-1 px-1.5 py-0 text-[10px]">
                <CheckCircle2 className="h-3 w-3" />
                {progress.completed} {formatMessage({ id: 'sessions.taskStatus.completed' })}
              </Badge>
            )}
            {progress.failed > 0 && (
              <Badge variant="destructive" className="gap-1 px-1.5 py-0 text-[10px]">
                <AlertCircle className="h-3 w-3" />
                {progress.failed} {formatMessage({ id: 'sessions.taskStatus.failed' })}
              </Badge>
            )}
          </div>
        )}

        {/* Severity badges - only for review sessions */}
        {session.type === 'review' && severity.total > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {severity.critical > 0 && (
              <Badge variant="destructive" className="gap-1 px-1.5 py-0 text-[10px]">
                <AlertCircle className="h-3 w-3" />
                {severity.critical} Critical
              </Badge>
            )}
            {severity.high > 0 && (
              <Badge variant="warning" className="gap-1 px-1.5 py-0 text-[10px]">
                <AlertCircle className="h-3 w-3" />
                {severity.high} High
              </Badge>
            )}
            {severity.medium > 0 && (
              <Badge variant="info" className="gap-1 px-1.5 py-0 text-[10px]">
                <Search className="h-3 w-3" />
                {severity.medium} Medium
              </Badge>
            )}
            {severity.low > 0 && (
              <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
                <FileText className="h-3 w-3" />
                {severity.low} Low
              </Badge>
            )}
          </div>
        )}

        {/* Progress bar (only show for non-review sessions with tasks) */}
        {session.type !== 'review' && progress.total > 0 && !isPlanning && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">{formatMessage({ id: 'sessions.card.progress' })}</span>
              <span className="text-card-foreground font-medium">
                {progress.completed}/{progress.total} ({progress.percentage}%)
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  progress.percentage === 100 ? "bg-success" : "bg-primary"
                )}
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Description (if exists and different from title) */}
        {session.description && session.description !== session.title && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2 italic">
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
        {/* Status badge skeletons */}
        <div className="mt-2 flex gap-1.5">
          <div className="h-5 w-16 rounded-full bg-muted" />
          <div className="h-5 w-20 rounded-full bg-muted" />
          <div className="h-5 w-18 rounded-full bg-muted" />
        </div>
        <div className="mt-3">
          <div className="h-1.5 w-full rounded-full bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
