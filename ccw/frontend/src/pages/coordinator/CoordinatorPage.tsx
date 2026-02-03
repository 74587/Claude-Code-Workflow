// ========================================
// Coordinator Page - Merged Layout
// ========================================
// Unified page for task list overview and execution details with timeline, logs, and node details

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Play, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  CoordinatorInputModal,
  CoordinatorTimeline,
  CoordinatorLogStream,
  NodeDetailsPanel,
  CoordinatorEmptyState,
} from '@/components/coordinator';
import {
  useCoordinatorStore,
  selectCommandChain,
  selectCurrentNode,
  selectCoordinatorStatus,
  selectIsPipelineLoaded,
} from '@/stores/coordinatorStore';
import { cn } from '@/lib/utils';

// ========================================
// Types
// ========================================

interface CoordinatorTask {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    completed: number;
    total: number;
  };
  startedAt: string;
  completedAt?: string;
}

// ========================================
// Mock Data (temporary - will be replaced by store)
// ========================================

const MOCK_TASKS: CoordinatorTask[] = [
  {
    id: 'task-1',
    name: 'Feature Auth',
    status: 'running',
    progress: { completed: 3, total: 5 },
    startedAt: '2026-02-03T14:23:00Z',
  },
  {
    id: 'task-2',
    name: 'API Integration',
    status: 'completed',
    progress: { completed: 8, total: 8 },
    startedAt: '2026-02-03T10:00:00Z',
    completedAt: '2026-02-03T10:15:00Z',
  },
  {
    id: 'task-3',
    name: 'Performance Test',
    status: 'failed',
    progress: { completed: 2, total: 6 },
    startedAt: '2026-02-03T09:00:00Z',
  },
];

// ========================================
// Task Card Component (inline)
// ========================================

interface TaskCardProps {
  task: CoordinatorTask;
  isSelected: boolean;
  onClick: () => void;
}

function TaskCard({ task, isSelected, onClick }: TaskCardProps) {
  const { formatMessage } = useIntl();

  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'text-muted-foreground',
      bg: 'bg-muted/50',
    },
    running: {
      icon: Loader2,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    completed: {
      icon: CheckCircle2,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    failed: {
      icon: XCircle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
  };

  const config = statusConfig[task.status];
  const StatusIcon = config.icon;
  const progressPercent = Math.round((task.progress.completed / task.progress.total) * 100);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col p-3 rounded-lg border transition-all text-left w-full min-w-[160px] max-w-[200px]',
        'hover:border-primary/50 hover:shadow-sm',
        isSelected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card'
      )}
    >
      {/* Task Name */}
      <div className="flex items-center gap-2 mb-2">
        <StatusIcon
          className={cn(
            'w-4 h-4 flex-shrink-0',
            config.color,
            task.status === 'running' && 'animate-spin'
          )}
        />
        <span className="text-sm font-medium text-foreground truncate">
          {task.name}
        </span>
      </div>

      {/* Status Badge */}
      <div
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mb-2 w-fit',
          config.bg,
          config.color
        )}
      >
        {formatMessage({ id: `coordinator.status.${task.status}` })}
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {task.progress.completed}/{task.progress.total}
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              task.status === 'completed' && 'bg-green-500',
              task.status === 'running' && 'bg-blue-500',
              task.status === 'failed' && 'bg-red-500',
              task.status === 'pending' && 'bg-muted-foreground'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </button>
  );
}

// ========================================
// Main Component
// ========================================

