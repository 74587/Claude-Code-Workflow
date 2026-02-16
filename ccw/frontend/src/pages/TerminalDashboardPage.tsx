// ========================================
// Terminal Dashboard Page (V2)
// ========================================
// Terminal-first layout with fixed session sidebar + floating panels + right file sidebar.
// Left sidebar: SessionGroupTree + AgentList (always visible)
// Main area: TerminalGrid (tmux-style split panes)
// Right sidebar: FileSidebarPanel (file tree, resizable)
// Top: DashboardToolbar with panel toggles and layout presets
// Floating panels: Issues, Queue, Inspector (overlay, mutually exclusive)
// Fullscreen mode: Hides all sidebars for maximum terminal space

import { useState, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { AssociationHighlightProvider } from '@/components/terminal-dashboard/AssociationHighlight';
import { DashboardToolbar, type PanelId } from '@/components/terminal-dashboard/DashboardToolbar';
import { TerminalGrid } from '@/components/terminal-dashboard/TerminalGrid';
import { FloatingPanel } from '@/components/terminal-dashboard/FloatingPanel';
import { SessionGroupTree } from '@/components/terminal-dashboard/SessionGroupTree';
import { AgentList } from '@/components/terminal-dashboard/AgentList';
import { IssuePanel } from '@/components/terminal-dashboard/IssuePanel';
import { QueuePanel } from '@/components/terminal-dashboard/QueuePanel';
import { InspectorContent } from '@/components/terminal-dashboard/BottomInspector';
import { FileSidebarPanel } from '@/components/terminal-dashboard/FileSidebarPanel';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// ========== Main Page Component ==========

export function TerminalDashboardPage() {
  const { formatMessage } = useIntl();
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [isFileSidebarOpen, setIsFileSidebarOpen] = useState(true);
  const [isSessionSidebarOpen, setIsSessionSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const projectPath = useWorkflowStore(selectProjectPath);

  const togglePanel = useCallback((panelId: PanelId) => {
    setActivePanel((prev) => (prev === panelId ? null : panelId));
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // In fullscreen mode, hide all sidebars and panels
  const showSessionSidebar = isSessionSidebarOpen && !isFullscreen;
  const showFileSidebar = isFileSidebarOpen && !isFullscreen;
  const showFloatingPanels = !isFullscreen;

  return (
    <div className={`flex flex-col overflow-hidden ${isFullscreen ? 'h-screen -m-0' : 'h-[calc(100vh-56px)] -m-4 md:-m-6'}`}>
      <AssociationHighlightProvider>
        {/* Global toolbar */}
        <DashboardToolbar
          activePanel={activePanel}
          onTogglePanel={togglePanel}
          isFileSidebarOpen={isFileSidebarOpen}
          onToggleFileSidebar={() => setIsFileSidebarOpen((prev) => !prev)}
          isSessionSidebarOpen={isSessionSidebarOpen}
          onToggleSessionSidebar={() => setIsSessionSidebarOpen((prev) => !prev)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />

        {/* Main content with three-column layout */}
        <div className="flex-1 min-h-0">
          <Allotment className="h-full">
            {/* Session sidebar (conditional) */}
            {showSessionSidebar && (
              <Allotment.Pane preferredSize={240} minSize={180} maxSize={320}>
                <div className="h-full flex flex-col border-r border-border">
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <SessionGroupTree />
                  </div>
                  <div className="shrink-0">
                    <AgentList />
                  </div>
                </div>
              </Allotment.Pane>
            )}

            {/* Terminal grid (flexible) */}
            <Allotment.Pane preferredSize={-1} minSize={300}>
              <TerminalGrid />
            </Allotment.Pane>

            {/* File sidebar (conditional, default 280px) */}
            {showFileSidebar && (
              <Allotment.Pane preferredSize={280} minSize={200} maxSize={400}>
                <FileSidebarPanel
                  rootPath={projectPath ?? '/'}
                  enabled={!!projectPath}
                  onCollapse={() => setIsFileSidebarOpen(false)}
                />
              </Allotment.Pane>
            )}
          </Allotment>
        </div>

        {/* Floating panels (conditional, overlay) */}
        {showFloatingPanels && (
          <>
            <FloatingPanel
              isOpen={activePanel === 'issues'}
              onClose={closePanel}
              title={formatMessage({ id: 'terminalDashboard.toolbar.issues' })}
              side="left"
              width={380}
            >
              <IssuePanel />
            </FloatingPanel>

            <FloatingPanel
              isOpen={activePanel === 'queue'}
              onClose={closePanel}
              title={formatMessage({ id: 'terminalDashboard.toolbar.queue' })}
              side="right"
              width={400}
            >
              <QueuePanel />
            </FloatingPanel>

            <FloatingPanel
              isOpen={activePanel === 'inspector'}
              onClose={closePanel}
              title={formatMessage({ id: 'terminalDashboard.toolbar.inspector' })}
              side="right"
              width={360}
            >
              <InspectorContent />
            </FloatingPanel>
          </>
        )}
      </AssociationHighlightProvider>
    </div>
  );
}

export default TerminalDashboardPage;
