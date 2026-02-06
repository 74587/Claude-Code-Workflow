// ========================================
// Orchestrator Page
// ========================================
// Visual workflow editor with React Flow, drag-drop node palette, and property panel

import { useEffect, useState, useCallback } from 'react';
import { useFlowStore } from '@/stores';
import { useExecutionStore } from '@/stores/executionStore';
import { FlowCanvas } from './FlowCanvas';
import { LeftSidebar } from './LeftSidebar';
import { PropertyPanel } from './PropertyPanel';
import { FlowToolbar } from './FlowToolbar';
import { TemplateLibrary } from './TemplateLibrary';
import { ExecutionMonitor } from './ExecutionMonitor';

export function OrchestratorPage() {
  const fetchFlows = useFlowStore((state) => state.fetchFlows);
  const isMonitorPanelOpen = useExecutionStore((state) => state.isMonitorPanelOpen);
  const [isTemplateLibraryOpen, setIsTemplateLibraryOpen] = useState(false);

  // Load flows on mount
  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  // Handle open template library
  const handleOpenTemplateLibrary = useCallback(() => {
    setIsTemplateLibraryOpen(true);
  }, []);

  return (
    <div className="h-[calc(100%+2rem)] md:h-[calc(100%+3rem)] flex flex-col -m-4 md:-m-6">
      {/* Toolbar */}
      <FlowToolbar onOpenTemplateLibrary={handleOpenTemplateLibrary} />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Templates + Nodes) */}
        <LeftSidebar />

        {/* Flow Canvas (Center) */}
        <div className="flex-1 relative">
          <FlowCanvas className="absolute inset-0" />
        </div>

        {/* Property Panel (Right) - hidden when monitor is open */}
        {!isMonitorPanelOpen && <PropertyPanel />}

        {/* Execution Monitor Panel (Right) */}
        <ExecutionMonitor />
      </div>

      {/* Template Library Dialog */}
      <TemplateLibrary
        open={isTemplateLibraryOpen}
        onOpenChange={setIsTemplateLibraryOpen}
      />
    </div>
  );
}
