// ========================================
// Left Sidebar Component
// ========================================
// Container with tab switching between NodeLibrary and InlineTemplatePanel

import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useFlowStore } from '@/stores';
import { NodeLibrary } from './NodeLibrary';
import { InlineTemplatePanel } from './InlineTemplatePanel';

// ========== Tab Configuration ==========

const TABS: Array<{ key: 'templates' | 'nodes'; label: string }> = [
  { key: 'templates', label: '\u6A21\u677F\u5E93' },
  { key: 'nodes', label: '\u8282\u70B9\u5E93' },
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
  const isPaletteOpen = useFlowStore((state) => state.isPaletteOpen);
  const setIsPaletteOpen = useFlowStore((state) => state.setIsPaletteOpen);
  const leftPanelTab = useFlowStore((state) => state.leftPanelTab);
  const setLeftPanelTab = useFlowStore((state) => state.setLeftPanelTab);

  // Collapsed state
  if (!isPaletteOpen) {
    return (
      <div className={cn('w-10 bg-card border-r border-border flex flex-col items-center py-4', className)}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsPaletteOpen(true)}
          title="展开面板"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // Expanded state
  return (
    <div className={cn('w-72 bg-card border-r border-border flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-foreground">工作台</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsPaletteOpen(false)}
          title="折叠面板"
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
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {leftPanelTab === 'templates' ? (
        <InlineTemplatePanel />
      ) : (
        <NodeLibrary />
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border bg-muted/30">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Tip:</span> 拖拽到画布或双击添加
        </div>
      </div>
    </div>
  );
}

export default LeftSidebar;
