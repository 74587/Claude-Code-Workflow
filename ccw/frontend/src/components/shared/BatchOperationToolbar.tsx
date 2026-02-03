// ========================================
// BatchOperationToolbar Component
// ========================================
// Toolbar for batch operations on prompts

import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Trash2, X } from 'lucide-react';

export interface BatchOperationToolbarProps {
  /** Number of selected items */
  selectedCount: number;
  /** Whether all items are selected */
  allSelected: boolean;
  /** Called when select all is toggled */
  onSelectAll: (selected: boolean) => void;
  /** Called when clear selection is triggered */
  onClearSelection: () => void;
  /** Called when batch delete is triggered */
  onDelete: () => void;
  /** Whether delete operation is in progress */
  isDeleting?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * BatchOperationToolbar component for bulk actions
 */
export function BatchOperationToolbar({
  selectedCount,
  allSelected,
  onSelectAll,
  onClearSelection,
  onDelete,
  isDeleting = false,
  className,
}: BatchOperationToolbarProps) {
  const { formatMessage } = useIntl();

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 p-3 bg-primary/10 rounded-lg border border-primary/20',
        className
      )}
    >
      {/* Selection info and select all */}
      <div className="flex items-center gap-3">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) => onSelectAll(checked === true)}
          aria-label={formatMessage({ id: 'prompts.batch.selectAll' })}
        />
        <span className="text-sm font-medium text-foreground">
          {formatMessage({ id: 'prompts.batch.selected' }, { count: selectedCount })}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={isDeleting}
        >
          <X className="h-4 w-4 mr-1" />
          {formatMessage({ id: 'prompts.batch.clearSelection' })}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          {formatMessage({ id: 'prompts.batch.deleteSelected' })}
        </Button>
      </div>
    </div>
  );
}

export default BatchOperationToolbar;
