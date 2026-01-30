// ========================================
// CliStreamPanel Component
// ========================================
// Floating panel for CLI execution details with streaming output

import * as React from 'react';
import { useIntl } from 'react-intl';
import { Terminal, Clock, Calendar, Hash } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { StreamingOutput } from './StreamingOutput';
import { useCliExecutionDetail } from '@/hooks/useCliExecution';
import { useCliStreamStore } from '@/stores/cliStreamStore';
import type { CliOutputLine } from '@/stores/cliStreamStore';

// ========== Stable Selectors ==========
// Create selector factory to avoid infinite re-renders
// The selector function itself is stable, preventing unnecessary re-renders
const createOutputsSelector = (executionId: string) => (state: ReturnType<typeof useCliStreamStore.getState>) =>
  state.outputs[executionId];

export interface CliStreamPanelProps {
  /** Execution ID to display */
  executionId: string;
  /** Source directory path */
  sourceDir?: string;
  /** Whether panel is open */
  open: boolean;
  /** Called when open state changes */
  onOpenChange: (open: boolean) => void;
}

type TabValue = 'prompt' | 'output' | 'details';

/**
 * Format duration to human readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get badge variant for tool name
 */
function getToolVariant(tool: string): 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info' {
  const variants: Record<string, 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info'> = {
    gemini: 'info',
    codex: 'success',
    qwen: 'warning',
  };
  return variants[tool] || 'secondary';
}

/**
 * CliStreamPanel component - Display CLI execution details in floating panel
 *
 * @remarks
 * Shows execution details with three tabs:
 * - Prompt: View the conversation prompts
 * - Output: Real-time streaming output
 * - Details: Execution metadata (tool, mode, duration, etc.)
 *
 * @example
 * ```tsx
 * <CliStreamPanel
 *   executionId="exec-123"
 *   sourceDir="/path/to/project"
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 * />
 * ```
 */
export function CliStreamPanel({
  executionId,
  sourceDir: _sourceDir,
  open,
  onOpenChange,
}: CliStreamPanelProps) {
  const { formatMessage } = useIntl();
  const [activeTab, setActiveTab] = React.useState<TabValue>('output');

  // Fetch execution details
  const { data: execution, isLoading, error } = useCliExecutionDetail(
    open ? executionId : null,
    { enabled: open }
  );

  // Get streaming outputs from store using stable selector
  // Use selector factory to prevent infinite re-renders
  const selectOutputs = React.useMemo(
    () => createOutputsSelector(executionId),
    [executionId]
  );
  const outputs = useCliStreamStore(selectOutputs) || [];

  // Build output lines from conversation (historical) + streaming (real-time)
  const allOutputs: CliOutputLine[] = React.useMemo(() => {
    const historical: CliOutputLine[] = [];

    // Add historical output from conversation turns
    if (execution?.turns) {
      for (const turn of execution.turns) {
        if (turn.output?.stdout) {
          historical.push({
            type: 'stdout',
            content: turn.output.stdout,
            timestamp: new Date(turn.timestamp).getTime(),
          });
        }
        if (turn.output?.stderr) {
          historical.push({
            type: 'stderr',
            content: turn.output.stderr,
            timestamp: new Date(turn.timestamp).getTime(),
          });
        }
      }
    }

    // Combine historical + streaming
    return [...historical, ...outputs];
  }, [execution, outputs]);

  // Calculate total duration
  const totalDuration = React.useMemo(() => {
    if (!execution?.turns) return 0;
    return execution.turns.reduce((sum, t) => sum + t.duration_ms, 0);
  }, [execution]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              {formatMessage({ id: 'cli.executionDetails' })}
            </DialogTitle>

            {/* Execution info badges */}
            {execution && (
              <div className="flex items-center gap-2">
                <Badge variant={getToolVariant(execution.tool)}>
                  {execution.tool.toUpperCase()}
                </Badge>
                {execution.mode && (
                  <Badge variant="secondary">{execution.mode}</Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {formatDuration(totalDuration)}
                </span>
              </div>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-destructive">
            Failed to load execution details
          </div>
        ) : execution ? (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabValue)}
            className="flex-1 flex flex-col"
          >
            <div className="px-6 pt-4">
              <TabsList>
                <TabsTrigger value="prompt">
                  {formatMessage({ id: 'cli.tabs.prompt' })}
                </TabsTrigger>
                <TabsTrigger value="output">
                  {formatMessage({ id: 'cli.tabs.output' })}
                </TabsTrigger>
                <TabsTrigger value="details">
                  {formatMessage({ id: 'cli.tabs.details' })}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden px-6 pb-6">
              <TabsContent
                value="prompt"
                className="mt-4 h-full overflow-y-auto m-0"
              >
                <div className="p-4 bg-muted rounded-lg max-h-[50vh] overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap">
                    {execution.turns.map((turn, i) => (
                      <div key={i} className="mb-4">
                        <div className="text-xs text-muted-foreground mb-1">
                          Turn {turn.turn}
                        </div>
                        <div>{turn.prompt}</div>
                      </div>
                    ))}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent
                value="output"
                className="mt-4 h-full m-0"
              >
                <div className="h-[50vh] border border-border rounded-lg overflow-hidden">
                  <StreamingOutput
                    outputs={allOutputs}
                    isStreaming={outputs.length > 0}
                  />
                </div>
              </TabsContent>

              <TabsContent
                value="details"
                className="mt-4 h-full overflow-y-auto m-0"
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Tool:</span>
                      <Badge variant={getToolVariant(execution.tool)}>
                        {execution.tool}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Mode:</span>
                      <span>{execution.mode || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Duration:</span>
                      <span>{formatDuration(totalDuration)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Created:</span>
                      <span>
                        {new Date(execution.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ID: {execution.id}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Turns: {execution.turn_count}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
