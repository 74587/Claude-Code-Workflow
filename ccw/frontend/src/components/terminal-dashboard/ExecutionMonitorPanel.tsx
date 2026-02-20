// ========================================
// Execution Monitor Panel
// ========================================
// Panel for monitoring workflow executions in Terminal Dashboard.
// Displays execution progress, step list, and control buttons.

import { useIntl } from 'react-intl';
import {
  Play,
  Pause,
  Square,
  CheckCircle2,
  XCircle,
  Circle,
  Loader2,
  Clock,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import {
  useExecutionMonitorStore,
  selectCurrentExecution,
  selectActiveExecutions,
} from '@/stores/executionMonitorStore';
import type { ExecutionStatus, StepInfo } from '@/stores/executionMonitorStore';

// ========== Status Config ==========

const statusConfig: Record<ExecutionStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  running: { label: 'Running', color: 'text-primary', bgColor: 'bg-primary/10' },
  paused: { label: 'Paused', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  completed: { label: 'Completed', color: 'text-green-500', bgColor: 'bg-green-500/10' },
  failed: { label: 'Failed', color: 'text-destructive', bgColor: 'bg-destructive/10' },
  cancelled: { label: 'Cancelled', color: 'text-muted-foreground', bgColor: 'bg-muted' },
};

// ========== Step Status Icon ==========

function StepStatusIcon({ status }: { status: ExecutionStatus }) {
  switch (status) {
    case 'pending':
      return <Circle className="w-4 h-4 text-muted-foreground" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-destructive" />;
    case 'paused':
      return <Pause className="w-4 h-4 text-amber-500" />;
    case 'cancelled':
      return <Square className="w-4 h-4 text-muted-foreground" />;
    default:
      return <Circle className="w-4 h-4 text-muted-foreground opacity-50" />;
  }
}

// ========== Step List Item ==========

interface StepListItemProps {
  step: StepInfo;
  isCurrent: boolean;
}

function StepListItem({ step, isCurrent }: StepListItemProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 px-3 py-2 rounded-md transition-colors',
        isCurrent && step.status === 'running' && 'bg-primary/5 border border-primary/20',
        step.status === 'failed' && 'bg-destructive/5'
      )}
    >
      <div className="pt-0.5 shrink-0">
        <StepStatusIcon status={step.status} />
      </div>
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'text-sm font-medium truncate block',
            step.status === 'completed' && 'text-muted-foreground',
            step.status === 'running' && 'text-foreground',
            step.status === 'failed' && 'text-destructive'
          )}
        >
          {step.name}
        </span>
        {step.error && (
          <p className="text-xs text-destructive mt-1 truncate">{step.error}</p>
        )}
      </div>
    </div>
  );
}

// ========== Main Component ==========

export function ExecutionMonitorPanel() {
  const { formatMessage } = useIntl();

  const currentExecution = useExecutionMonitorStore(selectCurrentExecution);
  const activeExecutions = useExecutionMonitorStore(selectActiveExecutions);
  const selectExecution = useExecutionMonitorStore((s) => s.selectExecution);
  const pauseExecution = useExecutionMonitorStore((s) => s.pauseExecution);
  const resumeExecution = useExecutionMonitorStore((s) => s.resumeExecution);
  const stopExecution = useExecutionMonitorStore((s) => s.stopExecution);
  const clearExecution = useExecutionMonitorStore((s) => s.clearExecution);

  const executions = Object.values(activeExecutions);
  const hasExecutions = executions.length > 0;

  if (!hasExecutions) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <Terminal className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">
          {formatMessage({ id: 'executionMonitor.noExecutions', defaultMessage: 'No active executions' })}
        </p>
        <p className="text-xs mt-1 opacity-70">
          {formatMessage({ id: 'executionMonitor.sendToTerminal', defaultMessage: 'Send a workflow to terminal to start' })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Execution selector (if multiple) */}
      {executions.length > 1 && (
        <div className="border-b border-border p-2 shrink-0">
          <div className="flex flex-wrap gap-1">
            {executions.map((exec) => (
              <button
                key={exec.executionId}
                onClick={() => selectExecution(exec.executionId)}
                className={cn(
                  'px-2 py-1 text-xs rounded-md transition-colors truncate max-w-[120px]',
                  currentExecution?.executionId === exec.executionId
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                )}
              >
                {exec.flowName}
              </button>
            ))}
          </div>
        </div>
      )}

      {currentExecution && (
        <>
          {/* Header */}
          <div className="p-4 border-b border-border space-y-3 shrink-0">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-foreground truncate flex-1">
                {currentExecution.flowName}
              </h3>
              <Badge
                variant="secondary"
                className={cn('shrink-0', statusConfig[currentExecution.status].bgColor)}
              >
                {statusConfig[currentExecution.status].label}
              </Badge>
            </div>

            {/* Progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {formatMessage(
                    { id: 'executionMonitor.progress', defaultMessage: '{completed}/{total} steps' },
                    { completed: currentExecution.completedSteps, total: currentExecution.totalSteps || currentExecution.steps.length }
                  )}
                </span>
                <span>
                  {Math.round(
                    (currentExecution.completedSteps / (currentExecution.totalSteps || currentExecution.steps.length || 1)) * 100
                  )}%
                </span>
              </div>
              <Progress
                value={
                  (currentExecution.completedSteps / (currentExecution.totalSteps || currentExecution.steps.length || 1)) * 100
                }
                className="h-2"
              />
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(currentExecution.startedAt).toLocaleTimeString()}
              </span>
              <span className="flex items-center gap-1">
                <Terminal className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{currentExecution.sessionKey.slice(0, 20)}...</span>
              </span>
            </div>
          </div>

          {/* Step list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {currentExecution.steps.map((step) => (
              <StepListItem
                key={step.id}
                step={step}
                isCurrent={step.id === currentExecution.currentStepId}
              />
            ))}
          </div>

          {/* Control bar */}
          <div className="p-3 border-t border-border flex items-center gap-2 shrink-0">
            {currentExecution.status === 'running' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pauseExecution(currentExecution.executionId)}
                  className="gap-1.5"
                >
                  <Pause className="w-3.5 h-3.5" />
                  {formatMessage({ id: 'executionMonitor.pause', defaultMessage: 'Pause' })}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => stopExecution(currentExecution.executionId)}
                  className="gap-1.5"
                >
                  <Square className="w-3.5 h-3.5" />
                  {formatMessage({ id: 'executionMonitor.stop', defaultMessage: 'Stop' })}
                </Button>
              </>
            )}

            {currentExecution.status === 'paused' && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => resumeExecution(currentExecution.executionId)}
                  className="gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  {formatMessage({ id: 'executionMonitor.resume', defaultMessage: 'Resume' })}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => stopExecution(currentExecution.executionId)}
                  className="gap-1.5"
                >
                  <Square className="w-3.5 h-3.5" />
                  {formatMessage({ id: 'executionMonitor.stop', defaultMessage: 'Stop' })}
                </Button>
              </>
            )}

            {(currentExecution.status === 'completed' ||
              currentExecution.status === 'failed' ||
              currentExecution.status === 'cancelled') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearExecution(currentExecution.executionId)}
                className="gap-1.5 ml-auto"
              >
                {formatMessage({ id: 'executionMonitor.clear', defaultMessage: 'Clear' })}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ExecutionMonitorPanel;
