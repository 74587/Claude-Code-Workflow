// ========================================
// Coordinator Page
// ========================================
// Page for monitoring and managing coordinator workflow execution with timeline, logs, and node details

import { useState, useCallback, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  CoordinatorInputModal,
  CoordinatorTimeline,
  CoordinatorLogStream,
  NodeDetailsPanel,
} from '@/components/coordinator';
import {
  useCoordinatorStore,
  selectCommandChain,
  selectCurrentNode,
  selectCoordinatorStatus,
  selectIsPipelineLoaded,
} from '@/stores/coordinatorStore';

export function CoordinatorPage() {
  const { formatMessage } = useIntl();
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Store selectors
  const commandChain = useCoordinatorStore(selectCommandChain);
  const currentNode = useCoordinatorStore(selectCurrentNode);
  const status = useCoordinatorStore(selectCoordinatorStatus);
  const isPipelineLoaded = useCoordinatorStore(selectIsPipelineLoaded);
  const syncStateFromServer = useCoordinatorStore((state) => state.syncStateFromServer);
  const reset = useCoordinatorStore((state) => state.reset);

  // Sync state on mount (for page refresh scenarios)
  useEffect(() => {
    if (status === 'running' || status === 'paused' || status === 'initializing') {
      syncStateFromServer();
    }
  }, []);

  // Handle open input modal
  const handleOpenInputModal = useCallback(() => {
    setIsInputModalOpen(true);
  }, []);

  // Handle node click from timeline
  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(nodeId);
  }, []);

  // Get selected node object
  const selectedNodeObject = commandChain.find((node) => node.id === selectedNode) || currentNode || null;

  return (
    <div className="h-full flex flex-col -m-4 md:-m-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 bg-card border-b border-border">
        {/* Page Title and Status */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Play className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'coordinator.page.title' })}
            </span>
            {isPipelineLoaded && (
              <span className="text-xs text-muted-foreground">
                {formatMessage({ id: 'coordinator.page.status' }, {
                  status: formatMessage({ id: `coordinator.status.${status}` }),
                })}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleOpenInputModal}
            disabled={status === 'running' || status === 'initializing'}
          >
            <Play className="w-4 h-4 mr-1" />
            {formatMessage({ id: 'coordinator.page.startButton' })}
          </Button>
        </div>
      </div>

      {/* Main Content Area - 3 Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Timeline */}
        <div className="w-1/3 min-w-[300px] border-r border-border bg-card">
          <CoordinatorTimeline
            autoScroll={true}
            onNodeClick={handleNodeClick}
            className="h-full"
          />
        </div>

        {/* Center Panel: Log Stream */}
        <div className="flex-1 min-w-0 bg-card">
          <CoordinatorLogStream />
        </div>

        {/* Right Panel: Node Details */}
        <div className="w-80 min-w-[320px] max-w-[400px] border-l border-border bg-card overflow-y-auto">
          {selectedNodeObject ? (
            <NodeDetailsPanel
              node={selectedNodeObject}
              isExpanded={true}
              onToggle={(expanded) => {
                if (!expanded) {
                  setSelectedNode(null);
                }
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
              {formatMessage({ id: 'coordinator.page.noNodeSelected' })}
            </div>
          )}
        </div>
      </div>

      {/* Coordinator Input Modal */}
      <CoordinatorInputModal
        open={isInputModalOpen}
        onClose={() => setIsInputModalOpen(false)}
      />
    </div>
  );
}

export default CoordinatorPage;
