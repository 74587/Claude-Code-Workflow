// ========================================
// Left Sidebar Component
// ========================================
// Container with tab switching between NodeLibrary and InlineTemplatePanel

import { useIntl } from 'react-intl';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useFlowStore } from '@/stores';
import { NodeLibrary } from './NodeLibrary';
import { InlineTemplatePanel } from './InlineTemplatePanel';
import { useResizablePanel } from './useResizablePanel';
import { ResizeHandle } from './ResizeHandle';

// ========== Tab Configuration ==========

const TABS: Array<{ key: 'templates' | 'nodes'; labelKey: string }> = [
  { key: 'templates', labelKey: 'orchestrator.leftSidebar.tabTemplates' },
  { key: 'nodes', labelKey: 'orchestrator.leftSidebar.tabNodes' },
];

// ========== Main Component ==========

interface LeftSidebarProps {
  className?: string;
}

/**
 * Left sidebar container with collapsible panel and tab switching.
 * Renders either InlineTemplatePanel or NodeLibrary based on active tab.
 */
export function LeftSidebar({ className }: LeftSidebarProps) {
  const { formatMessage } = useIntl();
  const setIsPaletteOpen = useFlowStore((state) => state.setIsPaletteOpen);
  const leftPanelTab = useFlowStore((state) => state.leftPanelTab);
  const setLeftPanelTab = useFlowStore((state) => state.setLeftPanelTab);

  const { width, isResizing, handleMouseDown } = useResizablePanel({
    minWidth: 200,
    maxWidth: 400,
    defaultWidth: 288, // w-72 = 18rem = 288px
    storageKey: 'ccw-orchestrator.leftSidebar.width',
    direction: 'right',
  });

  return (
    <div
      className={cn(
        'h-full bg-card border-r border-border flex flex-col relative',
        isResizing && 'select-none',
        className
      )}
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-foreground">{formatMessage({ id: 'orchestrator.leftSidebar.workbench' })}</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsPaletteOpen(false)}
          title={formatMessage({ id: 'orchestrator.leftSidebar.collapse' })}
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setLeftPanelTab(tab.key)}
            className={cn(
              'flex-1 px-3 py-2 text-sm font-medium text-center transition-colors',
              'hover:text-foreground',
              leftPanelTab === tab.key
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground'
            )}
          >
            {formatMessage({ id: tab.labelKey })}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {leftPanelTab === 'templates' ? (
          <InlineTemplatePanel />
        ) : (
          <NodeLibrary />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border bg-muted/30">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">{formatMessage({ id: 'orchestrator.leftSidebar.tipLabel' })}</span> {formatMessage({ id: 'orchestrator.leftSidebar.dragOrDoubleClick' })}
        </div>
      </div>

      {/* Resize handle on right edge */}
      <ResizeHandle onMouseDown={handleMouseDown} position="right" />
    </div>
  );
}

export default LeftSidebar;
