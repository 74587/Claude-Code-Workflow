// ========================================
// Node Detail Panel Component
// ========================================
// Tab panel displaying node execution details: Output, Tool Calls, Logs, Variables

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Terminal,
  Wrench,
  FileText,
  Database,
  FileText as FileTextIcon,
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StreamingOutput } from '@/components/shared/StreamingOutput';
import { ToolCallsTimeline } from './ToolCallsTimeline';
import type { ExecutionLog, NodeExecutionOutput, NodeExecutionState } from '@/types/execution';
import type { ToolCallExecution } from '@/types/toolCall';
import type { CliOutputLine } from '@/stores/cliStreamStore';
import type { FlowNode } from '@/types/flow';

// ========== Tab Types ==========

type DetailTabId = 'output' | 'toolCalls' | 'logs' | 'variables';

interface DetailTab {
  id: DetailTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DETAIL_TABS: DetailTab[] = [
  { id: 'output', label: 'Output Stream', icon: Terminal },
  { id: 'toolCalls', label: 'Tool Calls', icon: Wrench },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'variables', label: 'Variables', icon: Database },
];

// ========== Helper Functions ==========

/**
 * Get log level color class
 */
function getLogLevelColor(level: ExecutionLog['level']): string {
  switch (level) {
    case 'error':
      return 'text-red-500 bg-red-500/10';
    case 'warn':
      return 'text-yellow-600 bg-yellow-500/10 dark:text-yellow-500';
    case 'info':
      return 'text-blue-500 bg-blue-500/10';
    case 'debug':
      return 'text-gray-500 bg-gray-500/10';
    default:
      return 'text-foreground bg-muted';
  }
}

/**
 * Format timestamp to locale time string
 */
function formatLogTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ========== Tab Components ==========

interface OutputTabProps {
  outputs: CliOutputLine[];
  isStreaming: boolean;
}

function OutputTab({ outputs, isStreaming }: OutputTabProps) {
  return (
    <div className="h-full flex flex-col">
      <StreamingOutput
        outputs={outputs}
        isStreaming={isStreaming}
        autoScroll={true}
        className="flex-1"
      />
    </div>
  );
}

interface ToolCallsTabProps {
  toolCalls: ToolCallExecution[];
  onToggleExpand: (callId: string) => void;
}

function ToolCallsTab({ toolCalls, onToggleExpand }: ToolCallsTabProps) {
  return (
    <div className="h-full overflow-y-auto">
      <ToolCallsTimeline
        toolCalls={toolCalls}
        onToggleExpand={onToggleExpand}
        className="p-3"
      />
    </div>
  );
}

interface LogsTabProps {
  logs: ExecutionLog[];
}

