// ========================================
// ExplorerPage Component
// ========================================
// File Explorer page with tree view and file preview

import * as React from 'react';
import { useIntl } from 'react-intl';
import { useFileExplorer, useFileContent } from '@/hooks/useFileExplorer';
import { TreeView } from '@/components/shared/TreeView';
import { FilePreview } from '@/components/shared/FilePreview';
import { ExplorerToolbar } from '@/components/shared/ExplorerToolbar';
import { AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileSystemNode } from '@/types/file-explorer';

const DEFAULT_TREE_WIDTH = 300;
const MIN_TREE_WIDTH = 200;
const MAX_TREE_WIDTH = 600;

/**
 * ExplorerPage component - File Explorer with split pane layout
 */
export function ExplorerPage() {
  const { formatMessage } = useIntl();

  // Root path state
  const [rootPath, setRootPath] = React.useState('/');

  // Tree width state for resizable split pane
  const [treeWidth, setTreeWidth] = React.useState(DEFAULT_TREE_WIDTH);
  const [isResizing, setIsResizing] = React.useState(false);
  const treePanelRef = React.useRef<HTMLDivElement>(null);

  // File explorer hook
  const {
    state,
    rootNodes,
    isLoading,
    isFetching,
    error,
    refetch,
    setSelectedFile,
    toggleExpanded,
    expandAll,
    collapseAll,
    setViewMode,
    setSortOrder,
    toggleShowHidden,
    setFilter,
    rootDirectories,
    isLoadingRoots,
  } = useFileExplorer({
    rootPath,
    maxDepth: 5,
    enabled: true,
  });

  // File content hook
  const { content: fileContent, isLoading: isContentLoading, error: contentError } = useFileContent(
    state.selectedFile,
    { enabled: !!state.selectedFile }
  );

  // Handle node click
  const handleNodeClick = (node: FileSystemNode) => {
    if (node.type === 'file') {
      setSelectedFile(node.path);
    }
  };

  // Handle root directory change
  const handleRootChange = (path: string) => {
    setRootPath(path);
    setSelectedFile(null);
  };

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  // Handle resize move
  const handleResize = (e: MouseEvent) => {
    if (!treePanelRef.current) return;
    const newWidth = e.clientX;
    if (newWidth >= MIN_TREE_WIDTH && newWidth <= MAX_TREE_WIDTH) {
      setTreeWidth(newWidth);
    }
  };

  // Handle resize end
  const handleResizeEnd = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-2xl font-semibold text-foreground">
          {formatMessage({ id: 'explorer.title' })}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {formatMessage({ id: 'explorer.description' })}
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {formatMessage({ id: 'explorer.errors.loadFailed' })}
            </p>
            <p className="text-xs mt-0.5">{error.message}</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <ExplorerToolbar
        searchQuery={state.filter}
        onSearchChange={setFilter}
        onSearchClear={() => setFilter('')}
        onRefresh={refetch}
        rootDirectories={rootDirectories || []}
        selectedRoot={rootPath}
        onRootChange={handleRootChange}
        isLoadingRoots={isLoadingRoots}
        viewMode={state.viewMode}
        onViewModeChange={setViewMode}
        sortOrder={state.sortOrder}
        onSortOrderChange={setSortOrder}
        showHiddenFiles={state.showHiddenFiles}
        onToggleShowHidden={toggleShowHidden}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />

      {/* Main content - Split pane */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Tree view panel */}
        <div
          ref={treePanelRef}
          className="h-full flex flex-col bg-background border-r border-border"
          style={{ width: `${treeWidth}px`, minWidth: `${MIN_TREE_WIDTH}px`, maxWidth: `${MAX_TREE_WIDTH}px` }}
        >
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                {formatMessage({ id: 'explorer.tree.loading' })}
              </span>
            </div>
          )}

          {/* Tree view */}
          <div className={cn('flex-1 overflow-auto custom-scrollbar', isLoading && 'opacity-50')}>
            <TreeView
              nodes={rootNodes}
              expandedPaths={state.expandedPaths}
              selectedPath={state.selectedFile}
              onNodeClick={handleNodeClick}
              onToggle={toggleExpanded}
              showIcons
              showSizes={false}
            />
          </div>

          {/* Tree footer */}
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
            <span>
              {formatMessage(
                { id: 'explorer.tree.stats' },
                {
                  files: rootNodes.length,
                  loading: isFetching
                }
              )}
            </span>
            {rootPath !== '/' && (
              <span className="truncate ml-2" title={rootPath}>
                {rootPath}
              </span>
            )}
          </div>
        </div>

        {/* Resizable handle */}
        <div
          className={cn(
            'w-1 bg-border cursor-col-resize hover:bg-primary/50 transition-colors flex-shrink-0',
            isResizing && 'bg-primary'
          )}
          onMouseDown={handleResizeStart}
        />

        {/* File preview panel */}
        <div className="flex-1 min-w-0 h-full flex flex-col bg-background">
          <FilePreview
            fileContent={fileContent}
            isLoading={isContentLoading}
            error={contentError?.message}
            showLineNumbers
            maxSize={1024 * 1024} // 1MB
          />
        </div>
      </div>
    </div>
  );
}

export default ExplorerPage;
