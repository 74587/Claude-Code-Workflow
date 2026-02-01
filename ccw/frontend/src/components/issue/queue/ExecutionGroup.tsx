// ========================================
// ExecutionGroup Component
// ========================================
// Expandable execution group for queue items

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { ChevronDown, ChevronRight, GitMerge, ArrowRight } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { QueueItem } from '@/lib/api';

// ========== Types ==========

export interface ExecutionGroupProps {
  group: string;
  items: QueueItem[];
  type?: 'parallel' | 'sequential';
  onItemClick?: (item: QueueItem) => void;
}

// ========== Component ==========

export function ExecutionGroup({ group, items, type = 'sequential', onItemClick }: ExecutionGroupProps) {
  const { formatMessage } = useIntl();
  const [isExpanded, setIsExpanded] = useState(false);
  const isParallel = type === 'parallel';

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <Badge
              variant={isParallel ? 'info' : 'secondary'}
              className="gap-1"
            >
              {isParallel ? (
                <GitMerge className="w-3 h-3" />
              ) : (
                <ArrowRight className="w-3 h-3" />
              )}
              {group}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {isParallel
                ? formatMessage({ id: 'issues.queue.parallelGroup' })
                : formatMessage({ id: 'issues.queue.sequentialGroup' })}
            </span>
          </div>
          <Badge variant="outline" className="text-xs">
            {formatMessage({ id: 'issues.queue.itemCount' }, { count: items.length })}
          </Badge>
        </div>
      </CardHeader>

      {isExpanded && (
        <div className="px-4 pb-4 pt-0">
          <div className={cn(
            "space-y-1 mt-2",
            isParallel ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "space-y-1"
          )}>
            {items.map((item, index) => {
              // Parse item_id to extract type and ID
              const [itemType, ...idParts] = item.item_id.split('-');
              const displayId = idParts.join('-');
              const typeLabel = itemType === 'issue' ? formatMessage({ id: 'issues.solution.shortIssue' })
                : itemType === 'solution' ? formatMessage({ id: 'issues.solution.shortSolution' })
                : itemType;

              return (
                <div
                  key={item.item_id}
                  onClick={() => onItemClick?.(item)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm",
                    "hover:bg-muted transition-colors cursor-pointer"
                  )}
                >
                  <span className="text-muted-foreground text-xs w-6">
                    {isParallel ? '' : `${index + 1}.`}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {typeLabel}
                  </span>
                  <span className="font-mono text-xs truncate flex-1">
                    {displayId}
                  </span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {formatMessage({ id: `issues.queue.status.${item.status}` })}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

export default ExecutionGroup;
