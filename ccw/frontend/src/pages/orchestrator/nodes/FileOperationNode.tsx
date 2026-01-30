// ========================================
// File Operation Node Component
// ========================================
// Custom node for file read/write operations

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  FileText,
  FileInput,
  FileOutput,
  FilePlus,
  FileX,
  Copy,
  Move,
} from 'lucide-react';
import type { FileOperationNodeData } from '@/types/flow';
import { NodeWrapper } from './NodeWrapper';
import { cn } from '@/lib/utils';

interface FileOperationNodeProps {
  data: FileOperationNodeData;
  selected?: boolean;
}

// Operation icons and colors
const OPERATION_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  read: { icon: FileInput, label: 'Read', color: 'text-blue-500' },
  write: { icon: FileOutput, label: 'Write', color: 'text-amber-500' },
  append: { icon: FilePlus, label: 'Append', color: 'text-green-500' },
  delete: { icon: FileX, label: 'Delete', color: 'text-red-500' },
  copy: { icon: Copy, label: 'Copy', color: 'text-purple-500' },
  move: { icon: Move, label: 'Move', color: 'text-indigo-500' },
};

export const FileOperationNode = memo(({ data, selected }: FileOperationNodeProps) => {
  const operation = data.operation || 'read';
  const config = OPERATION_CONFIG[operation] || OPERATION_CONFIG.read;
  const IconComponent = config.icon;

  // Truncate path for display
  const displayPath = data.path
    ? data.path.length > 25
      ? '...' + data.path.slice(-22)
      : data.path
    : '';

  return (
    <NodeWrapper
      status={data.executionStatus}
      selected={selected}
      accentColor="green"
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-background"
      />

      {/* Node Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-t-md">
        <FileText className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium truncate flex-1">
          {data.label || 'File Operation'}
        </span>
      </div>

      {/* Node Content */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Operation type with icon */}
        <div className="flex items-center gap-1.5">
          <IconComponent className={cn('w-3.5 h-3.5', config.color)} />
          <span className="text-xs font-medium text-foreground">
            {config.label}
          </span>
        </div>

        {/* File path */}
        {data.path && (
          <div
            className="text-xs text-muted-foreground font-mono truncate max-w-[160px]"
            title={data.path}
          >
            {displayPath}
          </div>
        )}

        {/* Badges row */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Add to context badge */}
          {data.addToContext && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              + context
            </span>
          )}

          {/* Output variable badge */}
          {data.outputVariable && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 truncate max-w-[80px]"
              title={data.outputVariable}
            >
              ${data.outputVariable}
            </span>
          )}
        </div>

        {/* Destination path for copy/move */}
        {(operation === 'copy' || operation === 'move') && data.destinationPath && (
          <div className="text-[10px] text-muted-foreground">
            To:{' '}
            <span className="font-mono text-foreground/70" title={data.destinationPath}>
              {data.destinationPath.length > 20
                ? '...' + data.destinationPath.slice(-17)
                : data.destinationPath}
            </span>
          </div>
        )}

        {/* Execution error message */}
        {data.executionStatus === 'failed' && data.executionError && (
          <div
            className="text-[10px] text-destructive truncate max-w-[160px]"
            title={data.executionError}
          >
            {data.executionError}
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-background"
      />
    </NodeWrapper>
  );
});

FileOperationNode.displayName = 'FileOperationNode';