export function CoordinatorPage() {
  const { formatMessage } = useIntl();
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Store selectors
  const commandChain = useCoordinatorStore(selectCommandChain);
  const currentNode = useCoordinatorStore(selectCurrentNode);
  const status = useCoordinatorStore(selectCoordinatorStatus);
  const isPipelineLoaded = useCoordinatorStore(selectIsPipelineLoaded);
  const syncStateFromServer = useCoordinatorStore((state) => state.syncStateFromServer);

  // Mock tasks (temporary - will be replaced by store)
  const tasks = useMemo(() => MOCK_TASKS, []);
  const hasTasks = tasks.length > 0;
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  // Sync state on mount (for page refresh scenarios)
  useEffect(() => {
    if (status === 'running' || status === 'paused' || status === 'initializing') {
      syncStateFromServer();
    }
  }, []);

  // Handle open input modal
  const handleOpenInputModal = useCallback(() => {
    setIsInputModalOpen(true);
  }, []);

  // Handle node click from timeline
  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(nodeId);
  }, []);

  // Handle task selection
  const handleTaskClick = useCallback((taskId: string) => {
    setSelectedTaskId((prev) => (prev === taskId ? null : taskId));
    setSelectedNode(null);
  }, []);

  // Get selected node object
  const selectedNodeObject =
    commandChain.find((node) => node.id === selectedNode) || currentNode || null;

  return (
    <div className="h-full flex flex-col -m-4 md:-m-6">
      {/* ======================================== */}
      {/* Toolbar */}
      {/* ======================================== */}
      <div className="flex items-center gap-3 p-3 bg-card border-b border-border">
        {/* Page Title and Status */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Play className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'coordinator.page.title' })}
            </span>
            {isPipelineLoaded && (
              <span className="text-xs text-muted-foreground">
                {formatMessage(
                  { id: 'coordinator.page.status' },
                  {
                    status: formatMessage({ id: `coordinator.status.${status}` }),
                  }
                )}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleOpenInputModal}
            disabled={status === 'running' || status === 'initializing'}
          >
            <Play className="w-4 h-4 mr-1" />
            {formatMessage({ id: 'coordinator.page.startButton' })}
          </Button>
        </div>
      </div>

      {/* ======================================== */}
      {/* Main Content Area */}
      {/* ======================================== */}
      {!hasTasks ? (
        /* Empty State - No tasks */
        <div className="flex-1 flex overflow-hidden">
          <CoordinatorEmptyState
            onStart={handleOpenInputModal}
            disabled={status === 'running' || status === 'initializing'}
            className="w-full"
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ======================================== */}
          {/* Task List Area */}
          {/* ======================================== */}
          <div className="p-4 border-b border-border bg-background">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskId === task.id}
                  onClick={() => handleTaskClick(task.id)}
                />
              ))}
            </div>
          </div>

          {/* ======================================== */}
          {/* Task Detail Area (shown when task is selected) */}
          {/* ======================================== */}
          {selectedTask ? (
            <div className="flex-1 flex overflow-hidden">
              {/* Left Panel: Timeline */}
              <div className="w-1/3 min-w-[300px] border-r border-border bg-card">
                <CoordinatorTimeline
                  autoScroll={true}
                  onNodeClick={handleNodeClick}
                  className="h-full"
                />
              </div>

              {/* Center Panel: Log Stream */}
              <div className="flex-1 min-w-0 flex flex-col bg-card">
                <div className="flex-1 min-h-0">
                  <CoordinatorLogStream />
                </div>
              </div>

              {/* Right Panel: Node Details */}
              <div className="w-80 min-w-[320px] max-w-[400px] border-l border-border bg-card overflow-y-auto">
                {selectedNodeObject ? (
                  <NodeDetailsPanel
                    node={selectedNodeObject}
                    isExpanded={true}
                    onToggle={(expanded) => {
                      if (!expanded) {
                        setSelectedNode(null);
                      }
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
                    {formatMessage({ id: 'coordinator.page.noNodeSelected' })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* No task selected - show selection prompt */
            <div className="flex-1 flex items-center justify-center bg-muted/30">
              <div className="text-sm text-muted-foreground">
                {formatMessage({ id: 'coordinator.taskDetail.noSelection' })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================== */}
      {/* Coordinator Input Modal */}
      {/* ======================================== */}
      <CoordinatorInputModal
        open={isInputModalOpen}
        onClose={() => setIsInputModalOpen(false)}
      />
    </div>
  );
}

export default CoordinatorPage;
