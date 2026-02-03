// ========================================
// PromptCard Component
// ========================================
// Card component for displaying prompt history items

import * as React from 'react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { QualityBadge } from '@/components/shared/QualityBadge';
import {
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
  Tag,
  Calendar,
} from 'lucide-react';
import type { Prompt } from '@/types/store';

export interface PromptCardProps {
  /** Prompt data */
  prompt: Prompt;
  /** Called when delete action is triggered */
  onDelete?: (id: string) => void;
  /** Optional className */
  className?: string;
  /** Disabled state for actions */
  actionsDisabled?: boolean;
  /** Default expanded state */
  defaultExpanded?: boolean;
  /** Selection state for batch operations */
  selected?: boolean;
  /** Called when selection state changes */
  onSelectChange?: (id: string, selected: boolean) => void;
  /** Whether selection mode is active */
  selectionMode?: boolean;
}

/**
 * Format date to readable string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format content length
 */
function formatContentLength(length: number): string {
  if (length >= 1000) {
    return `${(length / 1000).toFixed(1)}k chars`;
  }
  return `${length} chars`;
}

/**
 * PromptCard component for displaying prompt history items
 */
export function PromptCard({
  prompt,
  onDelete,
  className,
  actionsDisabled = false,
  defaultExpanded = false,
  selected = false,
  onSelectChange,
  selectionMode = false,
}: PromptCardProps) {
  const { formatMessage } = useIntl();
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy prompt');
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(prompt.id);
  };

  const toggleExpanded = () => {
    setExpanded((prev) => !prev);
  };

  const handleSelectionChange = (checked: boolean) => {
    onSelectChange?.(prompt.id, checked);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && (e.target as HTMLElement).closest('.prompt-card-checkbox')) {
      return;
    }
    if (selectionMode) {
      handleSelectionChange(!selected);
    }
  };

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        selected && 'ring-2 ring-primary',
        selectionMode && 'cursor-pointer',
        className
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Checkbox for selection mode */}
          {selectionMode && (
            <div className="prompt-card-checkbox">
              <Checkbox
                checked={selected}
                onCheckedChange={handleSelectionChange}
                className="mt-1"
              />
            </div>
          )}

          {/* Title and metadata */}
          <div className={cn('flex-1 min-w-0', !selectionMode && 'ml-0')}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-medium text-foreground truncate">
                {prompt.title || formatMessage({ id: 'prompts.card.untitled' })}
              </h3>
              {prompt.category && (
                <Badge variant="secondary" className="text-xs">
                  {prompt.category}
                </Badge>
              )}
              <QualityBadge qualityScore={prompt.quality_score} className="text-xs" />
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(prompt.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {formatContentLength(prompt.content.length)}
              </span>
              {prompt.useCount !== undefined && prompt.useCount > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatMessage({ id: 'prompts.card.used' }, { count: prompt.useCount })}
                </span>
              )}
            </div>

            {/* Tags */}
            {prompt.tags && prompt.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {prompt.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {prompt.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{prompt.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCopy}
              disabled={actionsDisabled}
              title={formatMessage({ id: 'prompts.actions.copy' })}
            >
              <Copy className="h-4 w-4" />
              <span className="sr-only">{formatMessage({ id: 'prompts.actions.copy' })}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={actionsDisabled}
              title={formatMessage({ id: 'prompts.actions.delete' })}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">{formatMessage({ id: 'prompts.actions.delete' })}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleExpanded}
              title={expanded ? formatMessage({ id: 'prompts.actions.collapse' }) : formatMessage({ id: 'prompts.actions.expand' })}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="sr-only">{expanded ? 'Collapse' : 'Expand'}</span>
            </Button>
          </div>
        </div>

        {copied && (
          <p className="text-xs text-success mt-2">
            {formatMessage({ id: 'prompts.actions.copied' })}
          </p>
        )}
      </CardHeader>

      {/* Expanded content */}
      {expanded && (
        <CardContent className="px-4 pb-4 pt-0">
          <div className="rounded-lg bg-muted/50 p-3">
            <pre className="text-sm whitespace-pre-wrap break-words text-foreground">
              {prompt.content}
            </pre>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default PromptCard;
