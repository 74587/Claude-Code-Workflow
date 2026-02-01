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
    ? new Date(timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

  return (
    <div
      className={cn(
        'bg-slate-50/60 dark:bg-slate-950/40 border-l-2 border-slate-400 dark:border-slate-500 rounded-r-lg overflow-hidden transition-all',
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-slate-100/40 dark:hover:bg-slate-900/30 transition-colors group"
        onClick={() => content && setIsExpanded(!isExpanded)}
      >
        <Info className="h-3 w-3 text-slate-500 dark:text-slate-400 shrink-0" />
        <span className="text-xs font-medium text-foreground truncate flex-1">
          {title}
        </span>
        {timestamp && (
          <span className="text-[10px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {timeString}
          </span>
        )}
        {metadata && (
          <span className="text-[10px] text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity shrink-0">
            {metadata}
          </span>
        )}
        {content && (
          <ChevronRight
            className={cn(
              'h-3 w-3 text-muted-foreground transition-transform shrink-0',
              isExpanded && 'rotate-90'
            )}
          />
        )}
      </div>

      {/* Expandable Content */}
      {isExpanded && content && (
        <div className="px-2.5 py-2 bg-slate-50/40 dark:bg-slate-950/30 border-t border-slate-200/30 dark:border-slate-800/30">
          <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

export default SystemMessage;
