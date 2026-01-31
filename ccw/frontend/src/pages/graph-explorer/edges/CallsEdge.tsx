// ========================================
// Calls Edge Component
// ========================================
// Custom edge for function/method call visualization in Graph Explorer

import { memo } from 'react';
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from '@xyflow/react';
import type { GraphEdgeData } from '@/types/graph-explorer';

/**
 * Calls edge component - represents function/method call relationships
 */
export const CallsEdge = memo((props: EdgeProps) => {
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
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeStyle = {
    ...style,
    stroke: selected ? '#10b981' : '#22c55e',
    strokeWidth: selected ? 2 : 1.5,
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
            className="px-2 py-1 text-xs bg-white dark:bg-gray-800 rounded shadow border border-green-200 dark:border-green-700"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

CallsEdge.displayName = 'CallsEdge';
