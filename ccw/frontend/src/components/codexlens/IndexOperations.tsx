// ========================================
// CodexLens Index Operations Component
// ========================================
// Index management operations with progress tracking

import { useIntl } from 'react-intl';
import { useEffect, useState } from 'react';
import {
  RotateCw,
  Zap,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import {
  useCodexLensIndexingStatus,
  useRebuildIndex,
  useUpdateIndex,
  useCancelIndexing,
} from '@/hooks';
import { useNotifications } from '@/hooks/useNotifications';
import { useWebSocket } from '@/hooks/useWebSocket';

interface IndexOperationsProps {
  disabled?: boolean;
  onRefresh?: () => void;
}

interface IndexProgress {
  stage: string;
  message: string;
  percent: number;
  path?: string;
}

type IndexOperation = {
  id: string;
  type: 'fts_full' | 'fts_incremental' | 'vector_full' | 'vector_incremental';
  label: string;
  description: string;
  icon: React.ReactNode;
};

export function IndexOperations({ disabled = false, onRefresh }: IndexOperationsProps) {
  const { formatMessage } = useIntl();
  const { success, error: showError } = useNotifications();
  const projectPath = useWorkflowStore(selectProjectPath);
  const { inProgress } = useCodexLensIndexingStatus();
  const { rebuildIndex, isRebuilding } = useRebuildIndex();
  const { updateIndex, isUpdating } = useUpdateIndex();
  const { cancelIndexing, isCancelling } = useCancelIndexing();
  const { lastMessage } = useWebSocket();

  const [indexProgress, setIndexProgress] = useState<IndexProgress | null>(null);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);

  // Listen for WebSocket progress updates
  useEffect(() => {
    if (lastMessage?.type === 'CODEXLENS_INDEX_PROGRESS') {
      const progress = lastMessage.payload as IndexProgress;
      setIndexProgress(progress);

      // Clear active operation when complete or error
      if (progress.stage === 'complete' || progress.stage === 'error' || progress.stage === 'cancelled') {
        if (progress.stage === 'complete') {
          success(
            formatMessage({ id: 'codexlens.index.operationComplete' }),
            progress.message
          );
          onRefresh?.();
        } else if (progress.stage === 'error') {
          showError(
            formatMessage({ id: 'codexlens.index.operationFailed' }),
            progress.message
          );
        }
        setActiveOperation(null);
        setIndexProgress(null);
      }
    }
  }, [lastMessage, formatMessage, success, showError, onRefresh]);

  const isOperating = isRebuilding || isUpdating || inProgress || !!activeOperation;

  const handleOperation = async (operation: IndexOperation) => {
    if (!projectPath) {
      showError(
        formatMessage({ id: 'codexlens.index.noProject' }),
        formatMessage({ id: 'codexlens.index.noProjectDesc' })
      );
      return;
    }

    setActiveOperation(operation.id);
    setIndexProgress({ stage: 'start', message: formatMessage({ id: 'codexlens.index.starting' }), percent: 0 });

    try {
      // Determine index type and operation
      const isVector = operation.type.includes('vector');
      const isIncremental = operation.type.includes('incremental');

      if (isIncremental) {
        const result = await updateIndex(projectPath, {
          indexType: isVector ? 'vector' : 'normal',
        });
        if (!result.success) {
          throw new Error(result.error || 'Update failed');
        }
      } else {
        const result = await rebuildIndex(projectPath, {
          indexType: isVector ? 'vector' : 'normal',
        });
        if (!result.success) {
          throw new Error(result.error || 'Rebuild failed');
        }
      }
    } catch (err) {
      setActiveOperation(null);
      setIndexProgress(null);
      showError(
        formatMessage({ id: 'codexlens.index.operationFailed' }),
        err instanceof Error ? err.message : formatMessage({ id: 'codexlens.index.unknownError' })
      );
    }
  };

  const handleCancel = async () => {
    const result = await cancelIndexing();
    if (result.success) {
      setActiveOperation(null);
      setIndexProgress(null);
    } else {
      showError(
        formatMessage({ id: 'codexlens.index.cancelFailed' }),
        result.error || formatMessage({ id: 'codexlens.index.unknownError' })
      );
    }
  };

  const operations: IndexOperation[] = [
    {
      id: 'fts_full',
      type: 'fts_full',
      label: formatMessage({ id: 'codexlens.overview.actions.ftsFull' }),
      description: formatMessage({ id: 'codexlens.overview.actions.ftsFullDesc' }),
      icon: <RotateCw className="w-4 h-4" />,
    },
    {
      id: 'fts_incremental',
      type: 'fts_incremental',
      label: formatMessage({ id: 'codexlens.overview.actions.ftsIncremental' }),
      description: formatMessage({ id: 'codexlens.overview.actions.ftsIncrementalDesc' }),
      icon: <Zap className="w-4 h-4" />,
    },
    {
      id: 'vector_full',
      type: 'vector_full',
      label: formatMessage({ id: 'codexlens.overview.actions.vectorFull' }),
      description: formatMessage({ id: 'codexlens.overview.actions.vectorFullDesc' }),
      icon: <RotateCw className="w-4 h-4" />,
    },
    {
      id: 'vector_incremental',
      type: 'vector_incremental',
      label: formatMessage({ id: 'codexlens.overview.actions.vectorIncremental' }),
      description: formatMessage({ id: 'codexlens.overview.actions.vectorIncrementalDesc' }),
      icon: <Zap className="w-4 h-4" />,
    },
  ];

  if (indexProgress && activeOperation) {
    const operation = operations.find((op) => op.id === activeOperation);
    const isComplete = indexProgress.stage === 'complete';
    const isError = indexProgress.stage === 'error';
    const isCancelled = indexProgress.stage === 'cancelled';

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>{operation?.label}</span>
            {!isComplete && !isError && !isCancelled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isCancelling}
              >
                <X className="w-4 h-4 mr-1" />
                {formatMessage({ id: 'common.actions.cancel' })}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Icon */}
          <div className="flex items-center gap-3">
            {isComplete ? (
              <CheckCircle2 className="w-6 h-6 text-success" />
            ) : isError || isCancelled ? (
              <AlertCircle className="w-6 h-6 text-destructive" />
            ) : (
              <RotateCw className="w-6 h-6 text-primary animate-spin" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {isComplete
                  ? formatMessage({ id: 'codexlens.index.complete' })
                  : isError
                    ? formatMessage({ id: 'codexlens.index.failed' })
                    : isCancelled
                      ? formatMessage({ id: 'codexlens.index.cancelled' })
                      : formatMessage({ id: 'codexlens.index.inProgress' })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{indexProgress.message}</p>
            </div>
          </div>

          {/* Progress Bar */}
          {!isComplete && !isError && !isCancelled && (
            <div className="space-y-2">
              <Progress value={indexProgress.percent} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">
                {indexProgress.percent}%
              </p>
            </div>
          )}

          {/* Close Button */}
          {(isComplete || isError || isCancelled) && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveOperation(null);
                  setIndexProgress(null);
                }}
              >
                {formatMessage({ id: 'common.actions.close' })}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {formatMessage({ id: 'codexlens.overview.actions.title' })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {operations.map((operation) => (
            <Button
              key={operation.id}
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2 text-left"
              onClick={() => handleOperation(operation)}
              disabled={disabled || isOperating}
            >
              <div className="flex items-center gap-2 w-full">
                <span className={cn('text-muted-foreground', (disabled || isOperating) && 'opacity-50')}>
                  {operation.icon}
                </span>
                <span className="font-medium">{operation.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{operation.description}</p>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default IndexOperations;
