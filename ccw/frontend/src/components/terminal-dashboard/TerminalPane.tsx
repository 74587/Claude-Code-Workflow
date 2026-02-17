// ========================================
// TerminalPane Component
// ========================================
// Single terminal pane = PaneToolbar + content area.
// Content can be terminal output or file preview based on displayMode.
// Renders within the TerminalGrid recursive layout.
// File preview is triggered from right sidebar FileSidebarPanel.

import { useCallback, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  SplitSquareHorizontal,
  SplitSquareVertical,
  Eraser,
  AlertTriangle,
  X,
  Terminal,
  ChevronDown,
  RotateCcw,
  Pause,
  Play,
  Loader2,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TerminalInstance } from './TerminalInstance';
import { FilePreview } from '@/components/shared/FilePreview';
import {
  useTerminalGridStore,
  selectTerminalGridPanes,
  selectTerminalGridFocusedPaneId,
} from '@/stores/terminalGridStore';
import {
  useSessionManagerStore,
  selectGroups,
  selectTerminalMetas,
} from '@/stores/sessionManagerStore';
import {
  useIssueQueueIntegrationStore,
  selectAssociationChain,
} from '@/stores/issueQueueIntegrationStore';
import { useCliSessionStore } from '@/stores/cliSessionStore';
import { getAllPaneIds } from '@/lib/layout-utils';
import { useFileContent } from '@/hooks/useFileExplorer';
import type { PaneId } from '@/stores/viewerStore';
import type { TerminalStatus } from '@/types/terminal-dashboard';

// ========== Status Styles ==========

const statusDotStyles: Record<TerminalStatus, string> = {
  active: 'bg-green-500',
  idle: 'bg-gray-400',
  error: 'bg-red-500',
  paused: 'bg-yellow-500',
  resuming: 'bg-blue-400 animate-pulse',
};

// ========== Props ==========

interface TerminalPaneProps {
  paneId: PaneId;
}

// ========== Component ==========

