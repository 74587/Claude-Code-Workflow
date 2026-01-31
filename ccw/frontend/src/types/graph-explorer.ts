// ========================================
// Graph Explorer Types
// ========================================
// TypeScript interfaces for Graph Explorer component

import type { Node, Edge } from '@xyflow/react';

// ========== Node Types ==========

/**
 * Graph node type for categorizing different node kinds
 *
 * @remarks
 * Node types determine the visual representation and behavior
 * of nodes in the graph explorer. Each type can have custom
 * styling, icons, and interaction behavior.
 */
export type NodeType =
  | 'component'      // React/Vue/Angular component
  | 'module'         // ES module / namespace
  | 'function'       // Function / method
  | 'class'          // Class definition
  | 'interface'      // TypeScript interface / type
  | 'variable'       // Variable / constant
  | 'file'           // File reference
  | 'folder'         // Folder / directory
  | 'dependency'     // External dependency
  | 'api'            // API endpoint
  | 'database'       // Database entity
  | 'service'        // Service / provider
  | 'hook'           // React hook
  | 'utility'        // Utility function
  | 'unknown';       // Unclassified node

/**
 * Node category for high-level grouping
 */
export type NodeCategory =
  | 'frontend'
  | 'backend'
  | 'shared'
  | 'external'
  | 'test'
  | 'config'
  | 'assets'
  | 'unknown';

/**
 * Severity level for node issues
 */
export type NodeSeverity = 'error' | 'warning' | 'info' | 'success';

// ========== Edge Types ==========

/**
 * Graph edge type for different relationship kinds
 *
 * @remarks
 * Edge types determine how relationships are visualized
 * in the graph. Different types can have different
 * line styles, arrowheads, and colors.
 */
export type EdgeType =
  | 'imports'        // Imports/requires relationship
  | 'exports'        // Exports/provides relationship
  | 'extends'        // Inheritance/extends relationship
  | 'implements'     // Interface implementation
  | 'uses'           // Usage/reference relationship
  | 'depends-on'     // Dependency relationship
  | 'calls'          // Function/method call
  | 'instantiates'   // Creates instance of
  | 'contains'       // Parent-child containment
  | 'related-to'     // General association
  | 'data-flow'      // Data flow relationship
  | 'event'          // Event emitter/listener
  | 'unknown';       // Unclassified edge

/**
 * Edge direction for relationship visualization
 */
export type EdgeDirection = 'bidirectional' | 'unidirectional';

// ========== Graph Node ==========

/**
 * Extended node data for graph explorer nodes
 *
 * @example
 * ```typescript
 * const graphNode: GraphNode = {
 *   id: 'App.tsx',
 *   type: 'component',
 *   position: { x: 100, y: 100 },
 *   data: {
 *     label: 'App.tsx',
 *     category: 'frontend',
 *     filePath: '/src/App.tsx',
 *     lineCount: 150,
 *     hasIssues: false
 *   }
 * };
 * ```
 */
export interface GraphNodeData {
  /** Display label for the node */
  label: string;
  /** Node category */
  category?: NodeCategory;
  /** File path (if node represents a file) */
  filePath?: string;
  /** Line number (if node represents a function/class) */
  lineNumber?: number;
  /** Number of lines of code */
  lineCount?: number;
  /** Whether the node has issues */
  hasIssues?: boolean;
  /** Severity level of issues */
  severity?: NodeSeverity;
  /** List of issue messages */
  issues?: string[];
  /** Node documentation/tooltip */
  documentation?: string;
  /** Node tags for filtering */
  tags?: string[];
  /** Whether node is collapsed/expanded */
  collapsed?: boolean;
  /** Number of children (if collapsed) */
  childCount?: number;
  /** Custom styling properties */
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    opacity?: number;
  };
  /** Index signature for additional properties */
  [key: string]: unknown;
}

/**
 * Graph node type extending React Flow Node
 */
export type GraphNode = Node<GraphNodeData, NodeType>;

// ========== Graph Edge ==========

/**
 * Extended edge data for graph explorer edges
 *
 * @example
 * ```typescript
 * const graphEdge: GraphEdge = {
 *   id: 'edge-1',
 *   source: 'App.tsx',
 *   target: 'Header.tsx',
 *   type: 'imports',
 *   data: {
 *     label: 'imports',
 *     lineNumbers: [5],
 *     strength: 0.8
 *   }
 * };
 * ```
 */
export interface GraphEdgeData {
  /** Display label for the edge */
  label?: string;
  /** Edge type */
  edgeType?: EdgeType;
  /** Line numbers where relationship occurs */
  lineNumbers?: number[];
  /** Relationship strength (0-1) */
  strength?: number;
  /** Edge documentation */
  documentation?: string;
  /** Whether edge is animated */
  animated?: boolean;
  /** Custom styling properties */
  style?: {
    strokeColor?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
    opacity?: number;
  };
  /** Index signature for additional properties */
  [key: string]: unknown;
}

/**
 * Graph edge type extending React Flow Edge
 */
export type GraphEdge = Edge<GraphEdgeData>;

// ========== Graph Data ==========

/**
 * Complete graph data structure
 *
 * @example
 * ```typescript
 * const graphData: GraphData = {
 *   nodes: [appNode, headerNode],
 *   edges: [importEdge],
 *   metadata: {
 *     name: 'Component Graph',
 *     description: 'React component dependencies',
 *     nodeCount: 2,
 *     edgeCount: 1
 *   }
 * };
 * ```
 */
