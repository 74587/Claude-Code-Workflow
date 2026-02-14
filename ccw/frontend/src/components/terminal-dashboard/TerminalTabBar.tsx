// ========================================
// TerminalTabBar Component
// ========================================
// Horizontal tab strip for terminal sessions in the Terminal Dashboard.
// Renders tabs from sessionManagerStore groups with status indicators and alert badges.

import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Terminal, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useSessionManagerStore,
  selectGroups,
  selectSessionManagerActiveTerminalId,
  selectTerminalMetas,
} from '@/stores/sessionManagerStore';
import type { TerminalStatus } from '@/types/terminal-dashboard';

// ========== Status Styles ==========

const statusDotStyles: Record<TerminalStatus, string> = {
  active: 'bg-green-500',
  idle: 'bg-gray-400',
  error: 'bg-red-500',
};

// ========== Component ==========

export function TerminalTabBar() {
  const { formatMessage } = useIntl();
  const groups = useSessionManagerStore(selectGroups);
  const activeTerminalId = useSessionManagerStore(selectSessionManagerActiveTerminalId);
  const terminalMetas = useSessionManagerStore(selectTerminalMetas);
  const setActiveTerminal = useSessionManagerStore((s) => s.setActiveTerminal);

  // Flatten all sessionIds from all groups
  const allSessionIds = groups.flatMap((g) => g.sessionIds);

  // Total alerts across all terminals
  const totalAlerts = useMemo(() => {
    let count = 0;
    for (const meta of Object.values(terminalMetas)) {
      count += meta.alertCount;
    }
    return count;
  }, [terminalMetas]);

  if (allSessionIds.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30 min-h-[40px]">
        <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {formatMessage({ id: 'terminalDashboard.tabBar.noTabs' })}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center border-b border-border bg-muted/30 overflow-x-auto shrink-0">
      {allSessionIds.map((sessionId) => {
        const meta = terminalMetas[sessionId];
        const title = meta?.title ?? sessionId;
        const status: TerminalStatus = meta?.status ?? 'idle';
        const alertCount = meta?.alertCount ?? 0;
        const isActive = activeTerminalId === sessionId;

        return (
          <button
            key={sessionId}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs border-r border-border',
              'whitespace-nowrap transition-colors hover:bg-accent/50',
              isActive
                ? 'bg-background text-foreground border-b-2 border-b-primary'
                : 'text-muted-foreground'
            )}
            onClick={() => setActiveTerminal(sessionId)}
            title={title}
          >
            {/* Status dot */}
            <span
              className={cn(
                'w-2 h-2 rounded-full shrink-0',
                statusDotStyles[status]
              )}
            />

            {/* Title */}
            <span className="truncate max-w-[120px]">{title}</span>

            {/* Alert badge */}
            {alertCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium leading-none rounded-full bg-destructive text-destructive-foreground shrink-0">
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
          </button>
        );
      })}

      {/* Total alerts indicator at right end */}
      {totalAlerts > 0 && (
        <div className="ml-auto flex items-center gap-1 px-3 py-2 shrink-0 text-destructive">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="text-[10px] font-semibold tabular-nums">
            {totalAlerts > 99 ? '99+' : totalAlerts}
          </span>
        </div>
      )}
    </div>
  );
}
