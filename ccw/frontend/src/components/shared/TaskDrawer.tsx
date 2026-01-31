// ========================================
// TaskDrawer Component
// ========================================
// Right-side task detail drawer with Overview/Flowchart/Files tabs

import * as React from 'react';
import { useIntl } from 'react-intl';
import { X, FileText, GitBranch, Folder, CheckCircle, Circle, Loader2, XCircle } from 'lucide-react';
import { Flowchart } from './Flowchart';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import type { LiteTask, FlowControl } from '@/lib/api';
import type { TaskData } from '@/types/store';

// ========== Types ==========

export interface TaskDrawerProps {
  task: LiteTask | TaskData | null;
  isOpen: boolean;
  onClose: () => void;
}

type TabValue = 'overview' | 'flowchart' | 'files';

// ========== Helper: Unified Task Access ==========

/**
 * Normalize task data to common interface
 */
function getTaskId(task: LiteTask | TaskData): string {
  if ('task_id' in task && task.task_id) return task.task_id;
  if ('id' in task) return task.id;
  return 'N/A';
}

function getTaskTitle(task: LiteTask | TaskData): string {
  return task.title || 'Untitled Task';
}

function getTaskDescription(task: LiteTask | TaskData): string | undefined {
  return task.description;
}

function getTaskStatus(task: LiteTask | TaskData): string {
  return task.status;
}

function getFlowControl(task: LiteTask | TaskData): FlowControl | undefined {
  if ('flow_control' in task) return task.flow_control;
  return undefined;
}

// Status configuration
const taskStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | null; icon: React.ComponentType<{ className?: string }> }> = {
  pending: {
    label: 'sessionDetail.taskDrawer.status.pending',
    variant: 'secondary',
    icon: Circle,
  },
  in_progress: {
    label: 'sessionDetail.taskDrawer.status.inProgress',
    variant: 'warning',
    icon: Loader2,
  },
  completed: {
    label: 'sessionDetail.taskDrawer.status.completed',
    variant: 'success',
    icon: CheckCircle,
  },
  blocked: {
    label: 'sessionDetail.taskDrawer.status.blocked',
    variant: 'destructive',
    icon: XCircle,
  },
  skipped: {
    label: 'sessionDetail.taskDrawer.status.skipped',
    variant: 'default',
    icon: Circle,
  },
  failed: {
    label: 'sessionDetail.taskDrawer.status.failed',
    variant: 'destructive',
    icon: XCircle,
  },
};

// ========== Component ==========

