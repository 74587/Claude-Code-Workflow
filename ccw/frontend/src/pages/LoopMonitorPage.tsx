// ========================================
// Loop Monitor Page
// ========================================
// Monitor running development loops with Kanban board

import { useState, useCallback } from 'react';
import {
  RefreshCw,
  Play,
  Pause,
  StopCircle,
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { DropResult, DraggableProvided } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { KanbanBoard, useLoopKanbanColumns, type LoopKanbanItem } from '@/components/shared/KanbanBoard';
import { useLoops, useLoopMutations } from '@/hooks';
import type { Loop } from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Loop Card Component ==========

interface LoopCardProps {
  loop: Loop;
  provided: DraggableProvided;
  onPause?: (loop: Loop) => void;
  onResume?: (loop: Loop) => void;
  onStop?: (loop: Loop) => void;
  onClick?: (loop: Loop) => void;
}

function LoopCard({ loop, provided, onPause, onResume, onStop, onClick }: LoopCardProps) {
  const statusIcons: Record<Loop['status'], React.ReactNode> = {
    created: <Clock className="w-4 h-4 text-muted-foreground" />,
    running: <Loader2 className="w-4 h-4 text-primary animate-spin" />,
    paused: <Pause className="w-4 h-4 text-warning" />,
    completed: <CheckCircle className="w-4 h-4 text-success" />,
    failed: <XCircle className="w-4 h-4 text-destructive" />,
  };

  const progress = loop.totalSteps > 0
    ? Math.round((loop.currentStep / loop.totalSteps) * 100)
    : 0;

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={() => onClick?.(loop)}
      className={cn(
        'p-3 bg-card border border-border rounded-lg cursor-pointer',
        'hover:shadow-md hover:border-primary/50 transition-all',
        'focus:outline-none focus:ring-2 focus:ring-primary/50'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {statusIcons[loop.status]}
          <span className="text-sm font-medium text-foreground truncate">
            {loop.name || loop.id}
          </span>
        </div>
        {loop.tool && (
          <Badge variant="outline" className="text-xs flex-shrink-0">
            {loop.tool}
          </Badge>
        )}
      </div>

      {/* Prompt Preview */}
      {loop.prompt && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {loop.prompt}
        </p>
      )}

      {/* Progress Bar */}
      {loop.status === 'running' && loop.totalSteps > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Step {loop.currentStep}/{loop.totalSteps}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      {(loop.status === 'running' || loop.status === 'paused') && (
        <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border">
          {loop.status === 'running' ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); onPause?.(loop); }}
            >
              <Pause className="w-3 h-3 mr-1" />
              Pause
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); onResume?.(loop); }}
            >
              <Play className="w-3 h-3 mr-1" />
              Resume
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onStop?.(loop); }}
          >
            <StopCircle className="w-3 h-3 mr-1" />
            Stop
          </Button>
        </div>
      )}

      {/* Error Message */}
      {loop.status === 'failed' && loop.error && (
        <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
          {loop.error}
        </div>
      )}
    </div>
  );
}

// ========== New Loop Dialog ==========

interface NewLoopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { prompt: string; tool?: string; mode?: string }) => void;
  isCreating: boolean;
}

