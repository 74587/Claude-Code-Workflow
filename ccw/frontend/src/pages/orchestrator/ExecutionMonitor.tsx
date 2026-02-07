// ========================================
// Execution Monitor
// ========================================
// Right-side slide-out panel for real-time execution monitoring with multi-panel layout

import { useEffect, useCallback, useState, useRef } from 'react';
import { useIntl } from 'react-intl';
import {
  Play,
  Pause,
  Square,
  Clock,
  Terminal,
  ArrowDownToLine,
  X,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useExecutionStore } from '@/stores/executionStore';
import { useFlowStore } from '@/stores';
import { useExecuteFlow, usePauseExecution, useResumeExecution, useStopExecution } from '@/hooks/useFlows';
import { ExecutionHeader } from '@/components/orchestrator/ExecutionHeader';
import { NodeExecutionChain } from '@/components/orchestrator/NodeExecutionChain';
import { NodeDetailPanel } from '@/components/orchestrator/NodeDetailPanel';
import type { LogLevel } from '@/types/execution';

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
  const { formatMessage } = useIntl();

  // Execution store state
  const currentExecution = useExecutionStore((state) => state.currentExecution);
  const logs = useExecutionStore((state) => state.logs);
  const nodeStates = useExecutionStore((state) => state.nodeStates);
  const selectedNodeId = useExecutionStore((state) => state.selectedNodeId);
  const nodeOutputs = useExecutionStore((state) => state.nodeOutputs);
  const nodeToolCalls = useExecutionStore((state) => state.nodeToolCalls);
  const isMonitorPanelOpen = useExecutionStore((state) => state.isMonitorPanelOpen);
  const setMonitorPanelOpen = useExecutionStore((state) => state.setMonitorPanelOpen);
  const selectNode = useExecutionStore((state) => state.selectNode);
  const toggleToolCallExpanded = useExecutionStore((state) => state.toggleToolCallExpanded);
  const startExecution = useExecutionStore((state) => state.startExecution);

  // Flow store state
  const currentFlow = useFlowStore((state) => state.currentFlow);
  const nodes = useFlowStore((state) => state.nodes);

  // Mutations
  const executeFlow = useExecuteFlow();
  const pauseExecution = usePauseExecution();
  const resumeExecution = useResumeExecution();
  const stopExecution = useStopExecution();

  // Local state
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isUserScrollingLogs, setIsUserScrollingLogs] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll global logs
  useEffect(() => {
    if (!isUserScrollingLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isUserScrollingLogs]);

  // Auto-select current executing node
  useEffect(() => {
    if (currentExecution?.currentNodeId && currentExecution.status === 'running') {
      selectNode(currentExecution.currentNodeId);
    }
  }, [currentExecution?.currentNodeId, currentExecution?.status, selectNode]);

  // Handle scroll to detect user scrolling
  const handleScroll = useCallback(() => {
    if (!logsContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsUserScrollingLogs(!isAtBottom);
  }, []);

  // Scroll to bottom handler
  const scrollToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsUserScrollingLogs(false);
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

  // Handle node select
  const handleNodeSelect = useCallback(
    (nodeId: string) => {
      selectNode(nodeId);
    },
    [selectNode]
  );

  // Handle toggle tool call expand
  const handleToggleToolCallExpand = useCallback(
    (callId: string) => {
      if (selectedNodeId) {
        toggleToolCallExpanded(selectedNodeId, callId);
      }
    },
    [selectedNodeId, toggleToolCallExpanded]
  );

  // Get selected node data
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedNodeOutput = selectedNodeId ? nodeOutputs[selectedNodeId] : undefined;
  const selectedNodeState = selectedNodeId ? nodeStates[selectedNodeId] : undefined;
  const selectedNodeToolCalls = selectedNodeId ? (nodeToolCalls[selectedNodeId] ?? []) : [];
  const isNodeExecuting = selectedNodeId ? nodeStates[selectedNodeId]?.status === 'running' : false;

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
            <Badge
              variant={
                currentExecution.status === 'running'
                  ? 'default'
                  : currentExecution.status === 'completed'
                  ? 'success'
                  : currentExecution.status === 'failed'
                  ? 'destructive'
                  : currentExecution.status === 'paused'
                  ? 'warning'
                  : 'secondary'
              }
              className="shrink-0"
            >
              {formatMessage({ id: `orchestrator.status.${currentExecution.status}` })}
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

      {/* Multi-Panel Layout */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* 1. Execution Overview */}
        <ExecutionHeader execution={currentExecution} nodeStates={nodeStates} />

        {/* 2. Node Execution Chain */}
        <NodeExecutionChain
          nodes={nodes}
          nodeStates={nodeStates}
          selectedNodeId={selectedNodeId}
          onNodeSelect={handleNodeSelect}
        />

        {/* 3. Node Detail Panel */}
        <NodeDetailPanel
          node={selectedNode}
          nodeOutput={selectedNodeOutput}
          nodeState={selectedNodeState}
          toolCalls={selectedNodeToolCalls}
          isExecuting={isNodeExecuting}
          onToggleToolCallExpand={handleToggleToolCallExpand}
        />

        {/* 4. Global Logs */}
        <div className="flex-1 flex flex-col min-h-0 border-t border-border relative">
          <div className="px-3 py-1.5 border-b border-border bg-muted/30 shrink-0 flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Global Logs ({logs.length})
            </span>
          </div>
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
          {isUserScrollingLogs && logs.length > 0 && (
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
    </div>
  );
}

export default ExecutionMonitor;
