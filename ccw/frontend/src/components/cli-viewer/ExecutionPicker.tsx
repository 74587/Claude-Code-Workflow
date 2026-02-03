// ========================================
// ExecutionPicker Component
// ========================================
// Dialog for selecting CLI executions to open as tabs

import { useState, useMemo, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { Plus, Search, Terminal, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog';
import {
  useCliStreamStore,
  type CliExecutionState,
  type CliExecutionStatus,
} from '@/stores/cliStreamStore';
import { useViewerStore, type PaneId } from '@/stores/viewerStore';

// ========== Types ==========

export interface ExecutionPickerProps {
  paneId: PaneId;
  className?: string;
}

// ========== Constants ==========

const STATUS_CONFIG: Record<CliExecutionStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  running: {
    icon: Loader2,
    color: 'text-indigo-500',
    label: 'Running',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-emerald-500',
    label: 'Completed',
  },
  error: {
    icon: XCircle,
    color: 'text-rose-500',
    label: 'Error',
  },
};

// ========== Helper Functions ==========

/**
 * Format timestamp to relative or absolute time
 */
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return 'Just now';
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
}

/**
 * Get execution display title
 */
function getExecutionTitle(_executionId: string, execution: CliExecutionState): string {
  return `${execution.tool}-${execution.mode}`;
}

// ========== Sub-Components ==========

interface ExecutionItemProps {
  executionId: string;
  execution: CliExecutionState;
  onSelect: () => void;
}

/**
 * Single execution item in the picker list
 */
function ExecutionItem({ executionId, execution, onSelect }: ExecutionItemProps) {
  const statusConfig = STATUS_CONFIG[execution.status];
  const StatusIcon = statusConfig.icon;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg',
        'border border-border/50 bg-muted/30',
        'hover:bg-muted/50 hover:border-border',
        'transition-all duration-150',
        'text-left'
      )}
    >
      {/* Tool icon */}
      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
        <Terminal className="h-4 w-4 text-primary" />
      </div>

      {/* Execution info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-foreground truncate">
            {getExecutionTitle(executionId, execution)}
          </span>
          <StatusIcon
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              statusConfig.color,
              execution.status === 'running' && 'animate-spin'
            )}
          />
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground truncate">
            {executionId}
          </span>
        </div>
      </div>

      {/* Time */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
        <Clock className="h-3 w-3" />
        <span>{formatTime(execution.startTime)}</span>
      </div>
    </button>
  );
}

// ========== Main Component ==========

/**
 * ExecutionPicker - Dialog for selecting CLI executions to open as tabs
 *
 * Features:
 * - Lists all available CLI executions from store
 * - Search/filter by tool name or execution ID
 * - Shows execution status, tool, and timestamp
 * - Click to add as new tab in the specified pane
 */
export function ExecutionPicker({ paneId, className }: ExecutionPickerProps) {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Store hooks
  const executions = useCliStreamStore((state) => state.executions);
  const addTab = useViewerStore((state) => state.addTab);
  const panes = useViewerStore((state) => state.panes);

  // Get current pane's existing execution IDs
  const existingExecutionIds = useMemo(() => {
    const pane = panes[paneId];
    if (!pane) return new Set<string>();
    return new Set(pane.tabs.map((tab) => tab.executionId));
  }, [panes, paneId]);

  // Filter and sort executions
  const filteredExecutions = useMemo(() => {
    const entries = Object.entries(executions);

    // Filter by search query
    const filtered = entries.filter(([id, exec]) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        id.toLowerCase().includes(query) ||
        exec.tool.toLowerCase().includes(query) ||
        exec.mode.toLowerCase().includes(query)
      );
    });

    // Sort by start time (newest first)
    filtered.sort((a, b) => b[1].startTime - a[1].startTime);

    return filtered;
  }, [executions, searchQuery]);

  // Handle execution selection
  const handleSelect = useCallback((executionId: string, execution: CliExecutionState) => {
    const title = getExecutionTitle(executionId, execution);
    addTab(paneId, executionId, title);
    setOpen(false);
    setSearchQuery('');
  }, [paneId, addTab]);

  // Count available vs total
  const totalCount = Object.keys(executions).length;
  const availableCount = filteredExecutions.filter(
    ([id]) => !existingExecutionIds.has(id)
  ).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-6 w-6 shrink-0', className)}
          aria-label={formatMessage({
            id: 'cliViewer.tabs.addTab',
            defaultMessage: 'Add tab'
          })}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {formatMessage({
              id: 'cliViewer.picker.selectExecution',
              defaultMessage: 'Select Execution'
            })}
          </DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({
              id: 'cliViewer.picker.searchExecutions',
              defaultMessage: 'Search executions...'
            })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Execution list */}
        <div className="max-h-[300px] overflow-y-auto space-y-2">
          {filteredExecutions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Terminal className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {totalCount === 0
                  ? formatMessage({
                      id: 'cliViewer.picker.noExecutions',
                      defaultMessage: 'No executions available'
                    })
                  : formatMessage({
                      id: 'cliViewer.picker.noMatchingExecutions',
                      defaultMessage: 'No matching executions'
                    })
                }
              </p>
            </div>
          ) : (
            filteredExecutions.map(([id, exec]) => {
              const isAlreadyOpen = existingExecutionIds.has(id);
              return (
                <div key={id} className="relative">
                  <ExecutionItem
                    executionId={id}
                    execution={exec}
                    onSelect={() => handleSelect(id, exec)}
                  />
                  {isAlreadyOpen && (
                    <div className="absolute inset-0 bg-background/60 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        {formatMessage({
                          id: 'cliViewer.picker.alreadyOpen',
                          defaultMessage: 'Already open'
                        })}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer with count */}
        {totalCount > 0 && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
            {formatMessage(
              {
                id: 'cliViewer.picker.executionCount',
                defaultMessage: '{available} of {total} executions available'
              },
              { available: availableCount, total: totalCount }
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ExecutionPicker;
