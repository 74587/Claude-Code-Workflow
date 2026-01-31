// ========================================
// Class Node Component
// ========================================
// Custom node for class visualization in Graph Explorer

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Braces } from 'lucide-react';
import type { GraphNodeData } from '@/types/graph-explorer';

/**
 * Class node component - represents class definitions
 */
export const ClassNode = memo((props: NodeProps) => {
  const { data, selected } = props;
  const nodeData = data as GraphNodeData;
  const hasIssues = nodeData.hasIssues;
  const severity = nodeData.severity;

  // Color coding based on severity
  const getBorderColor = () => {
    if (severity === 'error') return 'border-red-500';
    if (severity === 'warning') return 'border-amber-500';
    if (severity === 'info') return 'border-blue-500';
    return 'border-green-500 dark:border-green-600';
  };

  const getBackgroundColor = () => {
    if (severity === 'error') return 'bg-red-50 dark:bg-red-900/20';
    if (severity === 'warning') return 'bg-amber-50 dark:bg-amber-900/20';
    if (severity === 'info') return 'bg-blue-50 dark:bg-blue-900/20';
    return 'bg-white dark:bg-gray-800';
  };

  return (
    <div
      className={`
        px-4 py-3 rounded-lg shadow-md border-2 min-w-[180px] max-w-[240px]
        ${getBackgroundColor()} ${getBorderColor()}
        ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
        transition-all duration-200
      `}
    >
      {/* Input handle */}
      <Handle type="target" position={Position.Top} className="!bg-green-500" />

      {/* Node content */}
      <div className="flex items-start gap-2">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center bg-green-100 dark:bg-green-900/30">
          <Braces className="w-4 h-4 text-green-600 dark:text-green-400" />
        </div>

        {/* Label and info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-foreground truncate" title={nodeData.label}>
            {nodeData.label}
          </div>
          {nodeData.filePath && (
            <div className="text-xs text-muted-foreground truncate mt-1" title={nodeData.filePath}>
              {nodeData.filePath}
            </div>
          )}
          {nodeData.lineNumber && (
            <div className="text-xs text-muted-foreground mt-1">
              Line {nodeData.lineNumber}
            </div>
          )}
        </div>

        {/* Issue indicator */}
        {hasIssues && (
          <div className={`
            flex-shrink-0 w-2 h-2 rounded-full
            ${severity === 'error' ? 'bg-red-500' : severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}
          `} />
        )}
      </div>

      {/* Documentation/Tooltip */}
      {nodeData.documentation && (
        <div className="mt-2 text-xs text-muted-foreground line-clamp-2" title={nodeData.documentation}>
          {nodeData.documentation}
        </div>
      )}

      {/* Output handle */}
      <Handle type="source" position={Position.Bottom} className="!bg-green-500" />
    </div>
  );
});

ClassNode.displayName = 'ClassNode';
