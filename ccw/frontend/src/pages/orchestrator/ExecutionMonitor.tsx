// ========================================
// Execution Monitor
// ========================================
// Real-time execution monitoring panel with logs and controls

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Play,
  Pause,
  Square,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Terminal,
  ArrowDownToLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useExecutionStore } from '@/stores/executionStore';
import {
  useExecuteFlow,
  usePauseExecution,
  useResumeExecution,
  useStopExecution,
} from '@/hooks/useFlows';
import { useFlowStore } from '@/stores';
import type { ExecutionStatus, LogLevel } from '@/types/execution';

// ========== Helper Functions ==========

function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function getStatusBadgeVariant(status: ExecutionStatus): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' {
  switch (status) {
    case 'running':
      return 'default';
    case 'paused':
      return 'warning';
    case 'completed':
      return 'success';
    case 'failed':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function getStatusIcon(status: ExecutionStatus) {
  switch (status) {
    case 'running':
      return <Loader2 className="h-3 w-3 animate-spin" />;
    case 'paused':
      return <Pause className="h-3 w-3" />;
    case 'completed':
      return <CheckCircle2 className="h-3 w-3" />;
    case 'failed':
      return <AlertCircle className="h-3 w-3" />;
    default:
      return <Clock className="h-3 w-3" />;
  }
}

function getLogLevelColor(level: LogLevel): string {
  switch (level) {
    case 'error':
      return 'text-red-500';
    case 'warn':
      return 'text-yellow-500';
    case 'info':
      return 'text-blue-500';
    case 'debug':
      return 'text-gray-400';
    default:
      return 'text-foreground';
  }
}

// ========== Component ==========

interface ExecutionMonitorProps {
  className?: string;
}

export function ExecutionMonitor({ className }: ExecutionMonitorProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // Execution store state
  const currentExecution = useExecutionStore((state) => state.currentExecution);
  const logs = useExecutionStore((state) => state.logs);
  const nodeStates = useExecutionStore((state) => state.nodeStates);
  const isMonitorExpanded = useExecutionStore((state) => state.isMonitorExpanded);
  const autoScrollLogs = useExecutionStore((state) => state.autoScrollLogs);
  const setMonitorExpanded = useExecutionStore((state) => state.setMonitorExpanded);
  const setAutoScrollLogs = useExecutionStore((state) => state.setAutoScrollLogs);
  const startExecution = useExecutionStore((state) => state.startExecution);

  // Local state for elapsed time (calculated from startedAt)
  const [elapsedMs, setElapsedMs] = useState(0);

  // Flow store state
  const currentFlow = useFlowStore((state) => state.currentFlow);
  const nodes = useFlowStore((state) => state.nodes);

  // Mutations
  const executeFlow = useExecuteFlow();
  const pauseExecution = usePauseExecution();
  const resumeExecution = useResumeExecution();
  const stopExecution = useStopExecution();

  // Update elapsed time every second while running (calculated from startedAt)
  useEffect(() => {
    if (currentExecution?.status === 'running' && currentExecution.startedAt) {
      const calculateElapsed = () => {
        const startTime = new Date(currentExecution.startedAt).getTime();
        setElapsedMs(Date.now() - startTime);
      };

      // Calculate immediately
      calculateElapsed();

      // Update every second
      const interval = setInterval(calculateElapsed, 1000);
      return () => clearInterval(interval);
    } else if (currentExecution?.completedAt) {
      // Use final elapsed time from store when completed
      setElapsedMs(currentExecution.elapsedMs);
    } else if (!currentExecution) {
      setElapsedMs(0);
    }
  }, [currentExecution?.status, currentExecution?.startedAt, currentExecution?.completedAt, currentExecution?.elapsedMs]);

  // Auto-scroll logs
  useEffect(() => {
    if (autoScrollLogs && !isUserScrolling && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScrollLogs, isUserScrolling]);

  // Handle scroll to detect user scrolling
  const handleScroll = useCallback(() => {
    if (!logsContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    setIsUserScrolling(!isAtBottom);
  }, []);

  // Scroll to bottom handler
  const scrollToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsUserScrolling(false);
  }, []);

  // Handle execute
  const handleExecute = useCallback(async () => {
    if (!currentFlow) return;

    try {
      const result = await executeFlow.mutateAsync(currentFlow.id);
      startExecution(result.execId, currentFlow.id);
    } catch (error) {
      console.error('Failed to execute flow:', error);
    }
  }, [currentFlow, executeFlow, startExecution]);

  // Handle pause
  const handlePause = useCallback(async () => {
    if (!currentExecution) return;
    try {
      await pauseExecution.mutateAsync(currentExecution.execId);
    } catch (error) {
      console.error('Failed to pause execution:', error);
    }
  }, [currentExecution, pauseExecution]);

  // Handle resume
  const handleResume = useCallback(async () => {
    if (!currentExecution) return;
    try {
      await resumeExecution.mutateAsync(currentExecution.execId);
    } catch (error) {
      console.error('Failed to resume execution:', error);
    }
  }, [currentExecution, resumeExecution]);

  // Handle stop
  const handleStop = useCallback(async () => {
    if (!currentExecution) return;
    try {
      await stopExecution.mutateAsync(currentExecution.execId);
    } catch (error) {
      console.error('Failed to stop execution:', error);
    }
  }, [currentExecution, stopExecution]);

  // Calculate node progress
  const completedNodes = Object.values(nodeStates).filter(
    (state) => state.status === 'completed'
  ).length;
  const totalNodes = nodes.length;
  const progressPercent = totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0;

  const isExecuting = currentExecution?.status === 'running';
  const isPaused = currentExecution?.status === 'paused';
  const canExecute = currentFlow && !isExecuting && !isPaused;

  return (
    <div
      className={cn(
        'border-t border-border bg-card transition-all duration-300',
        isMonitorExpanded ? 'h-64' : 'h-12',
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-12 border-b border-border cursor-pointer"
        onClick={() => setMonitorExpanded(!isMonitorExpanded)}
      >
        <div className="flex items-center gap-3">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Execution Monitor</span>

          {currentExecution && (
            <>
              <Badge variant={getStatusBadgeVariant(currentExecution.status)}>
                <span className="flex items-center gap-1">
                  {getStatusIcon(currentExecution.status)}
                  {currentExecution.status}
                </span>
              </Badge>

              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatElapsedTime(elapsedMs)}
              </span>

              {totalNodes > 0 && (
                <span className="text-sm text-muted-foreground">
                  {completedNodes}/{totalNodes} nodes
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Control buttons */}
          {canExecute && (
            <Button
              size="sm"
              variant="default"
              onClick={(e) => {
                e.stopPropagation();
                handleExecute();
              }}
              disabled={executeFlow.isPending}
            >
              <Play className="h-4 w-4 mr-1" />
              Execute
            </Button>
          )}

          {isExecuting && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePause();
                }}
                disabled={pauseExecution.isPending}
              >
                <Pause className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStop();
                }}
                disabled={stopExecution.isPending}
              >
                <Square className="h-4 w-4" />
              </Button>
            </>
          )}

          {isPaused && (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResume();
                }}
                disabled={resumeExecution.isPending}
              >
                <Play className="h-4 w-4 mr-1" />
                Resume
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStop();
                }}
                disabled={stopExecution.isPending}
              >
                <Square className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Expand/collapse button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setMonitorExpanded(!isMonitorExpanded);
            }}
          >
            {isMonitorExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      {isMonitorExpanded && (
        <div className="flex h-[calc(100%-3rem)]">
          {/* Progress bar */}
          {currentExecution && (
            <div className="absolute top-12 left-0 right-0 h-1 bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          {/* Logs panel */}
          <div className="flex-1 flex flex-col relative">
            {/* Logs container */}
            <div
              ref={logsContainerRef}
              className="flex-1 overflow-y-auto p-3 font-mono text-xs"
              onScroll={handleScroll}
            >
              {logs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {currentExecution
                    ? 'Waiting for logs...'
                    : 'Select a flow and click Execute to start'}
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={cn(
                          'uppercase w-12 shrink-0',
                          getLogLevelColor(log.level)
                        )}
                      >
                        [{log.level}]
                      </span>
                      {log.nodeId && (
                        <span className="text-purple-500 shrink-0">
                          [{log.nodeId}]
                        </span>
                      )}
                      <span className="text-foreground break-all">
                        {log.message}
                      </span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>

            {/* Scroll to bottom button */}
            {isUserScrolling && logs.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                className="absolute bottom-3 right-3"
                onClick={scrollToBottom}
              >
                <ArrowDownToLine className="h-4 w-4 mr-1" />
                Scroll to bottom
              </Button>
            )}
          </div>

          {/* Node states panel (collapsed by default) */}
          {currentExecution && Object.keys(nodeStates).length > 0 && (
            <div className="w-48 border-l border-border p-2 overflow-y-auto">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Node Status
              </div>
              <div className="space-y-1">
                {Object.entries(nodeStates).map(([nodeId, state]) => (
                  <div
                    key={nodeId}
                    className="flex items-center gap-2 text-xs p-1 rounded hover:bg-muted"
                  >
                    {state.status === 'running' && (
                      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    )}
                    {state.status === 'completed' && (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    )}
                    {state.status === 'failed' && (
                      <AlertCircle className="h-3 w-3 text-red-500" />
                    )}
                    {state.status === 'pending' && (
                      <Clock className="h-3 w-3 text-gray-400" />
                    )}
                    <span className="truncate" title={nodeId}>
                      {nodeId.slice(0, 20)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ExecutionMonitor;
