// ========================================
// LayoutContainer Component
// ========================================
// Manages allotment-based split panes for CLI viewer

import { useCallback, useMemo } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { cn } from '@/lib/utils';
import {
  useViewerStore,
  useViewerLayout,
  useViewerPanes,
  type AllotmentLayoutGroup,
  type PaneId,
} from '@/stores/viewerStore';
import { PaneContent } from './PaneContent';
import { EmptyState } from './EmptyState';

// ========== Types ==========

interface LayoutGroupRendererProps {
  group: AllotmentLayoutGroup;
  minSize: number;
  onSizeChange: (sizes: number[]) => void;
}

interface LayoutContainerProps {
  className?: string;
}

// ========== Helper Functions ==========

/**
 * Check if a layout child is a pane ID (string) or a nested group
 */
function isPaneId(child: PaneId | AllotmentLayoutGroup): child is PaneId {
  return typeof child === 'string';
}

// ========== Helper Components ==========

/**
 * Renders a layout group with Allotment
 */
function LayoutGroupRenderer({ group, minSize, onSizeChange }: LayoutGroupRendererProps) {
  const panes = useViewerPanes();

  const handleChange = useCallback(
    (sizes: number[]) => {
      onSizeChange(sizes);
    },
    [onSizeChange]
  );

  // Check if all panes in this group exist
  const validChildren = useMemo(() => {
    return group.children.filter(child => {
      if (isPaneId(child)) {
        return panes[child] !== undefined;
      }
      return true; // Groups are always valid (they will recursively filter)
    });
  }, [group.children, panes]);

  if (validChildren.length === 0) {
    return <EmptyState />;
  }

  return (
    <Allotment
      vertical={group.direction === 'vertical'}
      defaultSizes={group.sizes}
      onChange={handleChange}
      className="h-full"
    >
      {validChildren.map((child, index) => (
        <Allotment.Pane key={isPaneId(child) ? child : `group-${index}`} minSize={minSize}>
          {isPaneId(child) ? (
            <PaneContent paneId={child} />
          ) : (
            <LayoutGroupRenderer
              group={child}
              minSize={minSize}
              onSizeChange={onSizeChange}
            />
          )}
        </Allotment.Pane>
      ))}
    </Allotment>
  );
}

// ========== Main Component ==========

/**
 * LayoutContainer - Main container for CLI viewer with split panes
 *
 * Features:
 * - Recursive rendering of nested allotment layouts
 * - Support for horizontal and vertical splits
 * - Minimum pane size enforcement
 * - Empty state handling
 */
export function LayoutContainer({ className }: LayoutContainerProps) {
  const layout = useViewerLayout();
  const panes = useViewerPanes();
  const setLayout = useViewerStore((state) => state.setLayout);

  const handleSizeChange = useCallback(
    (sizes: number[]) => {
      // Update the root layout with new sizes
      setLayout({ ...layout, sizes });
    },
    [layout, setLayout]
  );

  // Render based on layout type
  const content = useMemo(() => {
    // No children - show empty state
    if (!layout.children || layout.children.length === 0) {
      return <EmptyState />;
    }

    // Single pane layout
    if (layout.children.length === 1 && isPaneId(layout.children[0])) {
      const paneId = layout.children[0];
      if (!panes[paneId]) {
        return <EmptyState />;
      }
      return <PaneContent paneId={paneId} />;
    }

    // Group layout
    return (
      <LayoutGroupRenderer
        group={layout}
        minSize={200}
        onSizeChange={handleSizeChange}
      />
    );
  }, [layout, panes, handleSizeChange]);

  return (
    <div
      className={cn(
        'h-full w-full overflow-hidden',
        'bg-background',
        className
      )}
    >
      {content}
    </div>
  );
}

export default LayoutContainer;
