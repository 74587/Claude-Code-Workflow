// ========================================
// Graph Explorer Page
// ========================================
// Main page for code dependency graph visualization

import { useCallback, useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  Panel,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphData } from '@/hooks/useGraphData';
import { GraphToolbar } from '@/components/shared/GraphToolbar';
import { GraphSidebar } from '@/components/shared/GraphSidebar';
import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { AlertCircle } from 'lucide-react';
import type { GraphNode, GraphFilters, NodeType, EdgeType } from '@/types/graph-explorer';
import { nodeTypes } from './graph-explorer/nodes';
import { edgeTypes } from './graph-explorer/edges';

/**
 * Inner Graph Explorer Page Component (wrapped with ReactFlowProvider)
 */
function GraphExplorerPageInner() {
  const { formatMessage } = useIntl();
  const { fitView } = useReactFlow();

  // State
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [filters, setFilters] = useState<GraphFilters>({
    nodeTypes: ['component', 'module', 'class', 'function', 'variable', 'interface', 'hook'],
    edgeTypes: ['imports', 'exports', 'extends', 'implements', 'uses', 'calls', 'depends-on'],
    showIsolatedNodes: false,
  });

  // Fetch graph data
  const { graphData, isLoading, isFetching, error, refetch, applyFilters } = useGraphData({
    rootPath: '/src',
    maxDepth: 3,
    enabled: true,
  });

  // Apply filters to graph data
  const filteredGraphData = useMemo(() => {
    return applyFilters(filters) || { nodes: [], edges: [], metadata: undefined };
  }, [graphData, filters, applyFilters]);

  // Calculate node/edge type counts for badges
  const nodeTypeCounts = useMemo(() => {
    const counts: Partial<Record<NodeType, number>> = {};
    graphData?.nodes.forEach(node => {
      counts[node.type as NodeType] = (counts[node.type as NodeType] || 0) + 1;
    });
    return counts;
  }, [graphData]);

  const edgeTypeCounts = useMemo(() => {
    const counts: Partial<Record<EdgeType, number>> = {};
    graphData?.edges.forEach(edge => {
      const type = edge.data?.edgeType as EdgeType;
      if (type) {
        counts[type] = (counts[type] || 0) + 1;
      }
    });
    return counts;
  }, [graphData]);

  // Event handlers
  const handleNodeClick = useCallback((_event: React.MouseEvent, node: GraphNode) => {
    setSelectedNode(node);
    setIsSidebarOpen(true);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleFiltersChange = useCallback((newFilters: GraphFilters) => {
    setFilters(newFilters);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({
      nodeTypes: ['component', 'module', 'class', 'function', 'variable', 'interface', 'hook'],
      edgeTypes: ['imports', 'exports', 'extends', 'implements', 'uses', 'calls', 'depends-on'],
      showIsolatedNodes: false,
    });
  }, []);

  const handleSidebarClose = useCallback(() => {
    setIsSidebarOpen(false);
    setSelectedNode(null);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Card className="p-6 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-600 dark:text-red-400">
              {formatMessage({ id: 'graph.error.loading' }, { message: error.message })}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Empty state
  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {formatMessage({ id: 'graph.empty' })}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <GraphToolbar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onFitView={handleFitView}
        onRefresh={handleRefresh}
        onResetFilters={handleResetFilters}
        nodeTypeCounts={nodeTypeCounts}
        edgeTypeCounts={edgeTypeCounts}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={filteredGraphData.nodes}
            edges={filteredGraphData.edges}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
            minZoom={0.1}
            maxZoom={2}
            className="bg-background"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case 'component':
                  case 'module':
                    return '#3b82f6';
                  case 'class':
                    return '#22c55e';
                  case 'function':
                    return '#f97316';
                  case 'variable':
                    return '#06b6d4';
                  default:
                    return '#6b7280';
                }
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
            />

            {/* Status panel */}
            <Panel position="top-left" className="bg-card/90 backdrop-blur border border-border rounded-lg p-3 shadow-lg">
              <div className="text-xs space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {formatMessage({ id: 'graph.status.nodes' })}
                  </span>
                  <span className="font-medium">{filteredGraphData.nodes.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {formatMessage({ id: 'graph.status.edges' })}
                  </span>
                  <span className="font-medium">{filteredGraphData.edges.length}</span>
                </div>
                {isFetching && (
                  <div className="text-xs text-muted-foreground">
                    {formatMessage({ id: 'graph.status.updating' })}
                  </div>
                )}
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* Sidebar */}
        {isSidebarOpen && (
          <GraphSidebar
            selectedNode={selectedNode}
            showLegend={!selectedNode}
            onClose={handleSidebarClose}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Graph Explorer Page Component (with ReactFlowProvider wrapper)
 */
export function GraphExplorerPage() {
  return (
    <ReactFlowProvider>
      <GraphExplorerPageInner />
    </ReactFlowProvider>
  );
}

export default GraphExplorerPage;
