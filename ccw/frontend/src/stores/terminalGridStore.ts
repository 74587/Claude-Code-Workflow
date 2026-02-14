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
  splitPane: (paneId: PaneId, direction: 'horizontal' | 'vertical') => PaneId;
  closePane: (paneId: PaneId) => void;
  assignSession: (paneId: PaneId, sessionId: string | null) => void;
  setFocused: (paneId: PaneId) => void;
  resetLayout: (preset: 'single' | 'split-h' | 'split-v' | 'grid-2x2') => void;
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
