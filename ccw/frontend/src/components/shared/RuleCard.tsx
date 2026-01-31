// ========================================
// RuleCard Component
// ========================================
// Rule card with status badge and action menu

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
} from '@/components/ui/Dropdown';
import {
  FileCode,
  MoreVertical,
  Edit,
  Trash2,
  Folder,
  User,
  AlertCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { Rule } from '@/types/store';

export interface RuleCardProps {
  /** Rule data */
  rule: Rule;
  /** Called when edit action is triggered */
  onEdit?: (rule: Rule) => void;
  /** Called when delete action is triggered */
  onDelete?: (ruleId: string) => void;
  /** Called when toggle enabled is triggered */
  onToggle?: (ruleId: string, enabled: boolean) => void;
  /** Optional className */
  className?: string;
  /** Show actions dropdown */
  showActions?: boolean;
  /** Disabled state for actions */
  actionsDisabled?: boolean;
}

// Severity variant configuration (without labels for i18n)
const severityVariantConfig: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info'; icon: React.ReactNode }
> = {
  error: { variant: 'destructive' as const, icon: <AlertCircle className="h-3 w-3" /> },
  warning: { variant: 'warning' as const, icon: <AlertTriangle className="h-3 w-3" /> },
  info: { variant: 'info' as const, icon: <Info className="h-3 w-3" /> },
};

// Severity label keys for i18n
const severityLabelKeys: Record<string, string> = {
  error: 'rules.severity.error',
  warning: 'rules.severity.warning',
  info: 'rules.severity.info',
};

/**
 * RuleCard component for displaying rule information
 */
export function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
  className,
  showActions = true,
  actionsDisabled = false,
}: RuleCardProps) {
  const { formatMessage } = useIntl();

  const { variant: severityVariant, icon: severityIcon } = severityVariantConfig[rule.severity || 'info'] || {
    variant: 'default' as const,
    icon: null,
  };
  const severityLabel = rule.severity
    ? formatMessage({ id: severityLabelKeys[rule.severity] })
    : null;

  const locationIcon = rule.location === 'user' ? <User className="h-3 w-3" /> : <Folder className="h-3 w-3" />;

  const handleToggle = (enabled: boolean) => {
    onToggle?.(rule.id, enabled);
  };

  const handleAction = (e: React.MouseEvent, action: 'edit' | 'delete') => {
    e.stopPropagation();
    switch (action) {
      case 'edit':
        onEdit?.(rule);
        break;
      case 'delete':
        onDelete?.(rule.id);
        break;
    }
  };

  return (
    <Card
      className={cn(
        'group transition-all duration-200 hover:shadow-md hover:border-primary/30',
        !rule.enabled && 'opacity-60',
        className
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-card-foreground truncate">
                {rule.name}
              </h3>
              <div className="flex items-center gap-1 text-muted-foreground" title={formatMessage({ id: rule.location === 'user' ? 'rules.location.user' : 'rules.location.project' })}>
                {locationIcon}
              </div>
            </div>
            {rule.category && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {rule.category}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {rule.enabled && rule.severity && (
              <Badge variant={severityVariant} className="gap-1">
                {severityIcon}
                {severityLabel}
              </Badge>
            )}
            <Switch
              checked={rule.enabled}
              onCheckedChange={handleToggle}
              disabled={actionsDisabled}
              className="data-[state=checked]:bg-primary"
            />
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
                    {formatMessage({ id: 'rules.actions.edit' })}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => handleAction(e, 'delete')}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {formatMessage({ id: 'rules.actions.delete' })}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Description */}
        {rule.description && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            {rule.description}
          </p>
        )}

        {/* Meta info */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {rule.pattern && (
            <span className="flex items-center gap-1 font-mono">
              <FileCode className="h-3.5 w-3.5" />
              {rule.pattern}
            </span>
          )}
          {rule.subdirectory && (
            <span className="flex items-center gap-1">
              <Folder className="h-3.5 w-3.5" />
              {rule.subdirectory}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton loader for RuleCard
 */
export function RuleCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('animate-pulse', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="h-5 w-32 rounded bg-muted" />
            <div className="mt-1 h-3 w-24 rounded bg-muted" />
          </div>
          <div className="h-5 w-8 rounded-full bg-muted" />
          <div className="h-8 w-8 rounded bg-muted" />
        </div>
        <div className="mt-3 h-4 w-full rounded bg-muted" />
        <div className="mt-2 flex gap-4">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
