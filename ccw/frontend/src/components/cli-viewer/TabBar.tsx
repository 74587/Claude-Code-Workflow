// ========================================
// TabBar Component
// ========================================
// Tab management for CLI viewer panes

import { useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { X, Pin, PinOff, MoreHorizontal, SplitSquareHorizontal, SplitSquareVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import {
  useViewerStore,
  useViewerPanes,
  type PaneId,
  type TabState,
} from '@/stores/viewerStore';
import { ExecutionPicker } from './ExecutionPicker';

// ========== Types ==========

export interface TabBarProps {
  paneId: PaneId;
  className?: string;
}

interface TabItemProps {
  tab: TabState;
  isActive: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
  onTogglePin: (e: React.MouseEvent) => void;
}

// ========== Constants ==========

const STATUS_COLORS = {
  running: 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.4)] animate-pulse',
  completed: 'bg-emerald-500',
  error: 'bg-rose-500',
  idle: 'bg-slate-400 dark:bg-slate-500',
};

// ========== Helper Components ==========

/**
 * Individual tab item
 */
function TabItem({ tab, isActive, onSelect, onClose, onTogglePin }: TabItemProps) {
  // Simplify title for display
  const displayTitle = useMemo(() => {
    // If title contains tool name pattern, extract it
    const parts = tab.title.split('-');
    return parts[0] || tab.title;
  }, [tab.title]);

  return (
    <button
      onClick={onSelect}
      className={cn(
        'group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs',
        'border border-border/50 shrink-0 min-w-0 max-w-[160px]',
        'transition-all duration-150',
        isActive
          ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 shadow-sm'
          : 'bg-muted/30 hover:bg-muted/50 border-border/30',
        tab.isPinned && 'border-amber-500/50'
      )}
      title={tab.title}
    >
      {/* Status indicator dot */}
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_COLORS.idle)} />

      {/* Tool name */}
      <span className="font-medium text-[11px] truncate">{displayTitle}</span>

      {/* Pin indicator (always visible if pinned) */}
      {tab.isPinned && (
        <Pin className="h-2.5 w-2.5 text-amber-500 shrink-0" />
      )}

      {/* Action buttons (visible on hover) */}
      <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Pin/Unpin button */}
        <button
          onClick={onTogglePin}
          className="p-0.5 rounded hover:bg-primary/10 transition-colors"
          aria-label={tab.isPinned ? 'Unpin tab' : 'Pin tab'}
        >
          {tab.isPinned ? (
            <PinOff className="h-2.5 w-2.5 text-amber-500" />
          ) : (
            <Pin className="h-2.5 w-2.5 text-muted-foreground hover:text-amber-500" />
          )}
        </button>

        {/* Close button (hidden if pinned) */}
        {!tab.isPinned && (
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-rose-500/20 transition-colors"
            aria-label="Close tab"
          >
            <X className="h-2.5 w-2.5 text-rose-600 dark:text-rose-400" />
          </button>
        )}
      </div>
    </button>
  );
}

// ========== Main Component ==========

/**
 * TabBar - Manages tabs within a pane
 *
 * Features:
 * - Tab display with status indicators
 * - Active tab highlighting
 * - Close button on hover
 * - Pin/unpin functionality
 * - Pane actions dropdown
 */
export function TabBar({ paneId, className }: TabBarProps) {
  const { formatMessage } = useIntl();
  const panes = useViewerPanes();
  const pane = panes[paneId];
  const setActiveTab = useViewerStore((state) => state.setActiveTab);
  const removeTab = useViewerStore((state) => state.removeTab);
  const togglePinTab = useViewerStore((state) => state.togglePinTab);
  const addPane = useViewerStore((state) => state.addPane);
  const removePane = useViewerStore((state) => state.removePane);

  const handleTabSelect = useCallback(
    (tabId: string) => {
      setActiveTab(paneId, tabId);
    },
    [paneId, setActiveTab]
  );

  const handleTabClose = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      removeTab(paneId, tabId);
    },
    [paneId, removeTab]
  );

  const handleTogglePin = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      togglePinTab(tabId);
    },
    [togglePinTab]
  );

  const handleSplitHorizontal = useCallback(() => {
    addPane(paneId, 'horizontal');
  }, [paneId, addPane]);

  const handleSplitVertical = useCallback(() => {
    addPane(paneId, 'vertical');
  }, [paneId, addPane]);

  const handleClosePane = useCallback(() => {
    removePane(paneId);
  }, [paneId, removePane]);

  // Sort tabs: pinned first, then by order
  const sortedTabs = useMemo(() => {
    if (!pane) return [];
    return [...pane.tabs].sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return a.order - b.order;
    });
  }, [pane]);

  if (!pane) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-1.5',
        'bg-muted/30 border-b border-border/50',
        'overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent',
        className
      )}
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
        {sortedTabs.length === 0 ? (
          <span className="text-xs text-muted-foreground px-2">
            {formatMessage({ id: 'cliViewer.tabs.noTabs', defaultMessage: 'No tabs open' })}
          </span>
        ) : (
          sortedTabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={pane.activeTabId === tab.id}
              onSelect={() => handleTabSelect(tab.id)}
              onClose={(e) => handleTabClose(e, tab.id)}
              onTogglePin={(e) => handleTogglePin(e, tab.id)}
            />
          ))
        )}
      </div>

      {/* Add tab button */}
      <ExecutionPicker paneId={paneId} />

      {/* Pane actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            aria-label="Pane actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleSplitHorizontal}>
            <SplitSquareHorizontal className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'cliViewer.paneActions.splitHorizontal', defaultMessage: 'Split Horizontal' })}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSplitVertical}>
            <SplitSquareVertical className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'cliViewer.paneActions.splitVertical', defaultMessage: 'Split Vertical' })}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleClosePane}
            className="text-rose-600 dark:text-rose-400"
          >
            <X className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'cliViewer.paneActions.closePane', defaultMessage: 'Close Pane' })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default TabBar;
