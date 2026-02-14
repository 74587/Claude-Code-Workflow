// ========================================
// Terminal Dashboard Page
// ========================================
// Three-column Allotment layout for terminal execution management.
// Left: session groups + agent list (with active session count badge)
// Middle: full-height IssuePanel
// Right: terminal workbench (or issue detail preview)
// Bottom: collapsible BottomPanel (Queue + Inspector tabs)
// Cross-cutting: AssociationHighlightProvider wraps the layout

import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { FolderTree, Activity } from 'lucide-react';
import { SessionGroupTree } from '@/components/terminal-dashboard/SessionGroupTree';
import { AgentList } from '@/components/terminal-dashboard/AgentList';
import { IssuePanel } from '@/components/terminal-dashboard/IssuePanel';
import { TerminalWorkbench } from '@/components/terminal-dashboard/TerminalWorkbench';
import { BottomPanel } from '@/components/terminal-dashboard/BottomPanel';
import { AssociationHighlightProvider } from '@/components/terminal-dashboard/AssociationHighlight';
import { Badge } from '@/components/ui/Badge';
import {
  useSessionManagerStore,
  selectGroups,
  selectTerminalMetas,
} from '@/stores/sessionManagerStore';
import type { TerminalStatus } from '@/types/terminal-dashboard';

// ========== Main Page Component ==========

export function TerminalDashboardPage() {
  const { formatMessage } = useIntl();
  const groups = useSessionManagerStore(selectGroups);
  const terminalMetas = useSessionManagerStore(selectTerminalMetas);

  // Active session count for left column header badge
  const sessionCount = useMemo(() => {
    const allSessionIds = groups.flatMap((g) => g.sessionIds);
    let activeCount = 0;
    for (const sid of allSessionIds) {
      const meta = terminalMetas[sid];
      const status: TerminalStatus = meta?.status ?? 'idle';
      if (status === 'active') {
        activeCount++;
      }
    }
    return activeCount > 0 ? activeCount : allSessionIds.length;
  }, [groups, terminalMetas]);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      {/* AssociationHighlightProvider wraps the three-column layout + bottom panel */}
      <AssociationHighlightProvider>
        {/* Three-column Allotment layout (flex-1) */}
        <div className="flex-1 min-h-0">
          <Allotment proportionalLayout={true}>
            {/* Left column: Sessions + Agents */}
            <Allotment.Pane preferredSize={220} minSize={180} maxSize={320}>
              <div className="h-full border-r border-border bg-background flex flex-col">
                <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <FolderTree className="w-4 h-4" />
                    {formatMessage({ id: 'terminalDashboard.columns.sessions' })}
                  </h2>
                  {sessionCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      {sessionCount}
                    </Badge>
                  )}
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

            {/* Middle column: Full-height IssuePanel */}
            <Allotment.Pane minSize={280}>
              <div className="h-full border-r border-border bg-background overflow-hidden">
                <IssuePanel />
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

        {/* BottomPanel: collapsible Queue + Inspector tabs (full-width) */}
        <BottomPanel />
      </AssociationHighlightProvider>
    </div>
  );
}

export default TerminalDashboardPage;
