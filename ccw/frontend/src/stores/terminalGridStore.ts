// ========================================
// Terminal Grid Store
// ========================================
// Zustand store for terminal grid layout state.
// Manages tmux-style split pane layout where each pane holds a terminal session.
// Reuses AllotmentLayoutGroup tree structure and pure layout functions from layout-utils.

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { AllotmentLayoutGroup, PaneId } from './viewerStore';
import {
  addPaneToLayout,
  removePaneFromLayout,
  getAllPaneIds,
} from '@/lib/layout-utils';
import type { CreateCliSessionInput, CliSession } from '@/lib/api';
import { createCliSession } from '@/lib/api';

// ========== Types ==========

export interface TerminalPaneState {
  id: PaneId;
  /** Bound terminal session key (null = empty pane awaiting assignment) */
  sessionId: string | null;
}

export interface TerminalGridState {
  layout: AllotmentLayoutGroup;
  panes: Record<PaneId, TerminalPaneState>;
  focusedPaneId: PaneId | null;
  nextPaneIdCounter: number;
}

export interface TerminalGridActions {
  setLayout: (layout: AllotmentLayoutGroup) => void;
  updateLayoutSizes: (sizes: number[]) => void;
  splitPane: (paneId: PaneId, direction: 'horizontal' | 'vertical') => PaneId;
  closePane: (paneId: PaneId) => void;
  assignSession: (paneId: PaneId, sessionId: string | null) => void;
  setFocused: (paneId: PaneId) => void;
  resetLayout: (preset: 'single' | 'split-h' | 'split-v' | 'grid-2x2') => void;
  /** Create a new CLI session and assign it to a new pane (auto-split from specified pane) */
  createSessionAndAssign: (
    paneId: PaneId,
    config: CreateCliSessionInput,
    projectPath: string | null
  ) => Promise<{ paneId: PaneId; session: CliSession } | null>;
}

export type TerminalGridStore = TerminalGridState & TerminalGridActions;

// ========== Constants ==========

const GRID_STORAGE_KEY = 'terminal-grid-storage';
const GRID_STORAGE_VERSION = 1;

// ========== Helpers ==========

const generatePaneId = (counter: number): PaneId => `tpane-${counter}`;

// ========== Initial State ==========

function createInitialLayout(): { layout: AllotmentLayoutGroup; panes: Record<PaneId, TerminalPaneState>; focusedPaneId: PaneId; nextPaneIdCounter: number } {
  const paneId = generatePaneId(1);
  return {
    layout: { direction: 'horizontal', sizes: [100], children: [paneId] },
    panes: { [paneId]: { id: paneId, sessionId: null } },
    focusedPaneId: paneId,
    nextPaneIdCounter: 2,
  };
}

const initial = createInitialLayout();

const initialState: TerminalGridState = {
  layout: initial.layout,
  panes: initial.panes,
  focusedPaneId: initial.focusedPaneId,
  nextPaneIdCounter: initial.nextPaneIdCounter,
};

// ========== Store ==========