function LogsTab({ logs }: LogsTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <FileTextIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No logs for this node</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto p-3 font-mono text-xs">
      <div className="space-y-1">
        {logs.map((log, index) => (
          <div
            key={index}
            className={cn(
              'flex gap-2 p-2 rounded',
              getLogLevelColor(log.level)
            )}
          >
            <span className="shrink-0 opacity-70">
              {formatLogTimestamp(log.timestamp)}
            </span>
            <span className="shrink-0 font-semibold opacity-80 uppercase">
              [{log.level}]
            </span>
            <span className="flex-1 break-all">{log.message}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

interface VariablesTabProps {
  node: FlowNode;
  nodeOutput: NodeExecutionOutput | undefined;
  nodeState: NodeExecutionState | undefined;
}

function VariablesTab({ node, nodeOutput, nodeState }: VariablesTabProps) {
  const variables = useMemo(() => {
    const vars: Record<string, unknown> = {};

    // Add outputName if available
    if (node.data.outputName) {
      vars[`{{${node.data.outputName}}}`] = nodeState?.result ?? '<pending>';
    } else if (nodeState?.result) {
      // Also add result if available even without outputName
      vars['result'] = nodeState.result;
    }

    // Add any variables stored in nodeOutput
    if (nodeOutput?.variables) {
      Object.entries(nodeOutput.variables).forEach(([key, value]) => {
        vars[`{{${key}}}`] = value;
      });
    }

    // Add execution metadata
    if (nodeOutput) {
      vars['_execution'] = {
        startTime: new Date(nodeOutput.startTime).toISOString(),
        endTime: nodeOutput.endTime ? new Date(nodeOutput.endTime).toISOString() : '<running>',
        outputCount: nodeOutput.outputs.length,
        toolCallCount: nodeOutput.toolCalls.length,
        logCount: nodeOutput.logs.length,
      };
    }

    return vars;
  }, [node, nodeOutput, nodeState]);

  const variableEntries = useMemo(() => {
    return Object.entries(variables).sort(([a], [b]) => a.localeCompare(b));
  }, [variables]);

  if (variableEntries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No variables defined</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="space-y-2">
        {variableEntries.map(([key, value]) => (
          <div
            key={key}
            className="p-2 bg-muted/30 rounded border border-border"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-primary font-semibold">
                {key}
              </span>
            </div>
            <pre className="text-xs text-muted-foreground overflow-x-auto">
              {typeof value === 'object'
                ? JSON.stringify(value, null, 2)
                : String(value)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== Main Component ==========

interface NodeDetailPanelProps {
  /** Currently selected node */
  node: FlowNode | null;
  /** Node execution output data */
  nodeOutput: NodeExecutionOutput | undefined;
  /** Node execution state */
  nodeState: NodeExecutionState | undefined;
  /** Tool calls for this node */
  toolCalls: ToolCallExecution[];
  /** Whether the node is currently executing */
  isExecuting: boolean;
  /** Callback to toggle tool call expand */
  onToggleToolCallExpand: (callId: string) => void;
  /** Optional CSS class name */
  className?: string;
}

/**
 * NodeDetailPanel displays detailed information about a selected node
 *
 * Features:
 * - Tab-based layout (Output/Tool Calls/Logs/Variables)
 * - Auto-scroll to bottom for output/logs
 * - Expandable tool call cards
 * - Variable inspection
 */
export function NodeDetailPanel({
  node,
  nodeOutput,
  nodeState,
  toolCalls,
  isExecuting,
  onToggleToolCallExpand,
  className,
}: NodeDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTabId>('output');

  // Reset to output tab when node changes
  useEffect(() => {
    setActiveTab('output');
  }, [node?.id]);

  // Handle tab change
  const handleTabChange = useCallback((tabId: DetailTabId) => {
    setActiveTab(tabId);
  }, []);

  // Handle toggle tool call expand
  const handleToggleToolCallExpand = useCallback(
    (callId: string) => {
      onToggleToolCallExpand(callId);
    },
    [onToggleToolCallExpand]
  );

  // If no node selected, show empty state
  if (!node) {
    return (
      <div
        className={cn(
          'h-64 border-t border-border flex items-center justify-center',
          className
        )}
      >
        <div className="text-center text-muted-foreground">
          <Circle className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a node to view details</p>
        </div>
      </div>
    );
  }

  const outputs = nodeOutput?.outputs ?? [];
  const logs = nodeOutput?.logs ?? [];

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'output':
        return <OutputTab outputs={outputs} isStreaming={isExecuting} />;
      case 'toolCalls':
        return (
          <ToolCallsTab
            toolCalls={toolCalls}
            onToggleExpand={handleToggleToolCallExpand}
          />
        );
      case 'logs':
        return <LogsTab logs={logs} />;
      case 'variables':
        return <VariablesTab node={node} nodeOutput={nodeOutput} nodeState={nodeState} />;
    }
  };

  // Get tab counts for badges
  const tabCounts = {
    output: outputs.length,
    toolCalls: toolCalls.length,
    logs: logs.length,
    variables: 1, // At least outputName or execution metadata
  };

  return (
    <div className={cn('h-64 border-t border-border flex flex-col', className)}>
      {/* Tab Headers */}
      <div className="flex items-center gap-1 px-2 pt-2 border-b border-border shrink-0">
        {DETAIL_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id];

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-colors',
                'border-b-2 -mb-px',
                isActive
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Node status indicator */}
      {nodeState && (
        <div className="px-3 py-1.5 border-b border-border bg-muted/30 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {nodeState.status === 'running' && (
              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
            )}
            {nodeState.status === 'completed' && (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            )}
            {nodeState.status === 'failed' && (
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className="text-xs text-muted-foreground">
              Status: <span className="font-medium text-foreground capitalize">{nodeState.status}</span>
            </span>
          </div>
          {nodeState.error && (
            <div className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              <span className="truncate max-w-[200px]">{nodeState.error}</span>
            </div>
          )}
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {renderTabContent()}
      </div>
    </div>
  );
}

NodeDetailPanel.displayName = 'NodeDetailPanel';

export default NodeDetailPanel;
