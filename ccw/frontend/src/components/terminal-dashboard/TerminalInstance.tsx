// ========================================
// TerminalInstance Component
// ========================================
// xterm.js terminal wrapper for the Terminal Dashboard.
// Reuses exact integration pattern from TerminalMainArea:
// XTerm instance in ref, FitAddon, ResizeObserver, batched PTY input (30ms),
// output chunk streaming from cliSessionStore.

import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { useCliSessionStore } from '@/stores/cliSessionStore';
import { useSessionManagerStore } from '@/stores/sessionManagerStore';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import {
  fetchCliSessionBuffer,
  sendCliSessionText,
  resizeCliSession,
} from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Types ==========

interface TerminalInstanceProps {
  /** Session key to render terminal for */
  sessionId: string;
  /** Additional CSS classes */
  className?: string;
}

// ========== Component ==========

export function TerminalInstance({ sessionId, className }: TerminalInstanceProps) {
  const projectPath = useWorkflowStore(selectProjectPath);

  // cliSessionStore selectors
  const outputChunks = useCliSessionStore((s) => s.outputChunks);
  const setBuffer = useCliSessionStore((s) => s.setBuffer);
  const clearOutput = useCliSessionStore((s) => s.clearOutput);

  // ========== xterm Refs ==========

  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastChunkIndexRef = useRef<number>(0);

  // PTY input batching (30ms, matching TerminalMainArea)
  const pendingInputRef = useRef<string>('');
  const flushTimerRef = useRef<number | null>(null);

  // Track sessionId in a ref so xterm onData callback always has latest value
  const sessionIdRef = useRef<string>(sessionId);
  sessionIdRef.current = sessionId;

  const projectPathRef = useRef<string | null>(projectPath);
  projectPathRef.current = projectPath;

  // ========== PTY Input Batching ==========

  const flushInput = useCallback(async () => {
    const key = sessionIdRef.current;
    if (!key) return;
    const pending = pendingInputRef.current;
    pendingInputRef.current = '';
    if (!pending) return;
    try {
      await sendCliSessionText(
        key,
        { text: pending, appendNewline: false },
        projectPathRef.current || undefined
      );
    } catch {
      // Ignore transient failures
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = window.setTimeout(async () => {
      flushTimerRef.current = null;
      await flushInput();
    }, 30);
  }, [flushInput]);

  // ========== xterm Lifecycle ==========

  // Initialize xterm instance (once per mount)
  useEffect(() => {
    if (!terminalHostRef.current) return;
    if (xtermRef.current) return;

    const term = new XTerm({
      convertEol: true,
      cursorBlink: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      scrollback: 5000,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalHostRef.current);
    fitAddon.fit();

    // Forward keystrokes to backend (batched 30ms)
    term.onData((data) => {
      if (!sessionIdRef.current) return;
      pendingInputRef.current += data;
      scheduleFlush();
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      // Flush any pending input before cleanup
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      try {
        term.dispose();
      } finally {
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach to session: clear terminal and load buffer
  useEffect(() => {
    const term = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;

    lastChunkIndexRef.current = 0;
    term.reset();
    term.clear();

    if (!sessionId) return;
    clearOutput(sessionId);

    fetchCliSessionBuffer(sessionId, projectPath || undefined)
      .then(({ buffer }) => {
        setBuffer(sessionId, buffer || '');
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        fitAddon.fit();
      });
  }, [sessionId, projectPath, setBuffer, clearOutput]);

  // Stream new output chunks into xterm and forward to monitor worker
  useEffect(() => {
    const term = xtermRef.current;
    if (!term || !sessionId) return;

    const chunks = outputChunks[sessionId] ?? [];
    const start = lastChunkIndexRef.current;
    if (start >= chunks.length) return;

    const { feedMonitor } = useSessionManagerStore.getState();
    for (let i = start; i < chunks.length; i++) {
      term.write(chunks[i].data);
      feedMonitor(sessionId, chunks[i].data);
    }
    lastChunkIndexRef.current = chunks.length;
  }, [outputChunks, sessionId]);

  // ResizeObserver -> fit + resize backend
  useEffect(() => {
    const host = terminalHostRef.current;
    const term = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    if (!host || !term || !fitAddon) return;

    const resize = () => {
      fitAddon.fit();
      if (sessionIdRef.current) {
        void (async () => {
          try {
            await resizeCliSession(
              sessionIdRef.current,
              { cols: term.cols, rows: term.rows },
              projectPathRef.current || undefined
            );
          } catch {
            // ignore
          }
        })();
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    return () => ro.disconnect();
  }, [sessionId, projectPath]);

  // ========== Render ==========

  return (
    <div
      ref={terminalHostRef}
      className={cn('h-full w-full bg-black/90', className)}
    />
  );
}
