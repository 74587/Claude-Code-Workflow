// ========================================
// NodeConnector Component
// ========================================
// Visual connector line between pipeline nodes with status-based styling

import { cn } from '@/lib/utils';
import type { NodeExecutionStatus } from '@/stores/coordinatorStore';

export interface NodeConnectorProps {
  status: NodeExecutionStatus;
  className?: string;
}

/**
 * Connector line between timeline nodes
 * Changes color based on the status of the connected node
 */
export function NodeConnector({ status, className }: NodeConnectorProps) {
  // Determine connector color and animation based on status
  const getConnectorStyle = () => {
    switch (status) {
      case 'completed':
        return 'bg-gradient-to-r from-green-500 to-green-400';
      case 'failed':
        return 'bg-gradient-to-r from-red-500 to-red-400';
      case 'running':
        return 'bg-gradient-to-r from-blue-500 to-blue-400 animate-pulse';
      case 'pending':
        return 'bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-700 dark:to-gray-600';
      case 'skipped':
        return 'bg-gradient-to-r from-yellow-400 to-yellow-300';
      default:
        return 'bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-700 dark:to-gray-600';
    }
  };

  return (
    <div
      className={cn(
        'w-16 h-1 shrink-0 transition-all duration-300',
        getConnectorStyle(),
        className
      )}
      aria-hidden="true"
    />
  );
}

export default NodeConnector;