export const useTerminalGridStore = create<TerminalGridStore>()(
  persist(
    devtools(
      (set, get) => ({
        ...initialState,

        setLayout: (layout) => {
          set({ layout }, false, 'terminalGrid/setLayout');
        },

        updateLayoutSizes: (sizes) => {
          const currentLayout = get().layout;
          // Only update if sizes actually changed
          if (JSON.stringify(currentLayout.sizes) !== JSON.stringify(sizes)) {
            set({ layout: { ...currentLayout, sizes } }, false, 'terminalGrid/updateLayoutSizes');
          }
        },

        splitPane: (paneId, direction) => {
          const state = get();
          const newPaneId = generatePaneId(state.nextPaneIdCounter);
          const newLayout = addPaneToLayout(state.layout, newPaneId, paneId, direction);

          set(
            {
              layout: newLayout,
              panes: {
                ...state.panes,
                [newPaneId]: { id: newPaneId, sessionId: null },
              },
              focusedPaneId: newPaneId,
              nextPaneIdCounter: state.nextPaneIdCounter + 1,
            },
            false,
            'terminalGrid/splitPane'
          );

          return newPaneId;
        },

        closePane: (paneId) => {
          const state = get();
          const allPaneIds = getAllPaneIds(state.layout);
          if (allPaneIds.length <= 1) return;

          const newLayout = removePaneFromLayout(state.layout, paneId);
          const newPanes = { ...state.panes };
          delete newPanes[paneId];

          let newFocused = state.focusedPaneId;
          if (newFocused === paneId) {
            const remaining = getAllPaneIds(newLayout);
            newFocused = remaining.length > 0 ? remaining[0] : null;
          }

          set(
            {
              layout: newLayout,
              panes: newPanes,
              focusedPaneId: newFocused,
            },
            false,
            'terminalGrid/closePane'
          );
        },

        assignSession: (paneId, sessionId) => {
          const state = get();
          const pane = state.panes[paneId];
          if (!pane) return;

          set(
            {
              panes: {
                ...state.panes,
                [paneId]: { ...pane, sessionId },
              },
            },
            false,
            'terminalGrid/assignSession'
          );
        },

        setFocused: (paneId) => {
          const state = get();
          if (!state.panes[paneId]) return;
          set({ focusedPaneId: paneId }, false, 'terminalGrid/setFocused');
        },

        resetLayout: (preset) => {
          let counter = get().nextPaneIdCounter;

          const createPane = (): TerminalPaneState => {
            const id = generatePaneId(counter++);
            return { id, sessionId: null };
          };

          let layout: AllotmentLayoutGroup;
          const panes: Record<PaneId, TerminalPaneState> = {};

          switch (preset) {
            case 'single': {
              const p = createPane();
              panes[p.id] = p;
              layout = { direction: 'horizontal', sizes: [100], children: [p.id] };
              break;
            }
            case 'split-h': {
              const p1 = createPane();
              const p2 = createPane();
              panes[p1.id] = p1;
              panes[p2.id] = p2;
              layout = { direction: 'horizontal', sizes: [50, 50], children: [p1.id, p2.id] };
              break;
            }
            case 'split-v': {
              const p1 = createPane();
              const p2 = createPane();
              panes[p1.id] = p1;
              panes[p2.id] = p2;
              layout = { direction: 'vertical', sizes: [50, 50], children: [p1.id, p2.id] };
              break;
            }
            case 'grid-2x2': {
              const p1 = createPane();
              const p2 = createPane();
              const p3 = createPane();
              const p4 = createPane();
              panes[p1.id] = p1;
              panes[p2.id] = p2;
              panes[p3.id] = p3;
              panes[p4.id] = p4;
              layout = {
                direction: 'vertical',
                sizes: [50, 50],
                children: [
                  { direction: 'horizontal', sizes: [50, 50], children: [p1.id, p2.id] },
                  { direction: 'horizontal', sizes: [50, 50], children: [p3.id, p4.id] },
                ],
              };
              break;
            }
            default:
              return;
          }

          const firstPaneId = Object.keys(panes)[0] || null;
          set(
            {
              layout,
              panes,
              focusedPaneId: firstPaneId,
              nextPaneIdCounter: counter,
            },
            false,
            'terminalGrid/resetLayout'
          );
        },

        createSessionAndAssign: async (paneId, config, projectPath) => {
          try {
            // 1. Create the CLI session via API
            const result = await createCliSession(config, projectPath ?? undefined);
            const session = result.session;

            // 2. Get current state
            const state = get();

            // 3. Check if the current pane is empty (no session assigned)
            const currentPane = state.panes[paneId];
            const isCurrentPaneEmpty = !currentPane?.sessionId;

            if (isCurrentPaneEmpty) {
              // Assign session to current empty pane
              set(
                {
                  panes: {
                    ...state.panes,
                    [paneId]: { ...currentPane, sessionId: session.sessionKey },
                  },
                  focusedPaneId: paneId,
                },
                false,
                'terminalGrid/createSessionAndAssign'
              );
              return { paneId, session };
            }

            // 4. Current pane has session, auto-split and assign to new pane
            const newPaneId = generatePaneId(state.nextPaneIdCounter);
            const newLayout = addPaneToLayout(state.layout, newPaneId, paneId, 'horizontal');

            set(
              {
                layout: newLayout,
                panes: {
                  ...state.panes,
                  [newPaneId]: { id: newPaneId, sessionId: session.sessionKey },
                },
                focusedPaneId: newPaneId,
                nextPaneIdCounter: state.nextPaneIdCounter + 1,
              },
              false,
              'terminalGrid/createSessionAndAssign'
            );

            return { paneId: newPaneId, session };
          } catch (error) {
            console.error('Failed to create CLI session:', error);
            return null;
          }
        },
      }),
      { name: 'TerminalGridStore' }
    ),
    {
      name: GRID_STORAGE_KEY,
      version: GRID_STORAGE_VERSION,
      partialize: (state) => ({
        layout: state.layout,
        panes: state.panes,
        focusedPaneId: state.focusedPaneId,
        nextPaneIdCounter: state.nextPaneIdCounter,
      }),
    }
  )
);

// ========== Selectors ==========

export const selectTerminalGridLayout = (state: TerminalGridStore) => state.layout;
export const selectTerminalGridPanes = (state: TerminalGridStore) => state.panes;
export const selectTerminalGridFocusedPaneId = (state: TerminalGridStore) => state.focusedPaneId;
export const selectTerminalPane = (paneId: PaneId) => (state: TerminalGridStore) =>
  state.panes[paneId];
