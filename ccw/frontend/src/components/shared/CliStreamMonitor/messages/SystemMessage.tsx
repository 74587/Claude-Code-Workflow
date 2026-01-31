// ========================================
// SystemMessage Component
// ========================================

import { useState } from 'react';
import { Info, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SystemMessageProps {
  title: string;
  timestamp?: number;
  metadata?: string;
  content?: string;
  className?: string;
}

export function SystemMessage({
  title,
  timestamp,
  metadata,
  content,
  className
}: SystemMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const timeString = timestamp
    ? new Date(timestamp).toLocaleTimeString('en-US', { hour12: false })
    : '';

  return (
    <div
      className={cn(
        'bg-muted/30 dark:bg-muted/20 border-l-2 border-info rounded-r-lg overflow-hidden transition-all',
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => content && setIsExpanded(!isExpanded)}
      >
        <Info className="h-3.5 w-3.5 text-info shrink-0" />
        <span className="text-xs text-muted-foreground shrink-0">
          [{timeString}]
        </span>
        <span className="text-sm font-medium text-foreground truncate flex-1">
          {title}
        </span>
        {metadata && (
          <span className="text-xs text-muted-foreground">
            {metadata}
          </span>
        )}
        {content && (
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform',
              isExpanded && 'rotate-90'
            )}
          />
        )}
      </div>

      {/* Expandable Content */}
      {isExpanded && content && (
        <div className="px-3 py-2 bg-muted/20 border-t border-border/50">
          <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

export default SystemMessage;
