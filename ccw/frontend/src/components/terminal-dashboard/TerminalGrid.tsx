// ========================================
// TerminalGrid Component
// ========================================
// Recursive Allotment renderer for the terminal split pane layout.
// Mirrors the LayoutContainer pattern from cli-viewer but renders
// TerminalPane components as leaf nodes.

import { useCallback, useMemo } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { cn } from '@/lib/utils';
import { isPaneId } from '@/lib/layout-utils';
import {
  useTerminalGridStore,
  selectTerminalGridLayout,
  selectTerminalGridPanes,
} from '@/stores/terminalGridStore';
import type { AllotmentLayoutGroup } from '@/stores/viewerStore';
import { TerminalPane } from './TerminalPane';

// ========== Types ==========

interface GridGroupRendererProps {
  group: AllotmentLayoutGroup;
  minSize: number;
  onSizeChange: (sizes: number[]) => void;
}

// ========== Recursive Group Renderer ==========

function GridGroupRenderer({ group, minSize, onSizeChange }: GridGroupRendererProps) {
  const panes = useTerminalGridStore(selectTerminalGridPanes);

  const handleChange = useCallback(
    (sizes: number[]) => {
      onSizeChange(sizes);
    },
    [onSizeChange]
  );

  const validChildren = useMemo(() => {
    return group.children.filter((child) => {
      if (isPaneId(child)) {
        return panes[child] !== undefined;
      }
      return true;
    });
  }, [group.children, panes]);

  if (validChildren.length === 0) {
    return null;
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
            <TerminalPane paneId={child} />
          ) : (
            <GridGroupRenderer
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

export function TerminalGrid({ className }: { className?: string }) {
  const layout = useTerminalGridStore(selectTerminalGridLayout);
  const panes = useTerminalGridStore(selectTerminalGridPanes);
  const setLayout = useTerminalGridStore((s) => s.setLayout);

  const handleSizeChange = useCallback(
    (sizes: number[]) => {
      setLayout({ ...layout, sizes });
    },
    [layout, setLayout]
  );

  const content = useMemo(() => {
    if (!layout.children || layout.children.length === 0) {
      return null;
    }

    // Single pane: render directly without Allotment wrapper
    if (layout.children.length === 1 && isPaneId(layout.children[0])) {
      const paneId = layout.children[0];
      if (!panes[paneId]) return null;
      return <TerminalPane paneId={paneId} />;
    }

    return (
      <GridGroupRenderer
        group={layout}
        minSize={150}
        onSizeChange={handleSizeChange}
      />
    );
  }, [layout, panes, handleSizeChange]);

  return (
    <div className={cn('h-full w-full overflow-hidden bg-background', className)}>
      {content}
    </div>
  );
}
