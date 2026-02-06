// ========================================
// Execution Monitor
// ========================================
// Right-side slide-out panel for real-time execution monitoring

import { useEffect, useRef, useCallback, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Play,
  Pause,
  Square,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Terminal,
  ArrowDownToLine,
  X,
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
  const { formatMessage } = useIntl();

  // Execution store state
  const currentExecution = useExecutionStore((state) => state.currentExecution);
  const logs = useExecutionStore((state) => state.logs);
  const nodeStates = useExecutionStore((state) => state.nodeStates);
  const isMonitorPanelOpen = useExecutionStore((state) => state.isMonitorPanelOpen);
  const autoScrollLogs = useExecutionStore((state) => state.autoScrollLogs);
  const setMonitorPanelOpen = useExecutionStore((state) => state.setMonitorPanelOpen);
  const startExecution = useExecutionStore((state) => state.startExecution);

  // Local state for elapsed time
  const [elapsedMs, setElapsedMs] = useState(0);

  // Flow store state
  const currentFlow = useFlowStore((state) => state.currentFlow);
  const nodes = useFlowStore((state) => state.nodes);

  // Mutations
  const executeFlow = useExecuteFlow();
  const pauseExecution = usePauseExecution();
  const resumeExecution = useResumeExecution();
  const stopExecution = useStopExecution();

  // Update elapsed time every second while running
  useEffect(() => {
    if (currentExecution?.status === 'running' && currentExecution.startedAt) {
      const calculateElapsed = () => {
        const startTime = new Date(currentExecution.startedAt).getTime();
        setElapsedMs(Date.now() - startTime);
      };
      calculateElapsed();
      const interval = setInterval(calculateElapsed, 1000);
      return () => clearInterval(interval);
    } else if (currentExecution?.completedAt) {
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

  if (!isMonitorPanelOpen) return null;

  return (
    <div
      className={cn(
        'w-[50%] border-l border-border bg-card flex flex-col h-full',
        'animate-in slide-in-from-right duration-300',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{formatMessage({ id: 'orchestrator.monitor.title' })}</span>
          {currentExecution && (
            <Badge variant={getStatusBadgeVariant(currentExecution.status)} className="shrink-0">
              <span className="flex items-center gap-1">
                {getStatusIcon(currentExecution.status)}
                {formatMessage({ id: `orchestrator.status.${currentExecution.status}` })}
              </span>
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 shrink-0"
          onClick={() => setMonitorPanelOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        {canExecute && (
          <Button
            size="sm"
            variant="default"
            onClick={handleExecute}
            disabled={executeFlow.isPending}
            className="flex-1"
          >
            <Play className="h-4 w-4 mr-1" />
            {formatMessage({ id: 'orchestrator.actions.execute' })}
          </Button>
        )}

        {isExecuting && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePause}
              disabled={pauseExecution.isPending}
            >
              <Pause className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleStop}
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
              onClick={handleResume}
              disabled={resumeExecution.isPending}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-1" />
              {formatMessage({ id: 'orchestrator.execution.resume' })}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleStop}
              disabled={stopExecution.isPending}
            >
              <Square className="h-4 w-4" />
            </Button>
          </>
        )}

        {currentExecution && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
            <Clock className="h-3 w-3" />
            {formatElapsedTime(elapsedMs)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {currentExecution && (
        <div className="h-1 bg-muted shrink-0">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Node status */}
      {currentExecution && Object.keys(nodeStates).length > 0 && (
        <div className="px-3 py-2 border-b border-border shrink-0">
          <div className="text-xs font-medium text-muted-foreground mb-1.5">
            {formatMessage({ id: 'orchestrator.node.statusCount' }, { completed: completedNodes, total: totalNodes })}
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {Object.entries(nodeStates).map(([nodeId, state]) => (
              <div
                key={nodeId}
                className="flex items-center gap-2 text-xs p-1 rounded hover:bg-muted"
              >
                {state.status === 'running' && (
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />
                )}
                {state.status === 'completed' && (
                  <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                )}
                {state.status === 'failed' && (
                  <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                )}
                {state.status === 'pending' && (
                  <Clock className="h-3 w-3 text-gray-400 shrink-0" />
                )}
                <span className="truncate" title={nodeId}>
                  {nodeId.slice(0, 24)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <div
          ref={logsContainerRef}
          className="flex-1 overflow-y-auto p-3 font-mono text-xs"
          onScroll={handleScroll}
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-center">
              {currentExecution
                ? formatMessage({ id: 'orchestrator.monitor.waitingForLogs' })
                : formatMessage({ id: 'orchestrator.monitor.clickExecuteToStart' })}
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="flex gap-1.5">
                  <span className="text-muted-foreground shrink-0 text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={cn(
                      'uppercase w-10 shrink-0 text-[10px]',
                      getLogLevelColor(log.level)
                    )}
                  >
                    [{log.level}]
                  </span>
                  <span className="text-foreground break-all text-[11px]">
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
            <ArrowDownToLine className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default ExecutionMonitor;
