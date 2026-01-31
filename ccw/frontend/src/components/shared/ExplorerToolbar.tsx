// ========================================
// ExplorerToolbar Component
// ========================================
// Toolbar component for File Explorer with search and controls

import { Search, X, ChevronDown, RefreshCw, List, Grid, ChevronRight, ChevronDown as ChevronDownIcon } from 'lucide-react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/Dropdown';
import type { RootDirectory } from '@/lib/api';
import type { ExplorerViewMode, ExplorerSortOrder } from '@/types/file-explorer';

export interface ExplorerToolbarProps {
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Callback when search is cleared */
  onSearchClear: () => void;
  /** Callback when refresh is requested */
  onRefresh: () => void;
  /** Available root directories */
  rootDirectories: RootDirectory[];
  /** Currently selected root directory */
  selectedRoot: string;
  /** Callback when root directory changes */
  onRootChange: (path: string) => void;
  /** Loading state for root directories */
  isLoadingRoots?: boolean;
  /** Current view mode */
  viewMode: ExplorerViewMode;
  /** Callback when view mode changes */
  onViewModeChange: (mode: ExplorerViewMode) => void;
  /** Current sort order */
  sortOrder: ExplorerSortOrder;
  /** Callback when sort order changes */
  onSortOrderChange: (order: ExplorerSortOrder) => void;
  /** Whether to show hidden files */
  showHiddenFiles: boolean;
  /** Callback when show hidden files toggles */
  onToggleShowHidden: () => void;
  /** Callback to expand all directories */
  onExpandAll?: () => void;
  /** Callback to collapse all directories */
  onCollapseAll?: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * Get root directory display name
 */
function getRootDisplayName(root: RootDirectory): string {
  if (root.name) return root.name;
  const parts = root.path.split(/[/\\]/);
  return parts[parts.length - 1] || root.path;
}

/**
 * ExplorerToolbar component
 *
 * @example
 * ```tsx
 * <ExplorerToolbar
 *   searchQuery={filter}
 *   onSearchChange={setFilter}
 *   onSearchClear={() => setFilter('')}
 *   onRefresh={refetch}
 *   rootDirectories={rootDirectories}
 *   selectedRoot={rootPath}
 *   onRootChange={(path) => setRootPath(path)}
 *   viewMode={viewMode}
 *   onViewModeChange={setViewMode}
 *   sortOrder={sortOrder}
 *   onSortOrderChange={setSortOrder}
 *   showHiddenFiles={showHiddenFiles}
 *   onToggleShowHidden={toggleShowHidden}
 * />
 * ```
 */
export function ExplorerToolbar({
  searchQuery,
  onSearchChange,
  onSearchClear,
  onRefresh,
  rootDirectories,
  selectedRoot,
  onRootChange,
  isLoadingRoots = false,
  viewMode,
  onViewModeChange,
  sortOrder,
  onSortOrderChange,
  showHiddenFiles,
  onToggleShowHidden,
  onExpandAll,
  onCollapseAll,
  className,
}: ExplorerToolbarProps) {
  const { formatMessage } = useIntl();

  const selectedRootDir = rootDirectories.find((r) => r.path === selectedRoot);

  // Handle sort order change
  const handleSortOrderChange = (order: ExplorerSortOrder) => {
    onSortOrderChange(order);
  };

  // Handle view mode change
  const handleViewModeChange = (mode: ExplorerViewMode) => {
    onViewModeChange(mode);
  };

  return (
    <div className={cn('flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30', className)}>
      {/* Root directory selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 max-w-[200px]">
            <span className="truncate">
              {selectedRootDir
                ? getRootDisplayName(selectedRootDir)
                : formatMessage({ id: 'explorer.toolbar.selectRoot' })
              }
            </span>
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>
            {formatMessage({ id: 'explorer.toolbar.rootDirectory' })}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {rootDirectories.map((root) => (
            <DropdownMenuItem
              key={root.path}
              onClick={() => onRootChange(root.path)}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                selectedRoot === root.path && 'bg-accent'
              )}
            >
              <span className="flex-1 truncate">{getRootDisplayName(root)}</span>
              {root.isWorkspace && (
                <span className="text-xs text-primary">WS</span>
              )}
              {root.isGitRoot && (
                <span className="text-xs text-success">GIT</span>
              )}
            </DropdownMenuItem>
          ))}
          {rootDirectories.length === 0 && !isLoadingRoots && (
            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
              {formatMessage({ id: 'explorer.toolbar.noRoots' })}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search input */}
      <div className="flex-1 max-w-sm relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={formatMessage({ id: 'explorer.toolbar.searchPlaceholder' })}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9 h-8"
        />
        {searchQuery && (
          <button
            onClick={onSearchClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={formatMessage({ id: 'common.actions.clear' })}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Refresh button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        title={formatMessage({ id: 'common.actions.refresh' })}
        className="h-8 w-8 p-0"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>

      {/* View mode dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            title={formatMessage({ id: 'explorer.toolbar.viewMode' })}
            className="h-8 w-8 p-0"
          >
            {viewMode === 'tree' ? (
              <ChevronRight className="h-4 w-4" />
            ) : viewMode === 'list' ? (
              <List className="h-4 w-4" />
            ) : (
              <Grid className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            {formatMessage({ id: 'explorer.toolbar.viewMode' })}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleViewModeChange('tree')}
            className={cn('cursor-pointer', viewMode === 'tree' && 'bg-accent')}
          >
            <ChevronRight className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'explorer.viewMode.tree' })}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleViewModeChange('list')}
            className={cn('cursor-pointer', viewMode === 'list' && 'bg-accent')}
          >
            <List className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'explorer.viewMode.list' })}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleViewModeChange('compact')}
            className={cn('cursor-pointer', viewMode === 'compact' && 'bg-accent')}
          >
            <Grid className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'explorer.viewMode.compact' })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort order dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            title={formatMessage({ id: 'explorer.toolbar.sortBy' })}
            className="h-8"
          >
            {formatMessage({ id: `explorer.sortOrder.${sortOrder}` })}
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            {formatMessage({ id: 'explorer.toolbar.sortBy' })}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleSortOrderChange('name')}
            className={cn('cursor-pointer', sortOrder === 'name' && 'bg-accent')}
          >
            {formatMessage({ id: 'explorer.sortOrder.name' })}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleSortOrderChange('size')}
            className={cn('cursor-pointer', sortOrder === 'size' && 'bg-accent')}
          >
            {formatMessage({ id: 'explorer.sortOrder.size' })}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleSortOrderChange('modified')}
            className={cn('cursor-pointer', sortOrder === 'modified' && 'bg-accent')}
          >
            {formatMessage({ id: 'explorer.sortOrder.modified' })}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleSortOrderChange('type')}
            className={cn('cursor-pointer', sortOrder === 'type' && 'bg-accent')}
          >
            {formatMessage({ id: 'explorer.sortOrder.type' })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* More options dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            title={formatMessage({ id: 'explorer.toolbar.moreOptions' })}
            className="h-8 w-8 p-0"
          >
            <ChevronDownIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            {formatMessage({ id: 'explorer.toolbar.options' })}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onToggleShowHidden}
            className={cn('cursor-pointer justify-between', showHiddenFiles && 'bg-accent')}
          >
            <span>{formatMessage({ id: 'explorer.toolbar.showHidden' })}</span>
            {showHiddenFiles && <span className="text-primary">✓</span>}
          </DropdownMenuItem>
          {onExpandAll && (
            <DropdownMenuItem
              onClick={onExpandAll}
              className="cursor-pointer"
            >
              {formatMessage({ id: 'explorer.toolbar.expandAll' })}
            </DropdownMenuItem>
          )}
          {onCollapseAll && (
            <DropdownMenuItem
              onClick={onCollapseAll}
              className="cursor-pointer"
            >
              {formatMessage({ id: 'explorer.toolbar.collapseAll' })}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default ExplorerToolbar;
