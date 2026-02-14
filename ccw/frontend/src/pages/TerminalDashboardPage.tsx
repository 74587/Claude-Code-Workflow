// ========================================
// Terminal Dashboard Page
// ========================================
// Three-column Allotment layout for terminal execution management.
// Left: session groups + agent list
// Middle: issue + queue workflow panels
// Right: terminal workbench
// Top: GlobalKpiBar (real component)
// Bottom: BottomInspector (collapsible, real component)
// Cross-cutting: AssociationHighlightProvider wraps the layout

import { useIntl } from 'react-intl';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { FolderTree } from 'lucide-react';
import { SessionGroupTree } from '@/components/terminal-dashboard/SessionGroupTree';
import { AgentList } from '@/components/terminal-dashboard/AgentList';
import { IssuePanel } from '@/components/terminal-dashboard/IssuePanel';
import { QueuePanel } from '@/components/terminal-dashboard/QueuePanel';
import { TerminalWorkbench } from '@/components/terminal-dashboard/TerminalWorkbench';
import { GlobalKpiBar } from '@/components/terminal-dashboard/GlobalKpiBar';
import { BottomInspector } from '@/components/terminal-dashboard/BottomInspector';
import { AssociationHighlightProvider } from '@/components/terminal-dashboard/AssociationHighlight';

// ========== Main Page Component ==========

export function TerminalDashboardPage() {
  const { formatMessage } = useIntl();

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      {/* GlobalKpiBar at top (flex-shrink-0) */}
      <GlobalKpiBar />

      {/* AssociationHighlightProvider wraps the three-column layout + bottom inspector */}
      <AssociationHighlightProvider>
        {/* Three-column Allotment layout (flex-1) */}
        <div className="flex-1 min-h-0">
          <Allotment proportionalLayout={true}>
            {/* Left column: Sessions */}
            <Allotment.Pane preferredSize={250} minSize={180} maxSize={400}>
              <div className="h-full border-r border-border bg-background flex flex-col">
                <div className="px-3 py-2 border-b border-border shrink-0">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <FolderTree className="w-4 h-4" />
                    {formatMessage({ id: 'terminalDashboard.columns.sessions' })}
                  </h2>
                </div>
                {/* SessionGroupTree takes remaining space */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <SessionGroupTree />
                </div>
                {/* AgentList at bottom with max height */}
                <div className="shrink-0">
                  <AgentList />
                </div>
              </div>
            </Allotment.Pane>

            {/* Middle column: Workflow (IssuePanel + QueuePanel vertical split) */}
            <Allotment.Pane minSize={300}>
              <div className="h-full border-r border-border bg-background overflow-hidden">
                <Allotment vertical proportionalLayout={true}>
                  {/* Top: IssuePanel */}
                  <Allotment.Pane minSize={120}>
                    <div className="h-full overflow-hidden">
                      <IssuePanel />
                    </div>
                  </Allotment.Pane>
                  {/* Bottom: QueuePanel */}
                  <Allotment.Pane minSize={120}>
                    <div className="h-full overflow-hidden border-t border-border">
                      <QueuePanel />
                    </div>
                  </Allotment.Pane>
                </Allotment>
              </div>
            </Allotment.Pane>

            {/* Right column: Terminal Workbench */}
            <Allotment.Pane minSize={300}>
              <div className="h-full bg-background overflow-hidden">
                <TerminalWorkbench />
              </div>
            </Allotment.Pane>
          </Allotment>
        </div>

        {/* BottomInspector at bottom (flex-shrink-0) */}
        <BottomInspector />
      </AssociationHighlightProvider>
    </div>
  );
}

export default TerminalDashboardPage;