function NewLoopDialog({ open, onOpenChange, onSubmit, isCreating }: NewLoopDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [tool, setTool] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit({ prompt: prompt.trim(), tool: tool || undefined });
      setPrompt('');
      setTool('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start New Loop</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-foreground">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your development loop prompt..."
              className="mt-1 w-full min-h-[100px] p-3 bg-background border border-input rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">CLI Tool (optional)</label>
            <Input
              value={tool}
              onChange={(e) => setTool(e.target.value)}
              placeholder="e.g., gemini, qwen, codex"
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !prompt.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Loop
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ========== Main Page Component ==========

export function LoopMonitorPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewLoopOpen, setIsNewLoopOpen] = useState(false);

  const {
    loops,
    loopsByStatus,
    runningCount,
    completedCount,
    failedCount,
    isLoading,
    isFetching,
    refetch,
  } = useLoops({
    filter: searchQuery ? { search: searchQuery } : undefined,
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
  });

  const { createLoop, updateStatus, isCreating } = useLoopMutations();

  // Kanban columns
  const columns = useLoopKanbanColumns(loopsByStatus as unknown as Record<string, LoopKanbanItem[]>);

  // Handle drag and drop status change
  const handleDragEnd = useCallback(
    async (result: DropResult, _source: string, destination: string) => {
      const loopId = result.draggableId;
      const newStatus = destination as Loop['status'];

      // Only allow certain transitions
      const allowedTransitions: Record<Loop['status'], Loop['status'][]> = {
        created: ['running'],
        running: ['paused', 'completed', 'failed'],
        paused: ['running', 'completed'],
        completed: [],
        failed: ['created'], // Retry
      };

      const loop = loops.find((l) => l.id === loopId);
      if (!loop) return;

      if (!allowedTransitions[loop.status]?.includes(newStatus)) {
        return; // Invalid transition
      }

      // Map status to action
      const actionMap: Record<Loop['status'], 'pause' | 'resume' | 'stop' | null> = {
        paused: 'pause',
        running: 'resume',
        completed: 'stop',
        failed: 'stop',
        created: null,
      };

      const action = actionMap[newStatus];
      if (action) {
        await updateStatus(loopId, action);
      }
    },
    [loops, updateStatus]
  );

  const handlePause = async (loop: Loop) => {
    await updateStatus(loop.id, 'pause');
  };

  const handleResume = async (loop: Loop) => {
    await updateStatus(loop.id, 'resume');
  };

  const handleStop = async (loop: Loop) => {
    await updateStatus(loop.id, 'stop');
  };

  const handleCreateLoop = async (data: { prompt: string; tool?: string; mode?: string }) => {
    await createLoop(data);
    setIsNewLoopOpen(false);
  };

  // Custom item renderer for loops
  const renderLoopItem = useCallback(
    (item: LoopKanbanItem, provided: DraggableProvided) => (
      <LoopCard
        loop={item as unknown as Loop}
        provided={provided}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        onClick={() => {}}
      />
    ),
    []
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-primary" />
            Loop Monitor
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and control running development loops
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('w-4 h-4 mr-2', isFetching && 'animate-spin')} />
            Refresh
          </Button>
          <Button onClick={() => setIsNewLoopOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Loop
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold">{runningCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Running</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Pause className="w-5 h-5 text-warning" />
            <span className="text-2xl font-bold">{loopsByStatus.paused?.length || 0}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Paused</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            <span className="text-2xl font-bold">{completedCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Completed</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive" />
            <span className="text-2xl font-bold">{failedCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Failed</p>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search loops..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="p-4">
              <div className="h-6 w-20 bg-muted animate-pulse rounded mb-4" />
              <div className="space-y-2">
                {[1, 2].map((j) => (
                  <div key={j} className="h-24 bg-muted animate-pulse rounded" />
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : loops.length === 0 && !searchQuery ? (
        <Card className="p-8 text-center">
          <RefreshCw className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            No active loops
          </h3>
          <p className="mt-2 text-muted-foreground">
            Start a new development loop to begin monitoring progress.
          </p>
          <Button className="mt-4" onClick={() => setIsNewLoopOpen(true)}>
            <Play className="w-4 h-4 mr-2" />
            Start New Loop
          </Button>
        </Card>
      ) : (
        <KanbanBoard
          columns={columns}
          onDragEnd={handleDragEnd}
          renderItem={renderLoopItem}
          emptyColumnMessage="No loops"
          className="min-h-[400px]"
        />
      )}

      {/* New Loop Dialog */}
      <NewLoopDialog
        open={isNewLoopOpen}
        onOpenChange={setIsNewLoopOpen}
        onSubmit={handleCreateLoop}
        isCreating={isCreating}
      />
    </div>
  );
}

export default LoopMonitorPage;
