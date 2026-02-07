// ========================================
// Flow Canvas Component
// ========================================
// React Flow canvas with minimap, controls, and background

import { useCallback, useRef, useState, useEffect, DragEvent } from 'react';
import { useIntl } from 'react-intl';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  ReactFlowProvider,
  useReactFlow,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useFlowStore } from '@/stores';
import { useExecutionStore, selectIsExecuting } from '@/stores/executionStore';
import type { FlowNode, FlowEdge } from '@/types/flow';

// Custom node types (enhanced with execution status in IMPL-A8)
import { nodeTypes } from './nodes';
import { InteractionModeToggle } from './InteractionModeToggle';

interface FlowCanvasProps {
  className?: string;
}

function FlowCanvasInner({ className }: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const { formatMessage } = useIntl();

  // Execution state - lock canvas during execution
  const isExecuting = useExecutionStore(selectIsExecuting);

  // Get state and actions from store
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const setNodes = useFlowStore((state) => state.setNodes);
  const setEdges = useFlowStore((state) => state.setEdges);
  const addNode = useFlowStore((state) => state.addNode);
  const addNodeFromTemplate = useFlowStore((state) => state.addNodeFromTemplate);
  const setSelectedNodeId = useFlowStore((state) => state.setSelectedNodeId);
  const setSelectedEdgeId = useFlowStore((state) => state.setSelectedEdgeId);
  const markModified = useFlowStore((state) => state.markModified);

  // Interaction mode from store
  const interactionMode = useFlowStore((state) => state.interactionMode);

  // Ctrl key state for temporary mode reversal
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // Listen for Ctrl/Meta key press for temporary mode reversal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsCtrlPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsCtrlPressed(false);
      }
    };
    // Reset on blur (user switches window)
    const handleBlur = () => setIsCtrlPressed(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Calculate effective mode (Ctrl reverses the current mode)
  const effectiveMode = isCtrlPressed
    ? (interactionMode === 'pan' ? 'selection' : 'pan')
    : interactionMode;

  // Handle node changes (position, selection, etc.)
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updatedNodes = applyNodeChanges(changes, nodes as Node[]);
      setNodes(updatedNodes as FlowNode[]);
    },
    [nodes, setNodes]
  );

  // Handle edge changes
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const updatedEdges = applyEdgeChanges(changes, edges as Edge[]);
      setEdges(updatedEdges as FlowEdge[]);
    },
    [edges, setEdges]
  );

  // Handle new edge connections
  const onConnect = useCallback(
    (connection: Connection) => {
      if (isExecuting) return;
      if (connection.source && connection.target) {
        const newEdge: FlowEdge = {
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
        };
        setEdges([...edges, newEdge]);
        markModified();
      }
    },
    [edges, setEdges, markModified, isExecuting]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  // Handle edge selection
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id);
    },
    [setSelectedEdgeId]
  );

  // Handle canvas click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [setSelectedNodeId, setSelectedEdgeId]);

  // Handle drag over for node palette drop
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop from node palette
  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (isExecuting) return;

      // Verify the drop is from node palette
      const nodeType = event.dataTransfer.getData('application/reactflow-node-type');
      if (!nodeType) {
        return;
      }

      // Get drop position in flow coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Check if a template ID is provided
      const templateId = event.dataTransfer.getData('application/reactflow-template-id');
      if (templateId) {
        // Use quick template
        addNodeFromTemplate(templateId, position);
      } else {
        // Use basic empty node
        addNode(position);
      }
    },
    [screenToFlowPosition, addNode, addNodeFromTemplate, isExecuting]
  );

  return (
    <div ref={reactFlowWrapper} className={`w-full h-full ${className || ''}`}>
      <ReactFlow
        nodes={nodes as Node[]}
        edges={edges as Edge[]}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        panOnDrag={effectiveMode === 'pan'}
        selectionOnDrag={effectiveMode === 'selection'}
        nodesDraggable={!isExecuting}
        nodesConnectable={!isExecuting}
        elementsSelectable={!isExecuting}
        deleteKeyCode={isExecuting ? null : ['Backspace', 'Delete']}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        className="bg-background"
      >
        <Panel position="top-left" className="m-2">
          <InteractionModeToggle disabled={isExecuting} />
        </Panel>
        <Controls
          className="bg-card border border-border rounded-md shadow-sm"
          showZoom={true}
          showFitView={true}
          showInteractive={true}
        />
        <MiniMap
          className="bg-card border border-border rounded-md shadow-sm"
          nodeColor={() => '#3b82f6'}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          className="bg-muted/20"
        />
      </ReactFlow>

      {/* Execution lock overlay */}
      {isExecuting && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 bg-primary/90 text-primary-foreground rounded-full text-xs font-medium shadow-lg flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary-foreground animate-pulse" />
          {formatMessage({ id: 'orchestrator.execution.inProgress' })}
        </div>
      )}
    </div>
  );
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

export default FlowCanvas;
