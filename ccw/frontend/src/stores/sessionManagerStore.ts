// ========================================
// Session Manager Store
// ========================================
// Zustand store for terminal dashboard session management.
// Manages session groups, layout, active terminal, terminal metadata,
// and monitor Web Worker lifecycle.
// Consumes cliSessionStore data via getState() pattern (no data duplication).

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  MonitorAlert,
  SessionGroup,
  SessionLayout,
  SessionManagerState,
  SessionManagerStore,
  TerminalMeta,
  TerminalStatus,
} from '../types/terminal-dashboard';

// ========== Initial State ==========

const initialState: SessionManagerState = {
  groups: [],
  layout: { grid: '1x1', splits: [1] },
  activeTerminalId: null,
  terminalMetas: {},
};

// ========== Worker Ref (non-reactive, outside Zustand) ==========

/** Module-level worker reference. Worker objects are not serializable. */
let _workerRef: Worker | null = null;

// ========== Worker Message Handler ==========

function _handleWorkerMessage(event: MessageEvent<MonitorAlert>): void {
  const msg = event.data;
  if (msg.type !== 'alert') return;

  const { sessionId, severity, message } = msg;

  // Map severity to terminal status
  const statusMap: Record<string, TerminalStatus> = {
    critical: 'error',
    warning: 'idle',
  };

  const store = useSessionManagerStore.getState();
  const existing = store.terminalMetas[sessionId];
  const currentAlertCount = existing?.alertCount ?? 0;

  store.updateTerminalMeta(sessionId, {
    status: statusMap[severity] ?? 'idle',
    alertCount: currentAlertCount + 1,
  });

  // Log for debugging (non-intrusive)
  if (import.meta.env.DEV) {
    console.debug(`[MonitorWorker] ${severity}: ${message} (session=${sessionId})`);
  }
}

// ========== Store ==========

export const useSessionManagerStore = create<SessionManagerStore>()(
  devtools(
    (set) => ({
      ...initialState,

      // ========== Group Management ==========

      createGroup: (name: string) => {
        const id = `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newGroup: SessionGroup = { id, name, sessionIds: [] };
        set(
          (state) => ({ groups: [...state.groups, newGroup] }),
          false,
          'createGroup'
        );
      },

      removeGroup: (groupId: string) => {
        set(
          (state) => ({ groups: state.groups.filter((g) => g.id !== groupId) }),
          false,
          'removeGroup'
        );
      },

      moveSessionToGroup: (sessionId: string, groupId: string) => {
        set(
          (state) => {
            const nextGroups = state.groups.map((group) => {
              // Remove session from its current group
              const filtered = group.sessionIds.filter((id) => id !== sessionId);
              // Add to target group
              if (group.id === groupId) {
                return { ...group, sessionIds: [...filtered, sessionId] };
              }
              return { ...group, sessionIds: filtered };
            });
            return { groups: nextGroups };
          },
          false,
          'moveSessionToGroup'
        );
      },

      // ========== Terminal Selection ==========

      setActiveTerminal: (sessionId: string | null) => {
        set({ activeTerminalId: sessionId }, false, 'setActiveTerminal');
      },

      // ========== Terminal Metadata ==========

      updateTerminalMeta: (sessionId: string, meta: Partial<TerminalMeta>) => {
        set(
          (state) => {
            const existing = state.terminalMetas[sessionId] ?? {
              title: sessionId,
              status: 'idle' as const,
              alertCount: 0,
            };
            return {
              terminalMetas: {
                ...state.terminalMetas,
                [sessionId]: { ...existing, ...meta },
              },
            };
          },
          false,
          'updateTerminalMeta'
        );
      },

      // ========== Layout Management ==========

      setGroupLayout: (layout: SessionLayout) => {
        set({ layout }, false, 'setGroupLayout');
      },

      // ========== Monitor Worker Lifecycle ==========

      spawnMonitor: () => {
        // Idempotent: only create if not already running
        if (_workerRef) return;
        try {
          _workerRef = new Worker(
            new URL('../workers/monitor.worker.ts', import.meta.url),
            { type: 'module' }
          );
          _workerRef.onmessage = _handleWorkerMessage;
          _workerRef.onerror = (err) => {
            if (import.meta.env.DEV) {
              console.error('[MonitorWorker] error:', err);
            }
          };
        } catch {
          // Worker creation can fail in environments without worker support
          _workerRef = null;
        }
      },

      terminateMonitor: () => {
        if (!_workerRef) return;
        _workerRef.terminate();
        _workerRef = null;
      },

      feedMonitor: (sessionId: string, text: string) => {
        // Lazily spawn worker on first feed call
        if (!_workerRef) {
          useSessionManagerStore.getState().spawnMonitor();
        }
        if (_workerRef) {
          _workerRef.postMessage({ type: 'output', sessionId, text });
        }
      },
    }),
    { name: 'SessionManagerStore' }
  )
);

// ========== Selectors ==========

/** Select all session groups */
export const selectGroups = (state: SessionManagerStore) => state.groups;

/** Select current terminal layout */
export const selectLayout = (state: SessionManagerStore) => state.layout;

/** Select active terminal session key */
export const selectSessionManagerActiveTerminalId = (state: SessionManagerStore) =>
  state.activeTerminalId;

/** Select all terminal metadata records */
export const selectTerminalMetas = (state: SessionManagerStore) => state.terminalMetas;

/** Select terminal metadata for a specific session */
export const selectTerminalMeta =
  (sessionId: string) =>
  (state: SessionManagerStore): TerminalMeta | undefined =>
    state.terminalMetas[sessionId];