export function TaskDrawer({ task, isOpen, onClose }: TaskDrawerProps) {
  const { formatMessage } = useIntl();
  const [activeTab, setActiveTab] = React.useState<TabValue>('overview');

  // Reset to overview when task changes
  React.useEffect(() => {
    if (task) {
      setActiveTab('overview');
    }
  }, [task]);

  // ESC key to close
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!task || !isOpen) {
    return null;
  }

  const taskId = getTaskId(task);
  const taskTitle = getTaskTitle(task);
  const taskDescription = getTaskDescription(task);
  const taskStatus = getTaskStatus(task);
  const flowControl = getFlowControl(task);

  const statusConfig = taskStatusConfig[taskStatus] || taskStatusConfig.pending;
  const StatusIcon = statusConfig.icon;

  const hasFlowchart = !!flowControl?.implementation_approach && flowControl.implementation_approach.length > 0;
  const hasFiles = !!flowControl?.target_files && flowControl.target_files.length > 0;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity z-40 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-1/2 bg-background border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        style={{ minWidth: '400px', maxWidth: '800px' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border bg-card">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-muted-foreground">{taskId}</span>
              <Badge variant={statusConfig.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {formatMessage({ id: statusConfig.label })}
              </Badge>
            </div>
            <h2 id="drawer-title" className="text-lg font-semibold text-foreground">
              {taskTitle}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0 hover:bg-secondary">
            <X className="h-5 w-5" />
            <span className="sr-only">{formatMessage({ id: 'common.actions.close' })}</span>
          </Button>
        </div>

        {/* Tabs Navigation */}
        <div className="px-6 pt-4 bg-card">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">
                <FileText className="h-4 w-4 mr-2" />
                {formatMessage({ id: 'sessionDetail.taskDrawer.tabs.overview' })}
              </TabsTrigger>
              {hasFlowchart && (
                <TabsTrigger value="flowchart" className="flex-1">
                  <GitBranch className="h-4 w-4 mr-2" />
                  {formatMessage({ id: 'sessionDetail.taskDrawer.tabs.flowchart' })}
                </TabsTrigger>
              )}
              <TabsTrigger value="files" className="flex-1">
                <Folder className="h-4 w-4 mr-2" />
                {formatMessage({ id: 'sessionDetail.taskDrawer.tabs.files' })}
              </TabsTrigger>
            </TabsList>

            {/* Tab Content (scrollable) */}
            <div className="overflow-y-auto pr-2" style={{ height: 'calc(100vh - 200px)' }}>
              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-4 pb-6 focus-visible:outline-none">
                <div className="space-y-6">
                  {/* Description */}
                  {taskDescription && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-2">
                        {formatMessage({ id: 'sessionDetail.taskDrawer.overview.description' })}
                      </h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {taskDescription}
                      </p>
                    </div>
                  )}

                  {/* Pre-analysis Steps */}
                  {flowControl?.pre_analysis && flowControl.pre_analysis.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3">
                        {formatMessage({ id: 'sessionDetail.taskDrawer.overview.preAnalysis' })}
                      </h3>
                      <div className="space-y-3">
                        {flowControl.pre_analysis.map((step, index) => (
                          <div key={index} className="p-3 bg-card rounded-md border border-border shadow-sm">
                            <div className="flex items-start gap-2">
                              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{step.step}</p>
                                <p className="text-xs text-muted-foreground mt-1">{step.action}</p>
                                {step.commands && step.commands.length > 0 && (
                                  <div className="mt-2">
                                    <code className="text-xs bg-muted px-2 py-1 rounded border">
                                      {step.commands.join('; ')}
                                    </code>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Implementation Steps */}
                  {flowControl?.implementation_approach && flowControl.implementation_approach.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3">
                        {formatMessage({ id: 'sessionDetail.taskDrawer.overview.implementationSteps' })}
                      </h3>
                      <div className="space-y-3">
                        {flowControl.implementation_approach.map((step, index) => {
                          const isString = typeof step === 'string';
                          const title = isString ? step : (step.title || `Step ${step.step || index + 1}`);
                          const description = isString ? undefined : step.description;
                          const stepNumber = isString ? (index + 1) : (step.step || index + 1);

                          return (
                            <div key={index} className="p-3 bg-card rounded-md border border-border shadow-sm">
                              <div className="flex items-start gap-2">
                                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                                  {stepNumber}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground">{title}</p>
                                  {description && (
                                    <p className="text-xs text-muted-foreground mt-1">{description}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {!taskDescription &&
                    (!flowControl?.pre_analysis || flowControl.pre_analysis.length === 0) &&
                    (!flowControl?.implementation_approach || flowControl.implementation_approach.length === 0) && (
                      <div className="text-center py-12">
                        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground">
                          {formatMessage({ id: 'sessionDetail.taskDrawer.overview.empty' })}
                        </p>
                      </div>
                    )}
                </div>
              </TabsContent>

              {/* Flowchart Tab */}
              {hasFlowchart && (
                <TabsContent value="flowchart" className="mt-4 pb-6">
                  <Flowchart flowControl={flowControl!} className="min-h-[400px]" />
                </TabsContent>
              )}

              {/* Files Tab */}
              <TabsContent value="files" className="mt-4 pb-6">
                {hasFiles ? (
                  <div className="space-y-3">
                    {flowControl?.target_files?.map((file, index) => {
                      // Support multiple file formats: string, { path: string }, { name: string }, { path, name }
                      let displayPath: string;
                      if (typeof file === 'string') {
                        displayPath = file;
                      } else if (file && typeof file === 'object') {
                        displayPath = file.path || file.name || 'Unknown';
                      } else {
                        displayPath = 'Unknown';
                      }

                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-3 bg-card rounded-md border border-border shadow-sm hover:shadow-md transition-shadow"
                        >
                          <Folder className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm font-mono text-foreground">{displayPath}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">
                      {formatMessage({ id: 'sessionDetail.taskDrawer.files.empty' })}
                    </p>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </>
  );
}
