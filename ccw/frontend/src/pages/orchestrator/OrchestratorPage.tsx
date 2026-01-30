// ========================================
// Orchestrator Page
// ========================================
// Visual workflow editor with React Flow, drag-drop node palette, and property panel

import { useEffect, useState, useCallback } from 'react';
import { useFlowStore } from '@/stores';
import { FlowCanvas } from './FlowCanvas';
import { NodePalette } from './NodePalette';
import { PropertyPanel } from './PropertyPanel';
import { FlowToolbar } from './FlowToolbar';
import { ExecutionMonitor } from './ExecutionMonitor';
import { TemplateLibrary } from './TemplateLibrary';

export function OrchestratorPage() {
  const fetchFlows = useFlowStore((state) => state.fetchFlows);
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
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <FlowToolbar onOpenTemplateLibrary={handleOpenTemplateLibrary} />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Node Palette (Left) */}
        <NodePalette />

        {/* Flow Canvas (Center) */}
        <div className="flex-1 relative">
          <FlowCanvas className="absolute inset-0" />
        </div>

        {/* Property Panel (Right) */}
        <PropertyPanel />
      </div>

      {/* Execution Monitor (Bottom) */}
      <ExecutionMonitor />

      {/* Template Library Dialog */}
      <TemplateLibrary
        open={isTemplateLibraryOpen}
        onOpenChange={setIsTemplateLibraryOpen}
      />
    </div>
  );
}

export default OrchestratorPage;
