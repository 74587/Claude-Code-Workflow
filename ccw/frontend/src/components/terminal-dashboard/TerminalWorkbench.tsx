// ========================================
// TerminalWorkbench Component
// ========================================
// Container for the right panel of the Terminal Dashboard.
// Combines TerminalTabBar (tab switching) and TerminalInstance (xterm.js)
// in a flex-col layout. MVP scope: single terminal view (1x1 grid).

import { useIntl } from 'react-intl';
import { Terminal } from 'lucide-react';
import {
  useSessionManagerStore,
  selectSessionManagerActiveTerminalId,
} from '@/stores/sessionManagerStore';
import { TerminalTabBar } from './TerminalTabBar';
import { TerminalInstance } from './TerminalInstance';

// ========== Component ==========

export function TerminalWorkbench() {
  const { formatMessage } = useIntl();
  const activeTerminalId = useSessionManagerStore(selectSessionManagerActiveTerminalId);

  return (
    <div className="flex flex-col h-full">
      {/* Tab strip (fixed height) */}
      <TerminalTabBar />

      {/* Terminal content (flex-1, takes remaining space) */}
      {activeTerminalId ? (
        <div className="flex-1 min-h-0">
          <TerminalInstance sessionId={activeTerminalId} />
        </div>
      ) : (
        /* Empty state when no terminal is selected */
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Terminal className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">
              {formatMessage({ id: 'terminalDashboard.workbench.noTerminal' })}
            </p>
            <p className="text-xs mt-1 opacity-70">
              {formatMessage({ id: 'terminalDashboard.workbench.noTerminalHint' })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
