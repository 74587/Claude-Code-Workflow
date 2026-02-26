// ========================================
// SpecCard Component
// ========================================
// Spec card with readMode badge, keywords, priority indicator and action menu

import * as React from 'react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu';
import {
  MoreVertical,
  Edit,
  Trash2,
  FileText,
  Tag,
} from 'lucide-react';

// ========== Types ==========

/**
 * Spec dimension type
 */
export type SpecDimension = 'specs' | 'personal';

/**
 * Spec read mode type
 */
export type SpecReadMode = 'required' | 'optional';

/**
 * Spec priority type
 */
export type SpecPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Spec data structure
 */
export interface Spec {
  /** Unique spec identifier */
  id: string;
  /** Spec title (display name) */
  title: string;
  /** Spec file path */
  file: string;
  /** Spec dimension/category */
  dimension: SpecDimension;
  /** Read mode: required (always inject) or optional (keyword match) */
  readMode: SpecReadMode;
  /** Priority level */
  priority: SpecPriority;
  /** Keywords for matching (optional specs) */
  keywords: string[];
  /** Whether spec is enabled */
  enabled: boolean;
  /** Optional description */
  description?: string;
}

/**
 * SpecCard component props
 */
export interface SpecCardProps {
  /** Spec data */
  spec: Spec;
  /** Called when edit action is triggered */
  onEdit?: (spec: Spec) => void;
  /** Called when delete action is triggered */
  onDelete?: (specId: string) => void;
  /** Called when toggle enabled is triggered */
  onToggle?: (specId: string, enabled: boolean) => void;
  /** Optional className */
  className?: string;
  /** Show actions dropdown */
  showActions?: boolean;
  /** Disabled state for actions */
  actionsDisabled?: boolean;
}

// ========== Configuration ==========

// Read mode badge configuration
const readModeConfig: Record<
  SpecReadMode,
  { variant: 'default' | 'secondary'; labelKey: string }
> = {
  required: { variant: 'default', labelKey: 'specs.readMode.required' },
  optional: { variant: 'secondary', labelKey: 'specs.readMode.optional' },
};

// Priority badge configuration
const priorityConfig: Record<
  SpecPriority,
  { variant: 'destructive' | 'warning' | 'info' | 'secondary'; labelKey: string }
> = {
  critical: { variant: 'destructive', labelKey: 'specs.priority.critical' },
  high: { variant: 'warning', labelKey: 'specs.priority.high' },
  medium: { variant: 'info', labelKey: 'specs.priority.medium' },
  low: { variant: 'secondary', labelKey: 'specs.priority.low' },
};

// ========== Component ==========

/**
 * SpecCard component for displaying spec information
 */
export function SpecCard({
  spec,
  onEdit,
  onDelete,
  onToggle,
  className,
  showActions = true,
  actionsDisabled = false,
}: SpecCardProps) {
  const { formatMessage } = useIntl();

  const readMode = readModeConfig[spec.readMode];
  const priority = priorityConfig[spec.priority];

  const handleToggle = (enabled: boolean) => {
    onToggle?.(spec.id, enabled);
  };

  const handleAction = (e: React.MouseEvent, action: 'edit' | 'delete') => {
    e.stopPropagation();
    switch (action) {
      case 'edit':
        onEdit?.(spec);
        break;
      case 'delete':
        onDelete?.(spec.id);
        break;
    }
  };

  return (
    <Card
      className={cn(
        'group transition-all duration-200 hover:shadow-md hover:border-primary/30 hover-glow',
        !spec.enabled && 'opacity-60',
        className
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <h3 className="font-medium text-card-foreground truncate">
                {spec.title}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {spec.file}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
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
                  <DropdownMenuItem onClick={(e) => handleAction(e, 'edit')}>
                    <Edit className="mr-2 h-4 w-4" />
                    {formatMessage({ id: 'specs.actions.edit' })}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => handleAction(e, 'delete')}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {formatMessage({ id: 'specs.actions.delete' })}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={readMode.variant} className="text-xs">
            {formatMessage({ id: readMode.labelKey })}
          </Badge>
          <Badge variant={priority.variant} className="text-xs">
            {formatMessage({ id: priority.labelKey })}
          </Badge>
        </div>

        {/* Description */}
        {spec.description && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            {spec.description}
          </p>
        )}

        {/* Keywords */}
        {spec.keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            {spec.keywords.slice(0, 4).map((keyword) => (
              <Badge key={keyword} variant="outline" className="text-xs px-1.5 py-0">
                {keyword}
              </Badge>
            ))}
            {spec.keywords.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{spec.keywords.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Footer with toggle */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {formatMessage({ id: spec.enabled ? 'specs.status.enabled' : 'specs.status.disabled' })}
          </span>
          <Switch
            checked={spec.enabled}
            onCheckedChange={handleToggle}
            disabled={actionsDisabled}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton loader for SpecCard
 */
export function SpecCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('animate-pulse', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-muted" />
              <div className="h-5 w-32 rounded bg-muted" />
            </div>
            <div className="mt-1 h-3 w-24 rounded bg-muted" />
          </div>
          <div className="h-8 w-8 rounded bg-muted" />
        </div>
        <div className="mt-3 flex gap-2">
          <div className="h-5 w-14 rounded-full bg-muted" />
          <div className="h-5 w-12 rounded-full bg-muted" />
        </div>
        <div className="mt-3 h-4 w-full rounded bg-muted" />
        <div className="mt-2 flex gap-1.5">
          <div className="h-5 w-16 rounded bg-muted" />
          <div className="h-5 w-14 rounded bg-muted" />
          <div className="h-5 w-12 rounded bg-muted" />
        </div>
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <div className="h-3 w-16 rounded bg-muted" />
          <div className="h-5 w-9 rounded-full bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

export default SpecCard;
