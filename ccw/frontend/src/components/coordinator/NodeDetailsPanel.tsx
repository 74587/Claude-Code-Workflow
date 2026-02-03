// ========================================
// Node Details Panel Component
// ========================================
// Expandable panel showing node logs, error information, and retry/skip actions

import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { Loader2, RotateCcw, SkipForward, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCoordinatorStore, type CommandNode } from '@/stores/coordinatorStore';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface NodeDetailsPanelProps {
  node: CommandNode;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

// ========== Component ==========

export function NodeDetailsPanel({
  node,
  isExpanded = true,
  onToggle,
}: NodeDetailsPanelProps) {
  const { formatMessage } = useIntl();
  const { retryNode, skipNode, logs } = useCoordinatorStore();
  const [expanded, setExpanded] = useState(isExpanded);
  const [isLoading, setIsLoading] = useState(false);
  const logScrollRef = useRef<HTMLPreElement>(null);

  // Filter logs for this node
  const nodeLogs = logs.filter((log) => log.nodeId === node.id);

  // Auto-scroll to latest log
  useEffect(() => {
    if (expanded && logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [expanded, nodeLogs]);

  // Handle expand/collapse
  const handleToggle = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onToggle?.(newExpanded);
  };

  // Handle retry
  const handleRetry = async () => {
    setIsLoading(true);
    try {
      await retryNode(node.id);
    } catch (error) {
      console.error('Failed to retry node:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle skip
  const handleSkip = async () => {
    setIsLoading(true);
    try {
      await skipNode(node.id);
    } catch (error) {
      console.error('Failed to skip node:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'running':
        return 'text-blue-600';
      case 'skipped':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  // Get status label
  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending: 'coordinator.status.pending',
      running: 'coordinator.status.running',
      completed: 'coordinator.status.completed',
      failed: 'coordinator.status.failed',
      skipped: 'coordinator.status.skipped',
    };
    return labels[status] || status;
  };

  return (
    <Card className="w-full">
      <CardHeader className="cursor-pointer" onClick={handleToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <button
              className="inline-flex items-center justify-center"
              onClick={handleToggle}
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            <CardTitle className="text-lg">
              {node.name}
            </CardTitle>
            <span className={cn('text-sm font-medium', getStatusColor(node.status))}>
              {formatMessage({ id: getStatusLabel(node.status) })}
            </span>
          </div>
        </div>
        {node.description && (
          <p className="text-sm text-muted-foreground mt-2">{node.description}</p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Logs Section */}
          {nodeLogs.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">
                {formatMessage({ id: 'coordinator.logs' })}
              </h4>
              <pre
                ref={logScrollRef}
                className="w-full p-3 bg-muted rounded-lg text-xs overflow-y-auto max-h-[200px] whitespace-pre-wrap break-words font-mono"
              >
                {nodeLogs
                  .map((log) => {
                    const timestamp = new Date(log.timestamp).toLocaleTimeString();
                    const levelLabel = `[${log.level.toUpperCase()}]`;
                    return `${timestamp} ${levelLabel} ${log.message}`;
                  })
                  .join('\n')}
              </pre>
            </div>
          )}

          {/* Error Information */}
          {node.error && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-red-600">
                {formatMessage({ id: 'coordinator.error' })}
              </h4>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                {node.error}
              </div>
            </div>
          )}

          {/* Output Section */}
          {node.output && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">
                {formatMessage({ id: 'coordinator.output' })}
              </h4>
              <pre className="w-full p-3 bg-muted rounded-lg text-xs overflow-y-auto max-h-[150px] whitespace-pre-wrap break-words font-mono">
                {node.output}
              </pre>
            </div>
          )}

          {/* Node Information */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {node.startedAt && (
              <div>
                <span className="font-semibold text-muted-foreground">
                  {formatMessage({ id: 'coordinator.startedAt' })}:
                </span>
                <p>{new Date(node.startedAt).toLocaleString()}</p>
              </div>
            )}
            {node.completedAt && (
              <div>
                <span className="font-semibold text-muted-foreground">
                  {formatMessage({ id: 'coordinator.completedAt' })}:
                </span>
                <p>{new Date(node.completedAt).toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {node.status === 'failed' && (
            <div className="flex gap-2 pt-4 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    {formatMessage({ id: 'coordinator.retrying' })}
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3 h-3 mr-2" />
                    {formatMessage({ id: 'coordinator.retry' })}
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSkip}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    {formatMessage({ id: 'coordinator.skipping' })}
                  </>
                ) : (
                  <>
                    <SkipForward className="w-3 h-3 mr-2" />
                    {formatMessage({ id: 'coordinator.skip' })}
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default NodeDetailsPanel;
