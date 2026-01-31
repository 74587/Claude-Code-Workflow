// ========================================
// Module Node Component
// ========================================
// Custom node for file/module visualization in Graph Explorer

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { File, Package } from 'lucide-react';
import type { GraphNodeData } from '@/types/graph-explorer';

/**
 * Module node component - represents files, modules, or packages
 */
export const ModuleNode = memo((props: NodeProps) => {
  const { data, selected } = props;
  const nodeData = data as GraphNodeData;
  const hasIssues = nodeData.hasIssues;
  const severity = nodeData.severity;

  // Color coding based on severity
  const getBorderColor = () => {
    if (severity === 'error') return 'border-red-500';
    if (severity === 'warning') return 'border-amber-500';
    if (severity === 'info') return 'border-blue-500';
    return 'border-gray-300 dark:border-gray-600';
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
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />

      {/* Node content */}
      <div className="flex items-start gap-2">
        {/* Icon */}
        <div className={`
          flex-shrink-0 w-8 h-8 rounded flex items-center justify-center
          ${nodeData.category === 'external' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}
        `}>
          {nodeData.category === 'external' ? (
            <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          ) : (
            <File className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          )}
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
          {nodeData.lineCount && (
            <div className="text-xs text-muted-foreground mt-1">
              {nodeData.lineCount} lines
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

      {/* Tags */}
      {nodeData.tags && nodeData.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {nodeData.tags.slice(0, 3).map((tag: string) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
            >
              {tag}
            </span>
          ))}
          {nodeData.tags.length > 3 && (
            <span className="px-1.5 py-0.5 text-xs text-muted-foreground">
              +{nodeData.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Output handle */}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
});

ModuleNode.displayName = 'ModuleNode';
