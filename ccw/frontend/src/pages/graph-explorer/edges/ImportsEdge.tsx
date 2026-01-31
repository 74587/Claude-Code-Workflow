// ========================================
// Imports Edge Component
// ========================================
// Custom edge for import relationship visualization in Graph Explorer

import { memo } from 'react';
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from '@xyflow/react';
import type { GraphEdgeData } from '@/types/graph-explorer';

/**
 * Imports edge component - represents import/requires relationships
 */
export const ImportsEdge = memo((props: EdgeProps) => {
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
    stroke: selected ? '#3b82f6' : '#64748b',
    strokeWidth: selected ? 2 : 1.5,
    strokeDasharray: data?.importType === 'dynamic' ? '5,5' : undefined,
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
            className="px-2 py-1 text-xs bg-white dark:bg-gray-800 rounded shadow border border-gray-200 dark:border-gray-700"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

ImportsEdge.displayName = 'ImportsEdge';
