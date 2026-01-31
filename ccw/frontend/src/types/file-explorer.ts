// ========================================
// File Explorer Types
// ========================================
// TypeScript interfaces for File Explorer component

// ========== File System Node Types ==========

/**
 * File system node type (file or directory)
 */
export type NodeType = 'file' | 'directory';

/**
 * File system node representing a file or directory in the project tree
 *
 * @example
 * ```typescript
 * const fileNode: FileSystemNode = {
 *   name: 'App.tsx',
 *   path: '/src/App.tsx',
 *   type: 'file',
 *   hasClaudeMd: true,
 *   size: 2048,
 *   modifiedTime: '2025-01-15T10:30:00Z'
 * };
 *
 * const dirNode: FileSystemNode = {
 *   name: 'components',
 *   path: '/src/components',
 *   type: 'directory',
 *   children: [fileNode],
 *   hasClaudeMd: false
 * };
 * ```
 */
export interface FileSystemNode {
  /** Node name (file or directory name) */
  name: string;
  /** Full path to the file or directory */
  path: string;
  /** Node type (file or directory) */
  type: NodeType;
  /** Child nodes (only for directories) */
  children?: FileSystemNode[];
  /** Whether this node contains CLAUDE.md context */
  hasClaudeMd?: boolean;
  /** File size in bytes (only for files) */
  size?: number;
  /** Last modified timestamp (ISO string) */
  modifiedTime?: string;
  /** Whether the node is expanded in the UI */
  isExpanded?: boolean;
  /** Whether the node is selected in the UI */
  isSelected?: boolean;
  /** File extension (e.g., 'ts', 'tsx', 'md') */
  extension?: string;
  /** Language identifier for syntax highlighting */
  language?: string;
}

// ========== File Content Types ==========

/**
 * File content with metadata for display in the explorer
 *
 * @example
 * ```typescript
 * const fileContent: FileContent = {
 *   path: '/src/App.tsx',
 *   content: 'import React from "react";\n\nexport default function App() {\n  return <div>Hello</div>;\n}',
 *   language: 'typescript',
 *   encoding: 'utf8'
 * };
 * ```
 */
export interface FileContent {
  /** Full path to the file */
  path: string;
  /** File content as string */
  content: string;
  /** Language identifier for syntax highlighting (e.g., 'typescript', 'python', 'markdown') */
  language?: string;
  /** Character encoding (default: 'utf8') */
  encoding?: string;
  /** File size in bytes */
  size?: number;
  /** Last modified timestamp */
  modifiedTime?: string;
  /** Whether the file is read-only */
  readOnly?: boolean;
  /** File MIME type */
  mimeType?: string;
}

/**
 * File read options for fetching file content
 */
export interface FileReadOptions {
  /** Character encoding (default: 'utf8') */
  encoding?: 'utf8' | 'ascii' | 'base64' | 'utf16le';
  /** Include file metadata (size, modifiedTime, etc.) */
  includeMetadata?: boolean;
  /** Maximum file size to read in bytes (0 = no limit) */
  maxSize?: number;
}

// ========== Explorer State Types ==========

/**
 * View mode for file explorer
 */
export type ExplorerViewMode = 'tree' | 'list' | 'compact';

/**
 * Sort order for file explorer
 */
export type ExplorerSortOrder = 'name' | 'size' | 'modified' | 'type';

/**
 * File explorer state for UI management
 *
 * @example
 * ```typescript
 * const explorerState: ExplorerState = {
 *   currentPath: '/src',
 *   selectedFile: '/src/App.tsx',
 *   expandedPaths: new Set(['/src', '/src/components']),
 *   fileTree: [rootNode],
 *   viewMode: 'tree',
 *   sortOrder: 'name',
 *   showHiddenFiles: false,
 *   filter: ''
 * };
 * ```
 */
export interface ExplorerState {
  /** Current working directory path */
  currentPath: string;
  /** Currently selected file path */
  selectedFile: string | null;
  /** Set of expanded directory paths for tree view */
  expandedPaths: Set<string>;
  /** File system tree root nodes */
  fileTree: FileSystemNode[];
  /** View mode (tree, list, or compact) */
  viewMode: ExplorerViewMode;
  /** Sort order (name, size, modified, type) */
  sortOrder: ExplorerSortOrder;
  /** Whether to show hidden files (starting with '.') */
  showHiddenFiles: boolean;
  /** Search filter string */
  filter: string;
  /** Whether the explorer is loading data */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Cached file contents by path */
  fileContents: Record<string, FileContent>;
  /** Recently opened files (MRU list) */
  recentFiles: string[];
  /** Maximum number of recent files to track */
  maxRecentFiles: number;
  /** Whether directories are shown before files */
  directoriesFirst: boolean;
}

/**
 * File explorer actions for state management
 */
export interface ExplorerActions {
  /** Set the current directory path */
  setCurrentPath: (path: string) => Promise<void>;
  /** Set the selected file */
  setSelectedFile: (path: string | null) => void;
  /** Toggle directory expanded state */
  toggleExpanded: (path: string) => void;
  /** Expand a directory */
  expandDirectory: (path: string) => void;
  /** Collapse a directory */
  collapseDirectory: (path: string) => void;
  /** Expand all directories */
  expandAll: () => void;
  /** Collapse all directories */
  collapseAll: () => void;
  /** Set view mode */
  setViewMode: (mode: ExplorerViewMode) => void;
  /** Set sort order */
  setSortOrder: (order: ExplorerSortOrder) => void;
  /** Toggle hidden files visibility */
  toggleShowHidden: () => void;
  /** Set filter string */
  setFilter: (filter: string) => void;
  /** Refresh file tree */
  refresh: () => Promise<void>;
  /** Load file content */
  loadFileContent: (path: string, options?: FileReadOptions) => Promise<FileContent>;
  /** Clear file content cache */
  clearFileCache: (path?: string) => void;
  /** Add to recent files */
  addToRecent: (path: string) => void;
  /** Clear recent files */
  clearRecent: () => void;
}

/**
 * Combined file explorer store type
 */
export type ExplorerStore = ExplorerState & ExplorerActions;

// ========== File Tree Operations ==========

/**
 * Options for building file tree
 */
export interface FileTreeOptions {
  /** Root directory path */
  rootPath: string;
  /** Maximum depth to traverse (0 = unlimited) */
  maxDepth?: number;
  /** Include hidden files */
  includeHidden?: boolean;
  /** File patterns to include (glob patterns) */
  includePatterns?: string[];
  /** File patterns to exclude (glob patterns) */
  excludePatterns?: string[];
  /** Whether to follow symbolic links */
  followSymlinks?: boolean;
}

/**
 * Result of file tree build operation
 */
export interface FileTreeResult {
  /** Root nodes of the file tree */
  rootNodes: FileSystemNode[];
  /** Total number of files */
  fileCount: number;
  /** Total number of directories */
  directoryCount: number;
  /** Total size in bytes */
  totalSize: number;
  /** Build duration in milliseconds */
  buildTime: number;
  /** Errors encountered during build (non-fatal) */
  errors: Array<{
    path: string;
    message: string;
  }>;
}
