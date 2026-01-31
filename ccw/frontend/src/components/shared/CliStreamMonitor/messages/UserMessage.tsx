// ========================================
// UserMessage Component
// ========================================

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { User, ChevronDown, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface UserMessageProps {
  content: string;
  timestamp?: number;
  onCopy?: () => void;
  onViewRaw?: () => void;
  className?: string;
}

export function UserMessage({
  content,
  timestamp,
  onCopy,
  onViewRaw,
  className
}: UserMessageProps) {
  const { formatMessage } = useIntl();
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const timeString = timestamp
    ? new Date(timestamp).toLocaleTimeString('en-US', { hour12: false })
    : '';

  // Auto-reset copied state
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = () => {
    onCopy?.();
    setCopied(true);
  };

  return (
    <div
      className={cn(
        'bg-blue-50/50 dark:bg-blue-950/30 border-l-4 border-blue-500 rounded-r-lg overflow-hidden transition-all',
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors',
          'group'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <User className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
          {formatMessage({ id: 'cliMonitor.user' })}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform ml-auto',
            !isExpanded && '-rotate-90'
          )}
        />
        {timeString && (
          <span className="text-xs text-muted-foreground ml-2">
            [{timeString}]
          </span>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <>
          <div className="px-3 py-2 bg-blue-50/30 dark:bg-blue-950/20">
            <div className="bg-white/50 dark:bg-black/20 rounded border border-blue-200/50 dark:border-blue-800/50 p-3">
              <pre className="text-sm text-foreground whitespace-pre-wrap break-words font-sans">
                {content}
              </pre>
            </div>
          </div>

          {/* Actions */}
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 bg-blue-50/30 dark:bg-blue-950/20',
              'justify-end'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  {formatMessage({ id: 'cliMonitor.copied' })}
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  {formatMessage({ id: 'cliMonitor.copy' })}
                </>
              )}
            </Button>
            {onViewRaw && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewRaw}
                className="h-7 px-2 text-xs"
              >
                {formatMessage({ id: 'cliMonitor.rawJson' })}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default UserMessage;
