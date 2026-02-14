// ========================================
// TerminalNavBar Component
// ========================================
// Left-side icon navigation bar (w-16) inside TerminalPanel.
// Shows fixed queue entry icon + dynamic terminal icons with status badges.

import { useState, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { ClipboardList, Terminal, Loader2, CheckCircle, XCircle, Circle, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTerminalPanelStore } from '@/stores/terminalPanelStore';
import { useCliSessionStore, type CliSessionMeta, type CliSessionOutputChunk } from '@/stores/cliSessionStore';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { createCliSession } from '@/lib/api';

// ========== Status Badge Mapping ==========

type SessionStatus = 'running' | 'completed' | 'failed' | 'idle';

/** Activity detection threshold in milliseconds */
const ACTIVITY_THRESHOLD_MS = 10_000;

function getSessionStatus(
  session: CliSessionMeta | undefined,
  chunks: CliSessionOutputChunk[] | undefined,
): SessionStatus {
  if (!session) return 'idle';
  if (!chunks || chunks.length === 0) return 'idle';
  const lastChunk = chunks[chunks.length - 1];
  if (Date.now() - lastChunk.timestamp < ACTIVITY_THRESHOLD_MS) return 'running';
  return 'idle';
}

const statusStyles: Record<SessionStatus, string> = {
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  idle: 'bg-gray-500',
};

const StatusIcon: Record<SessionStatus, React.ComponentType<{ className?: string }>> = {
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  idle: Circle,
};

export function TerminalNavBar() {
  const panelView = useTerminalPanelStore((s) => s.panelView);
  const activeTerminalId = useTerminalPanelStore((s) => s.activeTerminalId);
  const terminalOrder = useTerminalPanelStore((s) => s.terminalOrder);
  const setPanelView = useTerminalPanelStore((s) => s.setPanelView);
  const setActiveTerminal = useTerminalPanelStore((s) => s.setActiveTerminal);
  const openTerminal = useTerminalPanelStore((s) => s.openTerminal);

  const sessions = useCliSessionStore((s) => s.sessions);
  const outputChunks = useCliSessionStore((s) => s.outputChunks);
  const upsertSession = useCliSessionStore((s) => s.upsertSession);
  const { formatMessage } = useIntl();

  const projectPath = useWorkflowStore(selectProjectPath);
  const [isCreating, setIsCreating] = useState(false);
  const [showToolMenu, setShowToolMenu] = useState(false);

  const CLI_TOOLS = ['claude', 'gemini', 'qwen', 'codex', 'opencode'] as const;

  const handleCreateSession = useCallback(async (tool: string) => {
    if (!projectPath || isCreating) return;
    setIsCreating(true);
    setShowToolMenu(false);
    try {
      const created = await createCliSession(
        { workingDir: projectPath, tool },
        projectPath
      );
      upsertSession(created.session);
      openTerminal(created.session.sessionKey);
    } catch (err) {
      console.error('[TerminalNavBar] createCliSession failed:', err);
    } finally {
      setIsCreating(false);
    }
  }, [projectPath, isCreating, upsertSession, openTerminal]);

  const handleQueueClick = () => {
    setPanelView('queue');
  };

  const handleTerminalClick = (sessionKey: string) => {
    setActiveTerminal(sessionKey);
    setPanelView('terminal');
  };

  return (
    <div className="w-16 flex-shrink-0 border-r border-border bg-card flex flex-col items-center py-2">
      {/* Queue Entry - Fixed at top */}
      <button
        className={cn(
          'w-10 h-10 rounded-md flex items-center justify-center transition-colors hover:bg-accent',
          panelView === 'queue' && 'bg-accent'
        )}
        onClick={handleQueueClick}
        title={formatMessage({ id: 'home.terminalPanel.executionQueue' })}
      >
        <ClipboardList className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Separator */}
      <div className="w-8 border-t border-border my-2" />

      {/* Dynamic Terminal Icons */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center gap-1 w-full px-1">
        {terminalOrder.map((sessionKey) => {
          const session = sessions[sessionKey];
          const status = getSessionStatus(session, outputChunks[sessionKey]);
          const StatusIconComp = StatusIcon[status];
          const isActive = activeTerminalId === sessionKey && panelView === 'terminal';
          const label = session
            ? `${session.tool || 'cli'} - ${session.sessionKey}`
            : sessionKey;

          return (
            <button
              key={sessionKey}
              className={cn(
                'relative w-10 h-10 rounded-md flex items-center justify-center transition-colors hover:bg-accent',
                isActive && 'bg-accent'
              )}
              onClick={() => handleTerminalClick(sessionKey)}
              title={label}
            >
              <Terminal className="h-5 w-5 text-muted-foreground" />

              {/* Status Badge - bottom-right overlay */}
              <span
                className={cn(
                  'absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center',
                  statusStyles[status]
                )}
              >
                <StatusIconComp
                  className={cn(
                    'h-2 w-2 text-white',
                    status === 'running' && 'animate-spin'
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>

      {/* New Terminal Button - Fixed at bottom */}
      <div className="relative">
        <div className="w-8 border-t border-border mb-2" />
        <button
          className={cn(
            'w-10 h-10 rounded-md flex items-center justify-center transition-colors hover:bg-accent',
            !projectPath && 'opacity-40 cursor-not-allowed'
          )}
          onClick={() => projectPath && setShowToolMenu(!showToolMenu)}
          disabled={isCreating || !projectPath}
          title={formatMessage({ id: 'home.terminalPanel.newSession' })}
        >
          {isCreating ? (
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          ) : (
            <Plus className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {/* Tool Selection Popup */}
        {showToolMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowToolMenu(false)} />
            <div className="absolute left-full bottom-0 ml-1 z-50 bg-card border border-border rounded-md shadow-lg py-1 min-w-[120px]">
              {CLI_TOOLS.map((tool) => (
                <button
                  key={tool}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                  onClick={() => handleCreateSession(tool)}
                >
                  {tool}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
