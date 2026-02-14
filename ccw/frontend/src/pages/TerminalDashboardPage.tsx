// ========================================
// Terminal Dashboard Page (V2)
// ========================================
// Terminal-first layout with fixed session sidebar + floating panels.
// Left sidebar: SessionGroupTree + AgentList (always visible)
// Main area: TerminalGrid (tmux-style split panes)
// Top: DashboardToolbar with panel toggles and layout presets
// Floating panels: Issues, Queue, Inspector (overlay, mutually exclusive)

import { useState, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { AssociationHighlightProvider } from '@/components/terminal-dashboard/AssociationHighlight';
import { DashboardToolbar, type PanelId } from '@/components/terminal-dashboard/DashboardToolbar';
import { TerminalGrid } from '@/components/terminal-dashboard/TerminalGrid';
import { FloatingPanel } from '@/components/terminal-dashboard/FloatingPanel';
import { SessionGroupTree } from '@/components/terminal-dashboard/SessionGroupTree';
import { AgentList } from '@/components/terminal-dashboard/AgentList';
import { IssuePanel } from '@/components/terminal-dashboard/IssuePanel';
import { QueuePanel } from '@/components/terminal-dashboard/QueuePanel';
import { InspectorContent } from '@/components/terminal-dashboard/BottomInspector';

// ========== Main Page Component ==========

export function TerminalDashboardPage() {
  const { formatMessage } = useIntl();
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);

  const togglePanel = useCallback((panelId: PanelId) => {
    setActivePanel((prev) => (prev === panelId ? null : panelId));
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  return (
    <div className="-m-4 md:-m-6 flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      <AssociationHighlightProvider>
        {/* Global toolbar */}
        <DashboardToolbar
          activePanel={activePanel}
          onTogglePanel={togglePanel}
        />

        {/* Main content: session sidebar + terminal grid */}
        <div className="flex flex-1 min-h-0">
          {/* Fixed session sidebar */}
          <div className="w-[240px] shrink-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <SessionGroupTree />
            </div>
            <div className="shrink-0">
              <AgentList />
            </div>
          </div>

          {/* Terminal grid (takes remaining space) */}
          <div className="flex-1 min-h-0">
            <TerminalGrid />
          </div>
        </div>

        {/* Floating panels (conditional, overlay) */}
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
      </AssociationHighlightProvider>
    </div>
  );
}

export default TerminalDashboardPage;
