// ========================================
// TimelineNode Component
// ========================================
// Individual node card in the coordinator pipeline timeline

import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { CommandNode } from '@/stores/coordinatorStore';

export interface TimelineNodeProps {
  node: CommandNode;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Individual timeline node card with status indicator and expandable details
 */
export function TimelineNode({ node, isActive = false, onClick, className }: TimelineNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get status icon
  const getStatusIcon = () => {
    const iconClassName = 'h-5 w-5 shrink-0';
    switch (node.status) {
      case 'completed':
        return <CheckCircle className={cn(iconClassName, 'text-green-500')} />;
      case 'failed':
        return <XCircle className={cn(iconClassName, 'text-red-500')} />;
      case 'running':
        return <Loader2 className={cn(iconClassName, 'text-blue-500 animate-spin')} />;
      case 'skipped':
        return <XCircle className={cn(iconClassName, 'text-yellow-500')} />;
      case 'pending':
      default:
        return <Clock className={cn(iconClassName, 'text-gray-400')} />;
    }
  };

  // Get status badge variant
  const getStatusBadge = () => {
    switch (node.status) {
      case 'completed':
        return <Badge variant="success">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge variant="info">Running</Badge>;
      case 'skipped':
        return <Badge variant="warning">Skipped</Badge>;
      case 'pending':
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  // Format timestamp
  const formatTime = (timestamp?: string) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString();
  };

  // Calculate duration
  const getDuration = () => {
    if (!node.startedAt || !node.completedAt) return null;
    const start = new Date(node.startedAt).getTime();
    const end = new Date(node.completedAt).getTime();
    const durationMs = end - start;

    if (durationMs < 1000) return `${durationMs}ms`;
    const seconds = Math.floor(durationMs / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const hasDetails = Boolean(node.output || node.error || node.result);

  return (
    <Card
      className={cn(
        'w-64 shrink-0 cursor-pointer transition-all duration-300',
        'hover:shadow-lg hover:scale-105',
        isActive && 'ring-2 ring-primary',
        isExpanded && 'w-80',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {getStatusIcon()}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-foreground truncate" title={node.name}>
                {node.name}
              </h4>
              {node.description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5" title={node.description}>
                  {node.description}
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0">
            {getStatusBadge()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {/* Timing information */}
        {(node.startedAt || node.completedAt) && (
          <div className="text-xs text-muted-foreground space-y-0.5 mb-2">
            {node.startedAt && (
              <div>Started: {formatTime(node.startedAt)}</div>
            )}
            {node.completedAt && (
              <div>Completed: {formatTime(node.completedAt)}</div>
            )}
            {getDuration() && (
              <div className="font-medium">Duration: {getDuration()}</div>
            )}
          </div>
        )}

        {/* Expand/collapse toggle for details */}
        {hasDetails && (
          <>
            <button
              onClick={handleToggleExpand}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors w-full"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show details
                </>
              )}
            </button>

            {/* Expanded details panel */}
            {isExpanded && (
              <div className="mt-2 space-y-2">
                {/* Error message */}
                {node.error && (
                  <div className="p-2 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                    <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                      Error:
                    </div>
                    <div className="text-xs text-red-600 dark:text-red-300 break-words">
                      {node.error}
                    </div>
                  </div>
                )}

                {/* Output */}
                {Boolean(node.output) && (
                  <div className="p-2 rounded-md bg-muted/50 border border-border">
                    <div className="text-xs font-semibold text-foreground mb-1">
                      Output:
                    </div>
                    <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                      {String(node.output)}
                    </pre>
                  </div>
                )}

                {/* Result */}
                {Boolean(node.result) && (
                  <div className="p-2 rounded-md bg-muted/50 border border-border">
                    <div className="text-xs font-semibold text-foreground mb-1">
                      Result:
                    </div>
                    <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                      {typeof node.result === 'object' && node.result !== null
                        ? JSON.stringify(node.result, null, 2)
                        : String(node.result)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Command information */}
        {node.command && !isExpanded && (
          <div className="mt-2 text-xs text-muted-foreground truncate" title={node.command}>
            <span className="font-mono">{node.command}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TimelineNode;