export function TerminalPane({ paneId }: TerminalPaneProps) {
  const { formatMessage } = useIntl();

  // Grid store
  const panes = useTerminalGridStore(selectTerminalGridPanes);
  const focusedPaneId = useTerminalGridStore(selectTerminalGridFocusedPaneId);
  const layout = useTerminalGridStore((s) => s.layout);
  const splitPane = useTerminalGridStore((s) => s.splitPane);
  const closePane = useTerminalGridStore((s) => s.closePane);
  const assignSession = useTerminalGridStore((s) => s.assignSession);
  const setFocused = useTerminalGridStore((s) => s.setFocused);
  const setPaneDisplayMode = useTerminalGridStore((s) => s.setPaneDisplayMode);

  const pane = panes[paneId];
  const sessionId = pane?.sessionId ?? null;
  const displayMode = pane?.displayMode ?? 'terminal';
  const filePath = pane?.filePath ?? null;
  const isFocused = focusedPaneId === paneId;
  const canClose = getAllPaneIds(layout).length > 1;
  const isFileMode = displayMode === 'file' && filePath;

  // Session data
  const groups = useSessionManagerStore(selectGroups);
  const terminalMetas = useSessionManagerStore(selectTerminalMetas);
  const sessions = useCliSessionStore((s) => s.sessions);

  // Session lifecycle actions
  const pauseSession = useSessionManagerStore((s) => s.pauseSession);
  const resumeSession = useSessionManagerStore((s) => s.resumeSession);
  const restartSession = useSessionManagerStore((s) => s.restartSession);

  // Action loading states
  const [isRestarting, setIsRestarting] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);

  // File content for preview mode
  const { content: fileContent, isLoading: isFileLoading, error: fileError } = useFileContent(filePath, {
    enabled: displayMode === 'file' && !!filePath,
  });

  // Association chain for linked issue badge
  const associationChain = useIssueQueueIntegrationStore(selectAssociationChain);
  const linkedIssueId = useMemo(() => {
    if (!sessionId || !associationChain) return null;
    if (associationChain.sessionId === sessionId) return associationChain.issueId;
    return null;
  }, [sessionId, associationChain]);

  // Terminal metadata
  const meta = sessionId ? terminalMetas[sessionId] : null;
  const status: TerminalStatus = meta?.status ?? 'idle';
  const alertCount = meta?.alertCount ?? 0;

  // Build session options for dropdown
  const sessionOptions = useMemo(() => {
    const allSessionIds = groups.flatMap((g) => g.sessionIds);
    return allSessionIds.map((sid) => {
      const s = sessions[sid];
      const name = s ? (s.tool ? `${s.tool} - ${s.shellKind}` : s.shellKind) : sid;
      return { id: sid, name };
    });
  }, [groups, sessions]);

  // Handlers
  const handleFocus = useCallback(() => {
    setFocused(paneId);
  }, [paneId, setFocused]);

  const handleSplitH = useCallback(() => {
    splitPane(paneId, 'horizontal');
  }, [paneId, splitPane]);

  const handleSplitV = useCallback(() => {
    splitPane(paneId, 'vertical');
  }, [paneId, splitPane]);

  const handleClose = useCallback(() => {
    closePane(paneId);
  }, [paneId, closePane]);

  const handleSessionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      assignSession(paneId, value || null);
    },
    [paneId, assignSession]
  );

  const handleClear = useCallback(() => {
    // Clear is handled by re-assigning the same session (triggers reset in TerminalInstance)
    if (sessionId) {
      assignSession(paneId, null);
      // Use microtask to re-assign after clearing
      queueMicrotask(() => assignSession(paneId, sessionId));
    }
  }, [paneId, sessionId, assignSession]);

  const handleRestart = useCallback(async () => {
    if (!sessionId || isRestarting) return;
    setIsRestarting(true);
    try {
      await restartSession(sessionId);
    } catch (error) {
      console.error('[TerminalPane] Restart failed:', error);
    } finally {
      setIsRestarting(false);
    }
  }, [sessionId, isRestarting, restartSession]);

  const handleTogglePause = useCallback(async () => {
    if (!sessionId || isTogglingPause) return;
    setIsTogglingPause(true);
    try {
      if (status === 'paused') {
        await resumeSession(sessionId);
      } else if (status === 'active' || status === 'idle') {
        await pauseSession(sessionId);
      }
    } catch (error) {
      console.error('[TerminalPane] Toggle pause failed:', error);
    } finally {
      setIsTogglingPause(false);
    }
  }, [sessionId, isTogglingPause, status, pauseSession, resumeSession]);

  // Handle back to terminal from file preview
  const handleBackToTerminal = useCallback(() => {
    setPaneDisplayMode(paneId, 'terminal');
  }, [paneId, setPaneDisplayMode]);

  return (
    <div
      className={cn(
        'flex flex-col h-full border border-border/50 rounded-sm overflow-hidden',
        isFocused && 'ring-1 ring-primary/40'
      )}
      onClick={handleFocus}
    >
      {/* PaneToolbar */}
      <div className="flex items-center justify-between gap-1 px-2 py-1 border-b border-border bg-muted/30 shrink-0 overflow-hidden">
        {/* Left: Session selector + status (or file path in file mode) */}
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {isFileMode ? (
            // File mode header
            <>
              <button
                onClick={handleBackToTerminal}
                className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
                title={formatMessage({ id: 'terminalDashboard.pane.backToTerminal', defaultMessage: 'Back to terminal' })}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs truncate" title={filePath ?? undefined}>
                {filePath?.split('/').pop() ?? 'File'}
              </span>
            </>
          ) : (
            // Terminal mode header
            <>
              {sessionId && (
                <span
                  className={cn('w-2 h-2 rounded-full shrink-0', statusDotStyles[status])}
                />
              )}
              <div className="relative min-w-0 overflow-hidden">
                <select
                  value={sessionId ?? ''}
                  onChange={handleSessionChange}
                  className={cn(
                    'text-xs bg-transparent border-none outline-none cursor-pointer',
                    'appearance-none pr-4 max-w-[140px] truncate',
                    !sessionId && 'text-muted-foreground'
                  )}
                >
                  <option value="">
                    {formatMessage({ id: 'terminalDashboard.pane.selectSession' })}
                  </option>
                  {sessionOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              </div>
            </>
          )}
        </div>

        {/* Center: Linked issue badge */}
        {linkedIssueId && !isFileMode && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0 hidden sm:inline-flex">
            {linkedIssueId}
          </span>
        )}

        {/* Right: Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={handleSplitH}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={formatMessage({ id: 'terminalDashboard.pane.splitHorizontal' })}
          >
            <SplitSquareHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleSplitV}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={formatMessage({ id: 'terminalDashboard.pane.splitVertical' })}
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
          </button>
          {!isFileMode && sessionId && (
            <>
              {/* Restart button */}
              <button
                onClick={handleRestart}
                disabled={isRestarting}
                className={cn(
                  'p-1 rounded hover:bg-muted transition-colors',
                  isRestarting ? 'text-muted-foreground/50' : 'text-muted-foreground hover:text-foreground'
                )}
                title={formatMessage({ id: 'terminalDashboard.pane.restart' })}
              >
                {isRestarting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
              </button>
              {/* Pause/Resume toggle button */}
              <button
                onClick={handleTogglePause}
                disabled={isTogglingPause || status === 'resuming'}
                className={cn(
                  'p-1 rounded hover:bg-muted transition-colors',
                  isTogglingPause || status === 'resuming'
                    ? 'text-muted-foreground/50'
                    : status === 'paused'
                    ? 'text-yellow-500 hover:text-yellow-600'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title={formatMessage({
                  id: status === 'paused'
                    ? 'terminalDashboard.pane.resume'
                    : 'terminalDashboard.pane.pause',
                })}
              >
                {isTogglingPause || status === 'resuming' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : status === 'paused' ? (
                  <Play className="w-3.5 h-3.5" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
              </button>
              {/* Clear terminal button */}
              <button
                onClick={handleClear}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title={formatMessage({ id: 'terminalDashboard.pane.clearTerminal' })}
              >
                <Eraser className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {alertCount > 0 && !isFileMode && (
            <span className="flex items-center gap-0.5 px-1 text-destructive">
              <AlertTriangle className="w-3 h-3" />
              <span className="text-[10px] font-semibold tabular-nums">
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            </span>
          )}
          {canClose && (
            <button
              onClick={handleClose}
              className="p-1 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
              title={formatMessage({ id: 'terminalDashboard.pane.closePane' })}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      {isFileMode ? (
        // File preview mode
        <div className="flex-1 min-h-0">
          <FilePreview
            fileContent={fileContent}
            isLoading={isFileLoading}
            error={fileError?.message ?? null}
            className="h-full"
          />
        </div>
      ) : sessionId ? (
        // Terminal mode with session
        <div className="flex-1 min-h-0">
          <TerminalInstance sessionId={sessionId} />
        </div>
      ) : (
        // Empty terminal state
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Terminal className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
            <p className="text-sm">
              {formatMessage({ id: 'terminalDashboard.pane.selectSession' })}
            </p>
            <p className="text-xs mt-1 opacity-70">
              {formatMessage({ id: 'terminalDashboard.pane.selectSessionHint' })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
