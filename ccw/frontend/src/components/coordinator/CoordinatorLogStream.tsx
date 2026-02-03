// ========================================
// Coordinator Log Stream Component
// ========================================
// Real-time log display with level filtering and auto-scroll

import { useEffect, useRef, useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { FileText } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Label } from '@/components/ui/Label';
import { useCoordinatorStore, type LogLevel, type CoordinatorLog } from '@/stores/coordinatorStore';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface CoordinatorLogStreamProps {
  maxHeight?: number;
  autoScroll?: boolean;
  showFilter?: boolean;
}

type LogLevelFilter = LogLevel | 'all';

// ========== Component ==========

export function CoordinatorLogStream({
  maxHeight = 400,
  autoScroll = true,
  showFilter = true,
}: CoordinatorLogStreamProps) {
  const { formatMessage } = useIntl();
  const { logs } = useCoordinatorStore();
  const [levelFilter, setLevelFilter] = useState<LogLevelFilter>('all');
  const logContainerRef = useRef<HTMLPreElement>(null);

  // Filter logs by level
  const filteredLogs = useMemo(() => {
    if (levelFilter === 'all') {
      return logs;
    }
    return logs.filter((log) => log.level === levelFilter);
  }, [logs, levelFilter]);

  // Auto-scroll to latest log
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  // Get log level color
  const getLogLevelColor = (level: LogLevel): string => {
    switch (level) {
      case 'error':
        return 'text-red-600';
      case 'warn':
        return 'text-yellow-600';
      case 'success':
        return 'text-green-600';
      case 'debug':
        return 'text-blue-600';
      case 'info':
      default:
        return 'text-gray-600';
    }
  };

  // Get log level background color
  const getLogLevelBgColor = (level: LogLevel): string => {
    switch (level) {
      case 'error':
        return 'bg-red-50';
      case 'warn':
        return 'bg-yellow-50';
      case 'success':
        return 'bg-green-50';
      case 'debug':
        return 'bg-blue-50';
      case 'info':
      default:
        return 'bg-gray-50';
    }
  };

  // Format log entry
  const formatLogEntry = (log: CoordinatorLog): string => {
    const timestamp = new Date(log.timestamp).toLocaleTimeString();
    const levelLabel = `[${log.level.toUpperCase()}]`;
    const source = log.source ? `[${log.source}]` : '';
    return `${timestamp} ${levelLabel} ${source} ${log.message}`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <CardTitle className="text-base">
              {formatMessage({ id: 'coordinator.logs' })}
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              ({filteredLogs.length} {formatMessage({ id: 'coordinator.entries' })})
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Level Filter */}
        {showFilter && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {formatMessage({ id: 'coordinator.logLevel' })}
            </Label>
            <RadioGroup
              value={levelFilter}
              onValueChange={(value) => setLevelFilter(value as LogLevelFilter)}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="level-all" />
                <Label htmlFor="level-all" className="cursor-pointer">
                  {formatMessage({ id: 'coordinator.level.all' })}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="info" id="level-info" />
                <Label htmlFor="level-info" className="cursor-pointer text-gray-600">
                  {formatMessage({ id: 'coordinator.level.info' })}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="warn" id="level-warn" />
                <Label htmlFor="level-warn" className="cursor-pointer text-yellow-600">
                  {formatMessage({ id: 'coordinator.level.warn' })}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="error" id="level-error" />
                <Label htmlFor="level-error" className="cursor-pointer text-red-600">
                  {formatMessage({ id: 'coordinator.level.error' })}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="debug" id="level-debug" />
                <Label htmlFor="level-debug" className="cursor-pointer text-blue-600">
                  {formatMessage({ id: 'coordinator.level.debug' })}
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Log Display */}
        <div className="space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
              {formatMessage({ id: 'coordinator.noLogs' })}
            </div>
          ) : (
            <pre
              ref={logContainerRef}
              className={cn(
                'w-full p-3 bg-muted rounded-lg text-xs overflow-y-auto whitespace-pre-wrap break-words font-mono'
              )}
              style={{ maxHeight: `${maxHeight}px` }}
            >
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    'py-1 px-2 mb-1 rounded',
                    getLogLevelBgColor(log.level)
                  )}
                >
                  <span className={getLogLevelColor(log.level)}>
                    {formatLogEntry(log)}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default CoordinatorLogStream;