export interface GraphData {
  /** All nodes in the graph */
  nodes: GraphNode[];
  /** All edges in the graph */
  edges: GraphEdge[];
  /** Graph metadata */
  metadata?: GraphMetadata;
}

/**
 * Graph metadata information
 */
export interface GraphMetadata {
  /** Graph name/title */
  name?: string;
  /** Graph description */
  description?: string;
  /** Total node count */
  nodeCount?: number;
  /** Total edge count */
  edgeCount?: number;
  /** Last updated timestamp */
  updatedAt?: string;
  /** Graph version */
  version?: number;
  /** Graph tags */
  tags?: string[];
  /** Analysis duration in milliseconds */
  analysisDuration?: number;
  /** Source path of the graph analysis */
  sourcePath?: string;
}

// ========== Graph Filters ==========

/**
 * Filter options for graph explorer
 *
 * @example
 * ```typescript
 * const filters: GraphFilters = {
 *   nodeTypes: ['component', 'hook'],
 *   edgeTypes: ['imports', 'uses'],
 *   categories: ['frontend'],
 *   searchQuery: 'App',
 *   showOnlyIssues: false,
 *   minComplexity: 1
 * };
 * ```
 */
export interface GraphFilters {
  /** Filter by node types */
  nodeTypes?: NodeType[];
  /** Filter by edge types */
  edgeTypes?: EdgeType[];
  /** Filter by node categories */
  categories?: NodeCategory[];
  /** Search query string */
  searchQuery?: string;
  /** Show only nodes with issues */
  showOnlyIssues?: boolean;
  /** Minimum complexity level (1-5) */
  minComplexity?: number;
  /** Filter by tags */
  tags?: string[];
  /** Exclude tags */
  excludeTags?: string[];
  /** File path pattern filter */
  filePathPattern?: string;
  /** Show/hide isolated nodes (no connections) */
  showIsolatedNodes?: boolean;
  /** Maximum depth to display */
  maxDepth?: number;
  /** Focus node ID (highlight path to this node) */
  focusNodeId?: string | null;
}

/**
 * Sort options for graph elements
 */
export interface GraphSortOptions {
  /** Sort field */
  field: 'name' | 'complexity' | 'connections' | 'lineCount' | 'size';
  /** Sort direction */
  direction: 'asc' | 'desc';
}

// ========== Graph State ==========

/**
 * Layout algorithm for graph visualization
 */
export type GraphLayout =
  | 'force-directed'    // Force-directed layout (d3-force)
  | 'hierarchical'      // Hierarchical/tree layout
  | 'circular'          // Circular layout
  | 'grid'              // Grid layout
  | 'random';           // Random positions

/**
 * Graph explorer state
 */
export interface GraphExplorerState {
  /** Current graph data */
  graphData: GraphData | null;
  /** Current filters */
  filters: GraphFilters;
  /** Current layout */
  layout: GraphLayout;
  /** Sort options */
  sortOptions: GraphSortOptions;
  /** Selected node IDs */
  selectedNodeIds: string[];
  /** Selected edge IDs */
  selectedEdgeIds: string[];
  /** Whether graph is loading */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Zoom level (0.1 - 5) */
  zoom: number;
  /** Pan position { x, y } */
  pan: { x: number; y: number };
  /** Whether mini-map is visible */
  showMiniMap: boolean;
  /** Whether controls are visible */
  showControls: boolean;
  /** Fit view to screen */
  fitView: boolean;
}

/**
 * Graph explorer actions
 */
export interface GraphExplorerActions {
  /** Set graph data */
  setGraphData: (data: GraphData) => void;
  /** Update filters */
  setFilters: (filters: Partial<GraphFilters>) => void;
  /** Reset filters */
  resetFilters: () => void;
  /** Set layout */
  setLayout: (layout: GraphLayout) => void;
  /** Set sort options */
  setSortOptions: (options: GraphSortOptions) => void;
  /** Select node */
  selectNode: (nodeId: string) => void;
  /** Select multiple nodes */
  selectNodes: (nodeIds: string[]) => void;
  /** Deselect all */
  deselectAll: () => void;
  /** Zoom in */
  zoomIn: () => void;
  /** Zoom out */
  zoomOut: () => void;
  /** Reset zoom */
  resetZoom: () => void;
  /** Fit view to graph */
  fitView: () => void;
  /** Toggle mini-map */
  toggleMiniMap: () => void;
  /** Toggle controls */
  toggleControls: () => void;
  /** Refresh graph */
  refresh: () => Promise<void>;
}

/**
 * Combined graph explorer store type
 */
export type GraphExplorerStore = GraphExplorerState & GraphExplorerActions;

// ========== Graph Analysis ==========

/**
 * Node complexity metrics
 */
export interface NodeComplexity {
  /** Cyclomatic complexity */
  cyclomatic: number;
  /** Number of lines of code */
  linesOfCode: number;
  /** Number of parameters */
  parameterCount: number;
  /** Nesting depth */
  nestingDepth: number;
  /** Overall complexity score (1-5) */
  score: number;
}

/**
 * Graph analysis result
 */
export interface GraphAnalysis {
  /** Graph data */
  graphData: GraphData;
  /** Node complexity by ID */
  complexities: Record<string, NodeComplexity>;
  /** Connected components */
  components: string[][];
  /** Strongly connected components */
  stronglyConnected: string[][];
  /** Critical path (node IDs) */
  criticalPath: string[];
  /** Analysis duration */
  duration: number;
}
