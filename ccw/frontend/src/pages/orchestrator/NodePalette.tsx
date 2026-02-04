// ========================================
// Node Palette Component
// ========================================
// Draggable node palette for creating new nodes

import { DragEvent, useState } from 'react';
import { useIntl } from 'react-intl';
import { MessageSquare, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useFlowStore } from '@/stores';
import { NODE_TYPE_CONFIGS } from '@/types/flow';

interface NodePaletteProps {
  className?: string;
}

/**
 * Draggable card for the unified Prompt Template node type
 */
function PromptTemplateCard() {
  const config = NODE_TYPE_CONFIGS['prompt-template'];

  // Handle drag start
  const onDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('application/reactflow-node-type', 'prompt-template');
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cn(
        'group flex items-center gap-3 p-3 rounded-lg border-2 bg-card cursor-grab transition-all',
        'hover:shadow-md hover:scale-[1.02] active:cursor-grabbing active:scale-[0.98]',
        'border-blue-500'
      )}
    >
      <div className="p-2 rounded-md text-white bg-blue-500 hover:bg-blue-600">
        <MessageSquare className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{config.label}</div>
        <div className="text-xs text-muted-foreground truncate">{config.description}</div>
      </div>
      <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export function NodePalette({ className }: NodePaletteProps) {
  const { formatMessage } = useIntl();
  const [isExpanded, setIsExpanded] = useState(true);
  const isPaletteOpen = useFlowStore((state) => state.isPaletteOpen);
  const setIsPaletteOpen = useFlowStore((state) => state.setIsPaletteOpen);

  if (!isPaletteOpen) {
    return (
      <div className={cn('w-10 bg-card border-r border-border flex flex-col items-center py-4', className)}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsPaletteOpen(true)}
          title={formatMessage({ id: 'orchestrator.palette.open' })}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('w-64 bg-card border-r border-border flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-foreground">{formatMessage({ id: 'orchestrator.palette.title' })}</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsPaletteOpen(false)}
          title={formatMessage({ id: 'orchestrator.palette.collapse' })}
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>

      {/* Instructions */}
      <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/50 border-b border-border">
        {formatMessage({ id: 'orchestrator.palette.instructions' })}
      </div>

      {/* Node Type Categories */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Execution Nodes */}
        <div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 w-full text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            {formatMessage({ id: 'orchestrator.palette.nodeTypes' })}
          </button>

          {isExpanded && (
            <div className="space-y-2">
              <PromptTemplateCard />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border bg-muted/30">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">{formatMessage({ id: 'orchestrator.palette.tipLabel' })}</span> {formatMessage({ id: 'orchestrator.palette.tip' })}
        </div>
      </div>
    </div>
  );
}

export default NodePalette;
