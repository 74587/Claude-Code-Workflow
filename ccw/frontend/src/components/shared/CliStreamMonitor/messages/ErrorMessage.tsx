// ========================================
// ErrorMessage Component
// ========================================

import { useIntl } from 'react-intl';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface ErrorMessageProps {
  title: string;
  message: string;
  timestamp?: number;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorMessage({
  title,
  message,
  timestamp,
  onRetry,
  onDismiss,
  className
}: ErrorMessageProps) {
  const { formatMessage } = useIntl();
  const timeString = timestamp
    ? new Date(timestamp).toLocaleTimeString('en-US', { hour12: false })
    : '';

  return (
    <div
      className={cn(
        'bg-destructive/10 border-l-4 border-destructive rounded-r-lg overflow-hidden transition-all',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
        {timeString && (
          <span className="text-xs text-muted-foreground shrink-0">
            [{timeString}]
          </span>
        )}
        <span className="text-sm font-semibold text-destructive">
          {title}
        </span>
      </div>

      {/* Content */}
      <div className="px-3 py-2 bg-destructive/5">
        <p className="text-sm text-destructive-foreground whitespace-pre-wrap break-words">
          {message}
        </p>
      </div>

      {/* Actions */}
      {(onRetry || onDismiss) && (
        <div className="flex items-center gap-2 px-3 py-2 bg-destructive/5">
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="h-8 px-3 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              {formatMessage({ id: 'cliMonitor.retry' })}
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              {formatMessage({ id: 'cliMonitor.dismiss' })}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default ErrorMessage;
