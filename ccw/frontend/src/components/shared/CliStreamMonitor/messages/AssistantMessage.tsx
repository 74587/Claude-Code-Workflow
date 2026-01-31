// ========================================
// AssistantMessage Component
// ========================================

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Bot, ChevronDown, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

// Status indicator component
interface StatusIndicatorProps {
  status: 'thinking' | 'streaming' | 'completed' | 'error';
  duration?: number;
}

function StatusIndicator({ status, duration }: StatusIndicatorProps) {
  const { formatMessage } = useIntl();

  if (status === 'thinking') {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
        {formatMessage({ id: 'cliMonitor.thinking' })}
        <span className="animate-pulse">🟡</span>
      </span>
    );
  }

  if (status === 'streaming') {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
        {formatMessage({ id: 'cliMonitor.streaming' })}
        <span className="animate-pulse">🔵</span>
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
        Error
        <span>❌</span>
      </span>
    );
  }

  if (duration !== undefined) {
    const seconds = (duration / 1000).toFixed(1);
    return (
      <span className="text-xs text-muted-foreground">
        {seconds}s
      </span>
    );
  }

  return null;
}

// Format duration helper
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export interface AssistantMessageProps {
  content: string;
  modelName?: string;
  status?: 'thinking' | 'streaming' | 'completed' | 'error';
  duration?: number;
  tokenCount?: number;
  timestamp?: number;
  onCopy?: () => void;
  className?: string;
}

export function AssistantMessage({
  content,
  modelName = 'AI',
  status = 'completed',
  duration,
  tokenCount,
  // timestamp is kept for future use but not currently displayed
  // timestamp,
  onCopy,
  className
}: AssistantMessageProps) {
  const { formatMessage } = useIntl();
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

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
        'bg-purple-50/50 dark:bg-purple-950/30 border-l-4 border-purple-500 rounded-r-lg overflow-hidden transition-all',
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition-colors',
          'group'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
        <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">
          {modelName}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          <StatusIndicator status={status} duration={duration} />
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform',
              !isExpanded && '-rotate-90'
            )}
          />
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <>
          <div className="px-3 py-2 bg-purple-50/30 dark:bg-purple-950/20">
            <div className="bg-white/50 dark:bg-black/20 rounded border border-purple-200/50 dark:border-purple-800/50 p-3">
              <div className="text-sm text-foreground whitespace-pre-wrap break-words">
                {content}
              </div>
            </div>
          </div>

          {/* Metadata Footer */}
          <div
            className={cn(
              'flex items-center gap-3 px-3 py-1.5 bg-purple-50/30 dark:bg-purple-950/20',
              'text-xs text-muted-foreground',
              'justify-between'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              {tokenCount !== undefined && (
                <span>{formatMessage({ id: 'cliMonitor.tokens' }, { count: tokenCount.toLocaleString() })}</span>
              )}
              {duration !== undefined && (
                <span>{formatMessage({ id: 'cliMonitor.duration' }, { value: formatDuration(duration) })}</span>
              )}
              {modelName && <span>{formatMessage({ id: 'cliMonitor.model' }, { name: modelName })}</span>}
            </div>

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
          </div>
        </>
      )}
    </div>
  );
}

export default AssistantMessage;
