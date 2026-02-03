// ========================================
// CLI Viewer Page
// ========================================
// Multi-pane CLI output viewer with configurable layouts
// Integrates with viewerStore for state management

import { useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  Terminal,
  LayoutGrid,
  Columns,
  Rows,
  Square,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/Dropdown';
import { cn } from '@/lib/utils';
import { LayoutContainer } from '@/components/cli-viewer';
import {
  useViewerStore,
  useViewerLayout,
  useViewerPanes,
  useFocusedPaneId,
  type AllotmentLayout,
} from '@/stores/viewerStore';

// ========================================
// Types
// ========================================

export type LayoutType = 'single' | 'split-h' | 'split-v' | 'grid-2x2';

interface LayoutOption {
  id: LayoutType;
  icon: React.ElementType;
  labelKey: string;
}

// ========================================
// Constants
// ========================================

const LAYOUT_OPTIONS: LayoutOption[] = [
  { id: 'single', icon: Square, labelKey: 'cliViewer.layout.single' },
  { id: 'split-h', icon: Columns, labelKey: 'cliViewer.layout.splitH' },
  { id: 'split-v', icon: Rows, labelKey: 'cliViewer.layout.splitV' },
  { id: 'grid-2x2', icon: LayoutGrid, labelKey: 'cliViewer.layout.grid' },
];

const DEFAULT_LAYOUT: LayoutType = 'split-h';

// ========================================
// Helper Functions
// ========================================

/**
 * Detect layout type from AllotmentLayout structure
 */
function detectLayoutType(layout: AllotmentLayout): LayoutType {
  const childCount = layout.children.length;

  // Empty or single pane
  if (childCount === 0 || childCount === 1) {
    return 'single';
  }

  // Two panes at root level
  if (childCount === 2) {
    const hasNestedGroups = layout.children.some(
      (child) => typeof child !== 'string'
    );

    // If no nested groups, it's a simple split
    if (!hasNestedGroups) {
      return layout.direction === 'horizontal' ? 'split-h' : 'split-v';
    }

    // Check for grid layout (2x2)
    const allNested = layout.children.every(
      (child) => typeof child !== 'string'
    );
    if (allNested) {
      return 'grid-2x2';
    }
  }

  // Default to current direction
  return layout.direction === 'horizontal' ? 'split-h' : 'split-v';
}

/**
 * Count total panes in layout
 */
function countPanes(layout: AllotmentLayout): number {
  let count = 0;
  const traverse = (children: (string | AllotmentLayout)[]) => {
    for (const child of children) {
      if (typeof child === 'string') {
        count++;
      } else {
        traverse(child.children);
      }
    }
  };
  traverse(layout.children);
  return count;
}

// ========================================
// Main Component
// ========================================

export function CliViewerPage() {
  const { formatMessage } = useIntl();
  const [searchParams, setSearchParams] = useSearchParams();

  // Store hooks
  const layout = useViewerLayout();
  const panes = useViewerPanes();
  const focusedPaneId = useFocusedPaneId();
  const { initializeDefaultLayout, addTab, reset } = useViewerStore();

  // Detect current layout type from store
  const currentLayoutType = useMemo(() => detectLayoutType(layout), [layout]);

  // Count active sessions (tabs across all panes)
  const activeSessionCount = useMemo(() => {
    return Object.values(panes).reduce((count, pane) => count + pane.tabs.length, 0);
  }, [panes]);

  // Initialize layout if empty
  useEffect(() => {
    const paneCount = countPanes(layout);
    if (paneCount === 0) {
      initializeDefaultLayout(DEFAULT_LAYOUT);
    }
  }, [layout, initializeDefaultLayout]);

  // Handle executionId from URL params
  useEffect(() => {
    const executionId = searchParams.get('executionId');
    if (executionId && focusedPaneId) {
      // Add tab to focused pane
      addTab(focusedPaneId, executionId, `Execution ${executionId.slice(0, 8)}`);

      // Clear the URL param after processing
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('executionId');
        return newParams;
      });
    }
  }, [searchParams, focusedPaneId, addTab, setSearchParams]);

  // Handle layout change
  const handleLayoutChange = useCallback(
    (layoutType: LayoutType) => {
      initializeDefaultLayout(layoutType);
    },
    [initializeDefaultLayout]
  );

  // Handle reset
  const handleReset = useCallback(() => {
    reset();
    initializeDefaultLayout(DEFAULT_LAYOUT);
  }, [reset, initializeDefaultLayout]);

  // Get current layout option for display
  const currentLayoutOption =
    LAYOUT_OPTIONS.find((l) => l.id === currentLayoutType) || LAYOUT_OPTIONS[1];
  const CurrentLayoutIcon = currentLayoutOption.icon;

  return (
    <div className="h-full flex flex-col -m-4 md:-m-6">
      {/* ======================================== */}
      {/* Toolbar */}
      {/* ======================================== */}
      <div className="flex items-center justify-between gap-3 p-3 bg-card border-b border-border">
        {/* Page Title */}
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'cliViewer.page.title' })}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatMessage(
                { id: 'cliViewer.page.subtitle' },
                { count: activeSessionCount }
              )}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Reset Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            title={formatMessage({ id: 'cliViewer.toolbar.clearAll' })}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          {/* Layout Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CurrentLayoutIcon className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {formatMessage({ id: currentLayoutOption.labelKey })}
                </span>
                <ChevronDown className="w-4 h-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {formatMessage({ id: 'cliViewer.layout.title' })}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LAYOUT_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <DropdownMenuItem
                    key={option.id}
                    onClick={() => handleLayoutChange(option.id)}
                    className={cn(
                      'gap-2',
                      currentLayoutType === option.id && 'bg-accent'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {formatMessage({ id: option.labelKey })}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ======================================== */}
      {/* Layout Container */}
      {/* ======================================== */}
      <div className="flex-1 min-h-0 bg-background">
        <LayoutContainer />
      </div>
    </div>
  );
}

export default CliViewerPage;
