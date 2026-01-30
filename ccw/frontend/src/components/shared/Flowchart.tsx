// ========================================
// Flowchart Component
// ========================================
// Interactive flowchart component using @xyflow/react

import * as React from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { FlowControl } from '@/lib/api';

// Custom node types
interface FlowchartNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  step?: number | string;
  output?: string;
  type: 'pre-analysis' | 'implementation' | 'section';
  dependsOn?: string[];
}

// Custom node component
const CustomNode: React.FC<{ data: FlowchartNodeData }> = ({ data }) => {
  const isPreAnalysis = data.type === 'pre-analysis';
  const isSection = data.type === 'section';

  if (isSection) {
    return (
      <div className="px-4 py-2 bg-muted rounded border-2 border-border">
        <span className="text-sm font-semibold text-foreground">{data.label}</span>
      </div>
    );
  }

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 shadow-sm min-w-[280px] max-w-[400px] ${
        isPreAnalysis
          ? 'bg-amber-50 border-amber-500 dark:bg-amber-950/30'
          : 'bg-blue-50 border-blue-500 dark:bg-blue-950/30'
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            isPreAnalysis ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
          }`}
        >
          {data.step}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">{data.label}</div>
          {data.description && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{data.description}</div>
          )}
          {data.output && (
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
              {'->'} {data.output}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

export interface FlowchartProps {
  flowControl: FlowControl;
  className?: string;
}

/**
 * Flowchart component for visualizing implementation approach
 */
export function Flowchart({ flowControl, className = '' }: FlowchartProps) {
  const preAnalysis = flowControl.pre_analysis || [];
  const implSteps = flowControl.implementation_approach || [];

  // Build nodes and edges
  const initialNodes: Node[] = [];
  const initialEdges: Edge[] = [];

  let currentY = 0;
  const nodeHeight = 100;
  const verticalGap = 80;
  const sectionGap = 60;

  // Add Pre-Analysis section
  if (preAnalysis.length > 0) {
    // Section header node
    initialNodes.push({
      id: 'pre-section',
      type: 'custom',
      position: { x: 0, y: currentY },
      data: {
        label: 'Pre-Analysis Steps',
        type: 'section' as const,
      },
    });
    currentY += sectionGap;

    preAnalysis.forEach((step, idx) => {
      const nodeId = `pre-${idx}`;
      initialNodes.push({
        id: nodeId,
        type: 'custom',
        position: { x: 0, y: currentY },
        data: {
          label: step.step || step.action || `Pre-step ${idx + 1}`,
          description: step.action,
          step: `P${idx + 1}`,
          output: step.output_to,
          type: 'pre-analysis' as const,
        },
      });

      // Edge from previous node
      if (idx === 0) {
        initialEdges.push({
          id: `pre-section-${idx}`,
          source: 'pre-section',
          target: nodeId,
          type: 'smoothstep',
          animated: false,
        });
      } else {
        initialEdges.push({
          id: `pre-${idx - 1}-${idx}`,
          source: `pre-${idx - 1}`,
          target: nodeId,
          type: 'smoothstep',
          animated: false,
        });
      }

      currentY += nodeHeight + verticalGap;
    });

    currentY += sectionGap;
  }

  // Add Implementation section
  if (implSteps.length > 0) {
    // Section header node
    const implSectionId = `impl-section-${Date.now()}`;
    initialNodes.push({
      id: implSectionId,
      type: 'custom',
      position: { x: 0, y: currentY },
      data: {
        label: 'Implementation Steps',
        type: 'section' as const,
      },
    });

    // Edge from pre-analysis to impl section (if both exist)
    if (preAnalysis.length > 0) {
      initialEdges.push({
        id: `pre-impl-conn`,
        source: `pre-${preAnalysis.length - 1}`,
        target: implSectionId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: 'hsl(var(--primary))' },
      });
    }

    currentY += sectionGap;

    implSteps.forEach((step, idx) => {
      const nodeId = `impl-${idx}`;
      initialNodes.push({
        id: nodeId,
        type: 'custom',
        position: { x: 0, y: currentY },
        data: {
          label: step.title || `Step ${step.step}`,
          description: step.description,
          step: step.step,
          type: 'implementation' as const,
          dependsOn: step.depends_on?.map(d => `impl-${d - 1}`),
        },
      });

      // Edge from section header to first step
      if (idx === 0) {
        initialEdges.push({
          id: `impl-section-${idx}`,
          source: implSectionId,
          target: nodeId,
          type: 'smoothstep',
          animated: false,
        });
      } else {
        // Sequential edge
        initialEdges.push({
          id: `impl-${idx - 1}-${idx}`,
          source: `impl-${idx - 1}`,
          target: nodeId,
          type: 'smoothstep',
          animated: false,
        });
      }

      // Dependency edges
      if (step.depends_on && step.depends_on.length > 0) {
        step.depends_on.forEach(depIdx => {
          const depNodeId = `impl-${depIdx - 1}`;
          initialEdges.push({
            id: `dep-${depIdx}-${idx}`,
            source: depNodeId,
            target: nodeId,
            type: 'smoothstep',
            animated: false,
            style: { strokeDasharray: '5,5', stroke: 'hsl(var(--warning))' },
          });
        });
      }

      currentY += nodeHeight + verticalGap;
    });
  }

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Handle new connections (disabled for this use case)
  const onConnect = React.useCallback(
    (connection: Connection) => {
      setEdges((eds) => [
        ...eds,
        {
          ...connection,
          id: `edge-${Date.now()}`,
          type: 'smoothstep',
        },
      ]);
    },
    [setEdges]
  );

  // If no data, show empty state
  if (preAnalysis.length === 0 && implSteps.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 text-center ${className}`}>
        <div>
          <p className="text-sm text-muted-foreground">No flowchart data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ height: `${currentY + 100}px` }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        zoomOnScroll={true}
        panOnScroll={true}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as FlowchartNodeData;
            if (data.type === 'section') return '#e5e7eb';
            if (data.type === 'pre-analysis') return '#f59e0b';
            return '#3b82f6';
          }}
          className="!bg-background !border-border"
        />
      </ReactFlow>
    </div>
  );
}

export default Flowchart;
