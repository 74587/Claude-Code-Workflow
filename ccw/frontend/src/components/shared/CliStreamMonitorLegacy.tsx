// ========================================
// CliStreamMonitor Component
// ========================================
// Global CLI streaming monitor with multi-execution support

import { useEffect, useRef, useCallback, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  X,
  Terminal,
  Loader2,
  Clock,
  RefreshCw,
  Search,
  ArrowDownToLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { LogBlockList } from '@/components/shared/LogBlock';
import { useCliStreamStore, type CliOutputLine } from '@/stores/cliStreamStore';
import { useNotificationStore, selectWsLastMessage } from '@/stores';
import { useActiveCliExecutions, useInvalidateActiveCliExecutions } from '@/hooks/useActiveCliExecutions';

// New components for Tab + JSON Cards
import { ExecutionTab } from './CliStreamMonitor/components/ExecutionTab';
import { OutputLine } from './CliStreamMonitor/components/OutputLine';

// ========== Types for CLI WebSocket Messages ==========

interface CliStreamStartedPayload {
  executionId: string;
  tool: string;
  mode: string;
  timestamp: string;
}

interface CliStreamOutputPayload {
  executionId: string;
  chunkType: string;
  data: unknown;
  unit?: {
    content: unknown;
    type?: string;
  };
}

interface CliStreamCompletedPayload {
  executionId: string;
  success: boolean;
  duration?: number;
  timestamp: string;
}

interface CliStreamErrorPayload {
  executionId: string;
  error?: string;
  timestamp: string;
}

// ========== Helper Functions ==========

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

// ========== Component ==========

export interface CliStreamMonitorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CliStreamMonitor({ isOpen, onClose }: CliStreamMonitorProps) {
  const { formatMessage } = useIntl();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'blocks'>('list');

  // Store state
  const executions = useCliStreamStore((state) => state.executions);
  const currentExecutionId = useCliStreamStore((state) => state.currentExecutionId);
  const setCurrentExecution = useCliStreamStore((state) => state.setCurrentExecution);
  const removeExecution = useCliStreamStore((state) => state.removeExecution);

  // Active execution sync
  const { isLoading: isSyncing, refetch } = useActiveCliExecutions(isOpen);
  const invalidateActive = useInvalidateActiveCliExecutions();

  // WebSocket last message from notification store
  const lastMessage = useNotificationStore(selectWsLastMessage);

  // Handle WebSocket messages for CLI stream
  useEffect(() => {
    if (!lastMessage) return;

    const { type, payload } = lastMessage;

    if (type === 'CLI_STARTED') {
      const p = payload as CliStreamStartedPayload;
      const startTime = p.timestamp ? new Date(p.timestamp).getTime() : Date.now();
      useCliStreamStore.getState().upsertExecution(p.executionId, {
        tool: p.tool || 'cli',
        mode: p.mode || 'analysis',
        status: 'running',
        startTime,
        output: [
          {
            type: 'system',
            content: `[${new Date(startTime).toLocaleTimeString()}] CLI execution started: ${p.tool} (${p.mode} mode)`,
            timestamp: startTime
          }
        ]
      });
      // Set as current if none selected
      if (!currentExecutionId) {
        setCurrentExecution(p.executionId);
      }
      invalidateActive();
    } else if (type === 'CLI_OUTPUT') {
      const p = payload as CliStreamOutputPayload;
      const unitContent = p.unit?.content;
      const unitType = p.unit?.type || p.chunkType;

      let content: string;
      if (unitType === 'tool_call' && typeof unitContent === 'object' && unitContent !== null) {
        const toolCall = unitContent as { action?: string; toolName?: string; parameters?: unknown; status?: string; output?: string };
        if (toolCall.action === 'invoke') {
          const params = toolCall.parameters ? JSON.stringify(toolCall.parameters) : '';
          content = `[Tool] ${toolCall.toolName}(${params})`;
        } else if (toolCall.action === 'result') {
          const status = toolCall.status || 'unknown';
          const output = toolCall.output ? `: ${toolCall.output.substring(0, 200)}${toolCall.output.length > 200 ? '...' : ''}` : '';
          content = `[Tool Result] ${status}${output}`;
        } else {
          content = JSON.stringify(unitContent);
        }
      } else {
        content = typeof p.data === 'string' ? p.data : JSON.stringify(p.data);
      }

      const lines = content.split('\n');
      const addOutput = useCliStreamStore.getState().addOutput;
      lines.forEach(line => {
        if (line.trim() || lines.length === 1) {
          addOutput(p.executionId, {
            type: (unitType as CliOutputLine['type']) || 'stdout',
            content: line,
            timestamp: Date.now()
          });
        }
      });
    } else if (type === 'CLI_COMPLETED') {
      const p = payload as CliStreamCompletedPayload;
      const endTime = p.timestamp ? new Date(p.timestamp).getTime() : Date.now();
      useCliStreamStore.getState().upsertExecution(p.executionId, {
        status: p.success ? 'completed' : 'error',
        endTime,
        output: [
          {
            type: 'system',
            content: `[${new Date(endTime).toLocaleTimeString()}] CLI execution ${p.success ? 'completed successfully' : 'failed'}${p.duration ? ` (${formatDuration(p.duration)})` : ''}`,
            timestamp: endTime
          }
        ]
      });
      invalidateActive();
    } else if (type === 'CLI_ERROR') {
      const p = payload as CliStreamErrorPayload;
      const endTime = p.timestamp ? new Date(p.timestamp).getTime() : Date.now();
      useCliStreamStore.getState().upsertExecution(p.executionId, {
        status: 'error',
        endTime,
        output: [
          {
            type: 'stderr',
            content: `[ERROR] ${p.error || 'Unknown error occurred'}`,
            timestamp: endTime
          }
        ]
      });
      invalidateActive();
    }
  }, [lastMessage, currentExecutionId, setCurrentExecution, invalidateActive]);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (autoScroll && !isUserScrolling && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [executions, autoScroll, isUserScrolling, currentExecutionId]);

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

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (searchQuery) {
          setSearchQuery('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, searchQuery]);

  // Get sorted execution IDs (running first, then by start time)
  const sortedExecutionIds = Object.keys(executions).sort((a, b) => {
    const execA = executions[a];
    const execB = executions[b];
    if (execA.status === 'running' && execB.status !== 'running') return -1;
    if (execA.status !== 'running' && execB.status === 'running') return 1;
    return execB.startTime - execA.startTime;
  });

  // Active execution count for badge
  const activeCount = Object.values(executions).filter(e => e.status === 'running').length;

  // Current execution
  const currentExecution = currentExecutionId ? executions[currentExecutionId] : null;

  // Filter output lines based on search
  const filteredOutput = currentExecution && searchQuery
    ? currentExecution.output.filter(line =>
        line.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentExecution?.output || [];

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 transition-opacity z-40',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-[600px] bg-background border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cli-monitor-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <h2 id="cli-monitor-title" className="text-sm font-semibold text-foreground">
                CLI Stream Monitor
              </h2>
              {activeCount > 0 && (
                <Badge variant="default" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {activeCount} active
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isSyncing}
              title="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Execution Tabs */}
        {sortedExecutionIds.length > 0 && (
          <div className="px-4 pt-3 bg-card border-b border-border">
            <Tabs
              value={currentExecutionId || ''}
              onValueChange={(v) => setCurrentExecution(v || null)}
              className="w-full"
            >
              <TabsList className="w-full h-auto flex-wrap gap-1 bg-secondary/50 p-1">
                {sortedExecutionIds.map((id) => (
                  <ExecutionTab
                    key={id}
                    execution={{ ...executions[id], id }}
                    isActive={currentExecutionId === id}
                    onClick={() => setCurrentExecution(id)}
                    onClose={(e) => {
                      e.stopPropagation();
                      removeExecution(id);
                    }}
                  />
                ))}
              </TabsList>

              {/* Output Panel */}
              <div className="flex flex-col h-[calc(100vh-180px)]">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-2 py-2 bg-secondary/30 border-b border-border">
                  <div className="flex items-center gap-2 flex-1">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={formatMessage({ id: 'cliMonitor.searchPlaceholder' }) || 'Search output...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-7 text-xs"
                    />
                    {searchQuery && (
                      <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} className="h-7 px-2">
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* View Mode Toggle */}
                    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'blocks')}>
                      <TabsList className="h-7 bg-secondary/50">
                        <TabsTrigger value="list" className="h-6 px-2 text-xs">
                          List
                        </TabsTrigger>
                        <TabsTrigger value="blocks" className="h-6 px-2 text-xs">
                          Blocks
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    {currentExecution && (
                      <>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(
                            currentExecution.endTime
                              ? currentExecution.endTime - currentExecution.startTime
                              : Date.now() - currentExecution.startTime
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {filteredOutput.length} / {currentExecution.output.length} lines
                        </span>
                      </>
                    )}
                    <Button
                      variant={autoScroll ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setAutoScroll(!autoScroll)}
                      className="h-7 px-2"
                      title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
                    >
                      <ArrowDownToLine className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Output Content - Based on viewMode */}
                {currentExecution ? (
                  <div className="flex-1 overflow-hidden">
                    {viewMode === 'blocks' ? (
                      <div className="h-full overflow-y-auto bg-background">
                        <LogBlockList executionId={currentExecutionId} />
                      </div>
                    ) : (
                      <div
                        ref={logsContainerRef}
                        className="h-full overflow-y-auto p-3 font-mono text-xs bg-background"
                        onScroll={handleScroll}
                      >
                        {filteredOutput.length === 0 ? (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            {searchQuery ? 'No matching output found' : 'Waiting for output...'}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {filteredOutput.map((line, index) => (
                              <OutputLine
                                key={`${line.timestamp}-${index}`}
                                line={line}
                                onCopy={(content) => navigator.clipboard.writeText(content)}
                              />
                            ))}
                            <div ref={logsEndRef} />
                          </div>
                        )}
                        {isUserScrolling && filteredOutput.length > 0 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="absolute bottom-4 right-4"
                            onClick={scrollToBottom}
                          >
                            <ArrowDownToLine className="h-4 w-4 mr-1" />
                            Scroll to bottom
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">
                        {sortedExecutionIds.length === 0
                          ? (formatMessage({ id: 'cliMonitor.noExecutions' }) || 'No active CLI executions')
                          : (formatMessage({ id: 'cliMonitor.selectExecution' }) || 'Select an execution to view output')
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Tabs>
          </div>
        )}

        {/* Empty State */}
        {sortedExecutionIds.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Terminal className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-sm mb-1">
                {formatMessage({ id: 'cliMonitor.noExecutions' }) || 'No active CLI executions'}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'cliMonitor.noExecutionsHint' }) || 'Start a CLI command to see streaming output'}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default CliStreamMonitor;
