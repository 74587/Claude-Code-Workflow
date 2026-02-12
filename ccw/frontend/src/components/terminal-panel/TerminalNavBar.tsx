// ========================================
// TerminalNavBar Component
// ========================================
// Left navigation bar for the terminal panel.
// Shows queue entry icon at top, separator, and dynamic terminal session icons
// with status badges. Reads session data from cliSessionStore and panel state
// from terminalPanelStore.

import { useMemo } from 'react';
import {
  ClipboardList,
  Terminal,
  Loader2,
  CheckCircle,
  XCircle,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTerminalPanelStore } from '@/stores/terminalPanelStore';
import { useCliSessionStore } from '@/stores/cliSessionStore';

// ========== Status Badge Configuration ==========

type SessionStatus = 'running' | 'completed' | 'failed' | 'idle';

interface StatusBadgeConfig {
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
}

const statusBadgeMap: Record<SessionStatus, StatusBadgeConfig> = {
  running: { icon: Loader2, colorClass: 'bg-blue-500' },
  completed: { icon: CheckCircle, colorClass: 'bg-green-500' },
  failed: { icon: XCircle, colorClass: 'bg-red-500' },
  idle: { icon: Circle, colorClass: 'bg-gray-500' },
};

// ========== Helpers ==========

/**
 * Derive a simple session status from the session metadata.
 * This is a heuristic based on available data - the shellKind and updatedAt fields
 * provide indirect clues about activity. A more precise status would require
 * backend support for explicit session state tracking.
 */
function deriveSessionStatus(_sessionKey: string, _shellKind: string): SessionStatus {
  // For now, default to idle. In Phase 2 we can refine this
  // based on active execution tracking from the backend.
  return 'idle';
}

// ========== Component ==========

export function TerminalNavBar() {
  const panelView = useTerminalPanelStore((s) => s.panelView);
  const activeTerminalId = useTerminalPanelStore((s) => s.activeTerminalId);
  const terminalOrder = useTerminalPanelStore((s) => s.terminalOrder);
  const setActiveTerminal = useTerminalPanelStore((s) => s.setActiveTerminal);
  const setPanelView = useTerminalPanelStore((s) => s.setPanelView);

  const sessionsByKey = useCliSessionStore((s) => s.sessions);

  // Build ordered list of sessions that exist in the store
  const orderedSessions = useMemo(() => {
    return terminalOrder
      .map((key) => sessionsByKey[key])
      .filter(Boolean);
  }, [terminalOrder, sessionsByKey]);

  const handleQueueClick = () => {
    setPanelView('queue');
  };

  const handleTerminalClick = (sessionKey: string) => {
    setPanelView('terminal');
    setActiveTerminal(sessionKey);
  };

  return (
    <div className="w-16 flex-shrink-0 flex flex-col border-r border-border bg-muted/30">
      {/* Queue entry icon */}
      <div className="flex items-center justify-center py-3">
        <button
          type="button"
          onClick={handleQueueClick}
          className={cn(
            'w-10 h-10 flex items-center justify-center rounded-md transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            panelView === 'queue' && 'bg-accent text-accent-foreground'
          )}
          title="Execution Queue"
        >
          <ClipboardList className="w-5 h-5" />
        </button>
      </div>

      {/* Separator */}
      <div className="mx-3 border-t border-border" />

      {/* Terminal session icons (scrollable) */}
      <div className="flex-1 overflow-y-auto py-2 space-y-1">
        {orderedSessions.map((session) => {
          const isActive = activeTerminalId === session.sessionKey && panelView === 'terminal';
          const status = deriveSessionStatus(session.sessionKey, session.shellKind);
          const badge = statusBadgeMap[status];
          const BadgeIcon = badge.icon;

          return (
            <div key={session.sessionKey} className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => handleTerminalClick(session.sessionKey)}
                className={cn(
                  'relative w-10 h-10 flex items-center justify-center rounded-md transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent text-accent-foreground'
                )}
                title={`${session.tool || 'cli'} - ${session.sessionKey}`}
              >
                <Terminal className="w-5 h-5" />
                {/* Status badge overlay */}
                <span
                  className={cn(
                    'absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center',
                    badge.colorClass
                  )}
                >
                  <BadgeIcon
                    className={cn(
                      'w-2 h-2 text-white',
                      status === 'running' && 'animate-spin'
                    )}
                  />
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
