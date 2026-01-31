// ========================================
// QueueActions Component
// ========================================
// Queue operations menu component with delete confirmation and merge dialog

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Play, Pause, Trash2, Merge, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/Dropdown';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/AlertDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { IssueQueue } from '@/lib/api';

// ========== Types ==========

export interface QueueActionsProps {
  queue: IssueQueue;
  isActive?: boolean;
  onActivate?: (queueId: string) => void;
  onDeactivate?: () => void;
  onDelete?: (queueId: string) => void;
  onMerge?: (sourceId: string, targetId: string) => void;
  isActivating?: boolean;
  isDeactivating?: boolean;
  isDeleting?: boolean;
  isMerging?: boolean;
}

// ========== Component ==========

export function QueueActions({
  queue,
  isActive = false,
  onActivate,
  onDeactivate,
  onDelete,
  onMerge,
  isActivating = false,
  isDeactivating = false,
  isDeleting = false,
  isMerging = false,
}: QueueActionsProps) {
  const { formatMessage } = useIntl();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');

  // Get queue ID - IssueQueue interface doesn't have an id field, using tasks array as key
  const queueId = queue.tasks.join(',') || queue.solutions.join(',');

  const handleDelete = () => {
    onDelete?.(queueId);
    setIsDeleteOpen(false);
  };

  const handleMerge = () => {
    if (mergeTargetId.trim()) {
      onMerge?.(queueId, mergeTargetId.trim());
      setIsMergeOpen(false);
      setMergeTargetId('');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <span className="sr-only">{formatMessage({ id: 'common.actions.openMenu' })}</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isActive && onActivate && (
            <DropdownMenuItem onClick={() => onActivate(queueId)} disabled={isActivating}>
              {isActivating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {formatMessage({ id: 'issues.queue.actions.activate' })}
            </DropdownMenuItem>
          )}
          {isActive && onDeactivate && (
            <DropdownMenuItem onClick={() => onDeactivate()} disabled={isDeactivating}>
              {isDeactivating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Pause className="w-4 h-4 mr-2" />
              )}
              {formatMessage({ id: 'issues.queue.actions.deactivate' })}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setIsMergeOpen(true)} disabled={isMerging}>
            {isMerging ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Merge className="w-4 h-4 mr-2" />
            )}
            {formatMessage({ id: 'issues.queue.actions.merge' })}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsDeleteOpen(true)}
            disabled={isDeleting}
            className="text-destructive"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            {formatMessage({ id: 'issues.queue.actions.delete' })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {formatMessage({ id: 'issues.queue.deleteDialog.title' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage({ id: 'issues.queue.deleteDialog.description' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {formatMessage({ id: 'common.actions.cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {formatMessage({ id: 'common.actions.deleting' })}
                </>
              ) : (
                formatMessage({ id: 'issues.queue.actions.delete' })
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge Dialog */}
      <Dialog open={isMergeOpen} onOpenChange={setIsMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formatMessage({ id: 'issues.queue.mergeDialog.title' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="merge-target" className="text-sm font-medium text-foreground">
                {formatMessage({ id: 'issues.queue.mergeDialog.targetQueueLabel' })}
              </label>
              <Input
                id="merge-target"
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                placeholder={formatMessage({ id: 'issues.queue.mergeDialog.targetQueuePlaceholder' })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsMergeOpen(false);
                setMergeTargetId('');
              }}
            >
              {formatMessage({ id: 'common.actions.cancel' })}
            </Button>
            <Button
              onClick={handleMerge}
              disabled={!mergeTargetId.trim() || isMerging}
            >
              {isMerging ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {formatMessage({ id: 'common.actions.merging' })}
                </>
              ) : (
                <>
                  <Merge className="w-4 h-4 mr-2" />
                  {formatMessage({ id: 'issues.queue.actions.merge' })}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default QueueActions;
