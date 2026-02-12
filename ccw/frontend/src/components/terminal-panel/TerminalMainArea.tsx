// ========================================
// TerminalMainArea Component
// ========================================
// Main display area for the terminal panel.
// Shows header with session info, tab switcher (terminal/queue), and
// embedded xterm.js terminal with command input. Reuses the xterm rendering
// pattern from IssueTerminalTab (init, FitAddon, output streaming, PTY input).

import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { X, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { useTerminalPanelStore } from '@/stores/terminalPanelStore';
import { useCliSessionStore } from '@/stores/cliSessionStore';
import type { PanelView } from '@/stores/terminalPanelStore';
import {
  fetchCliSessionBuffer,
  sendCliSessionText,
  resizeCliSession,
  executeInCliSession,
} from '@/lib/api';

// ========== Types ==========

export interface TerminalMainAreaProps {
  onClose: () => void;
}

// ========== Component ==========

export function TerminalMainArea({ onClose }: TerminalMainAreaProps) {
  const projectPath = useWorkflowStore(selectProjectPath);

  const activeTerminalId = useTerminalPanelStore((s) => s.activeTerminalId);
  const panelView = useTerminalPanelStore((s) => s.panelView);
  const setPanelView = useTerminalPanelStore((s) => s.setPanelView);

  const sessionsByKey = useCliSessionStore((s) => s.sessions);
  const outputChunks = useCliSessionStore((s) => s.outputChunks);
  const setBuffer = useCliSessionStore((s) => s.setBuffer);
  const clearOutput = useCliSessionStore((s) => s.clearOutput);

  const activeSession = activeTerminalId ? sessionsByKey[activeTerminalId] : null;

  const [prompt, setPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // xterm refs
  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastChunkIndexRef = useRef<number>(0);

  // Input batching refs (same pattern as IssueTerminalTab)
  const pendingInputRef = useRef<string>('');
  const flushTimerRef = useRef<number | null>(null);
  const activeSessionKeyRef = useRef<string | null>(null);

  // Keep ref in sync with activeTerminalId for closures
  useEffect(() => {
    activeSessionKeyRef.current = activeTerminalId;
  }, [activeTerminalId]);

  const flushInput = async () => {
    const sessionKey = activeSessionKeyRef.current;
    if (!sessionKey) return;
    const pending = pendingInputRef.current;
    pendingInputRef.current = '';
    if (!pending) return;
    try {
      await sendCliSessionText(sessionKey, { text: pending, appendNewline: false }, projectPath || undefined);
    } catch {
      // Ignore transient failures
    }
  };

  const scheduleFlush = () => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = window.setTimeout(async () => {
      flushTimerRef.current = null;
      await flushInput();
    }, 30);
  };

  // ========== xterm Initialization ==========

  useEffect(() => {
    if (!terminalHostRef.current) return;
    if (xtermRef.current) return;

    const term = new XTerm({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      scrollback: 5000,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalHostRef.current);
    fitAddon.fit();

    // Forward keystrokes to backend (batched)
    term.onData((data) => {
      if (!activeSessionKeyRef.current) return;
      pendingInputRef.current += data;
      scheduleFlush();
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      try {
        term.dispose();
      } finally {
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== Attach to Active Session ==========

  useEffect(() => {
    const term = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;

    lastChunkIndexRef.current = 0;
    term.reset();
    term.clear();

    if (!activeTerminalId) return;
    clearOutput(activeTerminalId);

    fetchCliSessionBuffer(activeTerminalId, projectPath || undefined)
      .then(({ buffer }) => {
        setBuffer(activeTerminalId, buffer || '');
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        fitAddon.fit();
      });
  }, [activeTerminalId, projectPath, setBuffer, clearOutput]);

  // ========== Stream Output Chunks ==========

  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    if (!activeTerminalId) return;

    const chunks = outputChunks[activeTerminalId] ?? [];
    const start = lastChunkIndexRef.current;
    if (start >= chunks.length) return;

    for (let i = start; i < chunks.length; i++) {
      term.write(chunks[i].data);
    }
    lastChunkIndexRef.current = chunks.length;
  }, [outputChunks, activeTerminalId]);

  // ========== Resize Observer ==========

  useEffect(() => {
    const host = terminalHostRef.current;
    const term = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    if (!host || !term || !fitAddon) return;

    const resize = () => {
      fitAddon.fit();
      const sessionKey = activeSessionKeyRef.current;
      if (sessionKey) {
        void (async () => {
          try {
            await resizeCliSession(sessionKey, { cols: term.cols, rows: term.rows }, projectPath || undefined);
          } catch {
            // ignore
          }
        })();
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    return () => ro.disconnect();
  }, [projectPath]);

  // ========== Execute Command ==========

  const handleExecute = async () => {
    if (!activeTerminalId) return;
    if (!prompt.trim()) return;
    setIsExecuting(true);
    setError(null);
    try {
      await executeInCliSession(activeTerminalId, {
        tool: activeSession?.tool || 'claude',
        prompt: prompt.trim(),
        mode: 'analysis',
        category: 'user',
      }, projectPath || undefined);
      setPrompt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to execute
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleExecute();
    }
  };

  // ========== Render ==========

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {activeSession
              ? `${activeSession.tool || 'cli'} - ${activeSession.sessionKey}`
              : 'Terminal Panel'}
          </h3>
          {activeSession?.tool && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {activeSession.workingDir}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="flex-shrink-0 hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={panelView}
        onValueChange={(v) => setPanelView(v as PanelView)}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="px-4 pt-2 bg-card">
          <TabsList>
            <TabsTrigger value="terminal">Terminal</TabsTrigger>
            <TabsTrigger value="queue">Queue</TabsTrigger>
          </TabsList>
        </div>

        {/* Terminal View */}
        <TabsContent value="terminal" className="flex-1 flex flex-col min-h-0 mt-0 p-0">
          {activeTerminalId ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* xterm container */}
              <div className="flex-1 min-h-0 bg-black/90">
                <div ref={terminalHostRef} className="h-full w-full" />
              </div>

              {/* Command input area */}
              <div className="border-t border-border p-3 bg-card">
                {error && (
                  <div className="text-xs text-destructive mb-2">{error}</div>
                )}
                <div className="flex gap-2">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter command... (Ctrl+Enter to execute)"
                    className={cn(
                      'flex-1 min-h-[60px] max-h-[120px] p-2 bg-background border border-input rounded-md text-sm resize-none',
                      'focus:outline-none focus:ring-2 focus:ring-primary'
                    )}
                  />
                  <Button
                    onClick={handleExecute}
                    disabled={!activeTerminalId || isExecuting || !prompt.trim()}
                    className="self-end"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    Execute
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p className="text-sm">No terminal selected</p>
            </div>
          )}
        </TabsContent>

        {/* Queue View (placeholder for Phase 2) */}
        <TabsContent value="queue" className="flex-1 flex items-center justify-center mt-0 p-0">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">Execution Queue Management</p>
            <p className="text-xs mt-1">Coming in Phase 2</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
