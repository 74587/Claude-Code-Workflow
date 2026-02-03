// ========================================
// PaneContent Component
// ========================================
// Container for TabBar and ContentArea within a pane

import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  useViewerStore,
  useViewerPanes,
  useFocusedPaneId,
  type PaneId,
} from '@/stores/viewerStore';
import { TabBar } from './TabBar';
import { ContentArea } from './ContentArea';

// ========== Types ==========

export interface PaneContentProps {
  paneId: PaneId;
  className?: string;
}

// ========== Component ==========

/**
 * PaneContent - Combines TabBar and ContentArea for a single pane
 *
 * Features:
 * - Focused pane highlighting
 * - Click to focus
 * - TabBar for tab management
 * - ContentArea for CLI output display
 */
export function PaneContent({ paneId, className }: PaneContentProps) {
  const panes = useViewerPanes();
  const pane = panes[paneId];
  const focusedPaneId = useFocusedPaneId();
  const setFocusedPane = useViewerStore((state) => state.setFocusedPane);

  const isFocused = focusedPaneId === paneId;

  const handleClick = useCallback(() => {
    if (!isFocused) {
      setFocusedPane(paneId);
    }
  }, [isFocused, paneId, setFocusedPane]);

  if (!pane) {
    return (
      <div className={cn('h-full flex items-center justify-center', className)}>
        <span className="text-muted-foreground text-sm">Pane not found</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'h-full flex flex-col',
        'bg-card dark:bg-surface-900',
        'border border-border/50',
        'rounded-sm overflow-hidden',
        // Focus ring when pane is focused
        isFocused && 'ring-1 ring-primary/50',
        className
      )}
      onClick={handleClick}
      role="region"
      aria-label={`CLI Viewer Pane ${paneId}`}
    >
      {/* Tab Bar */}
      <TabBar paneId={paneId} />

      {/* Content Area */}
      <ContentArea paneId={paneId} />
    </div>
  );
}

export default PaneContent;
