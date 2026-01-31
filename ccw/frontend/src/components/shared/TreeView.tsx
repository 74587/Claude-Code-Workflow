// ========================================
// TreeView Component
// ========================================
// Recursive tree view component for file explorer using native HTML details/summary

import * as React from 'react';
import { ChevronRight, File, Folder, FolderOpen, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileSystemNode } from '@/types/file-explorer';

export interface TreeViewProps {
  /** Root nodes of the file tree */
  nodes: FileSystemNode[];
  /** Set of expanded directory paths */
  expandedPaths: Set<string>;
  /** Currently selected file path */
  selectedPath: string | null;
  /** Callback when node is clicked */
  onNodeClick?: (node: FileSystemNode) => void;
  /** Callback when node is double-clicked */
  onNodeDoubleClick?: (node: FileSystemNode) => void;
  /** Callback to toggle expanded state */
  onToggle?: (path: string) => void;
  /** Maximum depth to display (0 = unlimited) */
  maxDepth?: number;
  /** Current depth level */
  depth?: number;
  /** Whether to show file icons */
  showIcons?: boolean;
  /** Whether to show file sizes */
  showSizes?: boolean;
  /** Custom class name */
  className?: string;
}

interface TreeNodeProps {
  node: FileSystemNode;
  level: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  maxDepth?: number;
  showIcons?: boolean;
  showSizes?: boolean;
  onNodeClick?: (node: FileSystemNode) => void;
  onNodeDoubleClick?: (node: FileSystemNode) => void;
  onToggle?: (path: string) => void;
}

/**
 * Get file icon based on file extension
 */
function getFileIcon(fileName: string): React.ElementType {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  const codeExtensions = ['ts', 'tsx', 'js', 'jsx', 'vue', 'svelte', 'py', 'rb', 'go', 'rs', 'java', 'cs', 'php', 'scala', 'kt'];
  const configExtensions = ['json', 'yaml', 'yml', 'toml', 'ini', 'conf', 'xml', 'config'];
  
  if (codeExtensions.includes(ext || '')) {
    return FileCode;
  }
  if (configExtensions.includes(ext || '')) {
    return FileCode;
  }
  
  return File;
}

/**
 * Get file size in human-readable format
 */
function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)}${units[unitIndex]}`;
}

/**
 * TreeNode component - renders a single tree node with children
 */
function TreeNode({
  node,
  level,
  expandedPaths,
  selectedPath,
  maxDepth = 0,
  showIcons = true,
  showSizes = false,
  onNodeClick,
  onNodeDoubleClick,
  onToggle,
}: TreeNodeProps) {
  const isDirectory = node.type === 'directory';
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const hasChildren = isDirectory && node.children && node.children.length > 0;
  const shouldShowChildren = isExpanded && hasChildren;
  const isAtMaxDepth = maxDepth > 0 && level >= maxDepth;

  // Get icon component
  let Icon: React.ElementType = File;
  if (isDirectory) {
    Icon = isExpanded ? FolderOpen : Folder;
  } else if (showIcons) {
    Icon = getFileIcon(node.name);
  }

  // Handle click
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeClick?.(node);
    
    // Toggle directories on click
    if (isDirectory && hasChildren) {
      onToggle?.(node.path);
    }
  };

  // Handle double click
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeDoubleClick?.(node);
  };

  // Handle key press for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e as any);
    }
  };

  return (
    <div
      className={cn(
        'tree-node',
        isDirectory && 'tree-directory',
        isSelected && 'selected'
      )}
      role="treeitem"
      aria-expanded={isDirectory ? isExpanded : undefined}
      aria-selected={isSelected}
    >
      {/* Node content */}
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-sm cursor-pointer transition-colors',
          'hover:bg-hover hover:text-foreground',
          isSelected && 'bg-primary/10 text-primary',
          'text-foreground text-sm'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        title={node.path}
      >
        {/* Expand/collapse chevron for directories */}
        {isDirectory && (
          <ChevronRight
            className={cn(
              'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
              isExpanded && 'rotate-90'
            )}
          />
        )}
        
        {/* Folder/File icon */}
        {showIcons && (
          <Icon
            className={cn(
              'h-4 w-4 flex-shrink-0',
              isDirectory
                ? isExpanded
                  ? 'text-blue-500'
                  : 'text-blue-400'
                : 'text-muted-foreground'
            )}
          />
        )}

        {/* Node name */}
        <span className="flex-1 truncate">{node.name}</span>

        {/* CLAUDE.md indicator */}
        {node.hasClaudeMd && (
          <span
            className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-500/20 text-purple-500"
            title="Contains CLAUDE.md context"
          >
            MD
          </span>
        )}

        {/* File size */}
        {showSizes && !isDirectory && node.size && (
          <span className="text-xs text-muted-foreground ml-auto">
            {formatFileSize(node.size)}
          </span>
        )}
      </div>

      {/* Recursive children */}
      {shouldShowChildren && !isAtMaxDepth && node.children && (
        <div className="tree-children" role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              maxDepth={maxDepth}
              showIcons={showIcons}
              showSizes={showSizes}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * TreeView component - displays file tree with expand/collapse
 *
 * @example
 * ```tsx
 * <TreeView
 *   nodes={fileTree}
 *   expandedPaths={expandedPaths}
 *   selectedPath={selectedFile}
 *   onNodeClick={(node) => console.log('Clicked:', node.path)}
 *   onToggle={(path) => toggleExpanded(path)}
 *   showIcons
 *   showSizes
 * />
 * ```
 */
export function TreeView({
  nodes,
  expandedPaths,
  selectedPath,
  onNodeClick,
  onNodeDoubleClick,
  onToggle,
  maxDepth = 0,
  depth = 0,
  showIcons = true,
  showSizes = false,
  className,
}: TreeViewProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <Folder className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No files found</p>
      </div>
    );
  }

  return (
    <div
      className={cn('tree-view', className)}
      role="tree"
      aria-label="File tree"
    >
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          level={depth}
          expandedPaths={expandedPaths}
          selectedPath={selectedPath}
          maxDepth={maxDepth}
          showIcons={showIcons}
          showSizes={showSizes}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

export default TreeView;
