// ========================================
// CoordinatorTimeline Component
// ========================================
// Main horizontal timeline container for coordinator pipeline visualization

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useCoordinatorStore, selectCommandChain, selectCurrentNode } from '@/stores/coordinatorStore';
import { TimelineNode } from './TimelineNode';
import { NodeConnector } from './NodeConnector';

export interface CoordinatorTimelineProps {
  className?: string;
  autoScroll?: boolean;
  onNodeClick?: (nodeId: string) => void;
}

/**
 * Horizontal scrolling timeline displaying the coordinator command chain
 * with connectors between nodes
 */
export function CoordinatorTimeline({
  className,
  autoScroll = true,
  onNodeClick,
}: CoordinatorTimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Store selectors
  const commandChain = useCoordinatorStore(selectCommandChain);
  const currentNode = useCoordinatorStore(selectCurrentNode);

  // Auto-scroll to the current/latest node
  useEffect(() => {
    if (!autoScroll || !scrollContainerRef.current) return;

    // Find the active or latest node
    const activeNodeIndex = commandChain.findIndex(
      (node) => node.status === 'running' || node.id === currentNode?.id
    );

    // If no active node, scroll to the end
    if (activeNodeIndex === -1) {
      scrollContainerRef.current.scrollTo({
        left: scrollContainerRef.current.scrollWidth,
        behavior: 'smooth',
      });
      return;
    }

    // Scroll the active node into view
    const nodeElements = scrollContainerRef.current.querySelectorAll('[data-node-id]');
    const activeElement = nodeElements[activeNodeIndex] as HTMLElement;

    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [commandChain, currentNode?.id, autoScroll]);

  // Handle node click
  const handleNodeClick = (nodeId: string) => {
    if (onNodeClick) {
      onNodeClick(nodeId);
    }
  };

  // Render empty state
  if (commandChain.length === 0) {
    return (
      <div className={cn('flex items-center justify-center p-8 text-muted-foreground', className)}>
        <div className="text-center">
          <p className="text-sm">No pipeline nodes to display</p>
          <p className="text-xs mt-1">Start a coordinator execution to see the pipeline</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        'flex items-center gap-0 p-4 overflow-x-auto overflow-y-hidden',
        'scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent',
        className
      )}
      role="region"
      aria-label="Coordinator pipeline timeline"
    >
      {commandChain.map((node, index) => (
        <div key={node.id} className="flex items-center" data-node-id={node.id}>
          {/* Timeline node */}
          <TimelineNode
            node={node}
            isActive={currentNode?.id === node.id}
            onClick={() => handleNodeClick(node.id)}
          />

          {/* Connector to next node (if not last) */}
          {index < commandChain.length - 1 && (
            <NodeConnector
              status={commandChain[index + 1].status}
              className="mx-2"
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default CoordinatorTimeline;
