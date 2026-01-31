// ========================================
// Inherits Edge Component
// ========================================
// Custom edge for inheritance relationship visualization in Graph Explorer

import { memo } from 'react';
import {
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
} from '@xyflow/react';
import type { GraphEdgeData } from '@/types/graph-explorer';

/**
 * Inherits edge component - represents inheritance/implementation relationships
 */
export const InheritsEdge = memo((props: EdgeProps) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    style,
    markerEnd,
  } = props;
  const data = props.data as GraphEdgeData | undefined;
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 20,
  });

  const edgeStyle = {
    ...style,
    stroke: selected ? '#f59e0b' : '#a855f7',
    strokeWidth: selected ? 2 : 2,
    strokeDasharray: '4,4',
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        markerEnd={markerEnd}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px, ${(sourceY + targetY) / 2}px)`,
              pointerEvents: 'all',
            }}
            className="px-2 py-1 text-xs bg-white dark:bg-gray-800 rounded shadow border border-purple-200 dark:border-purple-700"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

InheritsEdge.displayName = 'InheritsEdge';
