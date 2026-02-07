// ========================================
// Interaction Mode Toggle Component
// ========================================
// Pan/Selection mode toggle for the orchestrator canvas

import { useIntl } from 'react-intl';
import { Hand, MousePointerClick } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/stores';

interface InteractionModeToggleProps {
  disabled?: boolean;
}

export function InteractionModeToggle({ disabled = false }: InteractionModeToggleProps) {
  const { formatMessage } = useIntl();
  const interactionMode = useFlowStore((state) => state.interactionMode);
  const toggleInteractionMode = useFlowStore((state) => state.toggleInteractionMode);

  return (
    <div className={cn(
      'flex items-center gap-1 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-1 shadow-sm',
      disabled && 'opacity-50 pointer-events-none'
    )}>
      <button
        onClick={() => { if (interactionMode !== 'pan') toggleInteractionMode(); }}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
          interactionMode === 'pan'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        title={formatMessage({ id: 'orchestrator.canvas.panMode', defaultMessage: 'Pan mode (drag to move canvas)' })}
      >
        <Hand className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => { if (interactionMode !== 'selection') toggleInteractionMode(); }}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
          interactionMode === 'selection'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        title={formatMessage({ id: 'orchestrator.canvas.selectionMode', defaultMessage: 'Selection mode (drag to select nodes)' })}
      >
        <MousePointerClick className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
