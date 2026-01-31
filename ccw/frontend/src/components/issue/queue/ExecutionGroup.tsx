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

// ========== Types ==========

export interface ExecutionGroupProps {
  group: string;
  items: string[];
  type?: 'parallel' | 'sequential';
}

// ========== Component ==========

export function ExecutionGroup({ group, items, type = 'sequential' }: ExecutionGroupProps) {
  const { formatMessage } = useIntl();
  const [isExpanded, setIsExpanded] = useState(true);
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
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Badge>
        </div>
      </CardHeader>

      {isExpanded && (
        <div className="px-4 pb-4 pt-0">
          <div className={cn(
            "space-y-1 mt-2",
            isParallel ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "space-y-1"
          )}>
            {items.map((item, index) => (
              <div
                key={item}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm",
                  "hover:bg-muted transition-colors"
                )}
              >
                <span className="text-muted-foreground text-xs w-6">
                  {isParallel ? '' : `${index + 1}.`}
                </span>
                <span className="font-mono text-xs truncate flex-1">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default ExecutionGroup;
