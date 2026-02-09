// ========================================
// Team Store
// ========================================
// UI state for team execution visualization

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { TeamMessageFilter } from '@/types/team';

interface TeamStore {
  selectedTeam: string | null;
  autoRefresh: boolean;
  messageFilter: TeamMessageFilter;
  timelineExpanded: boolean;
  setSelectedTeam: (name: string | null) => void;
  toggleAutoRefresh: () => void;
  setMessageFilter: (filter: Partial<TeamMessageFilter>) => void;
  clearMessageFilter: () => void;
  setTimelineExpanded: (expanded: boolean) => void;
}

export const useTeamStore = create<TeamStore>()(
  devtools(
    persist(
      (set) => ({
        selectedTeam: null,
        autoRefresh: true,
        messageFilter: {},
        timelineExpanded: true,
        setSelectedTeam: (name) => set({ selectedTeam: name }),
        toggleAutoRefresh: () => set((s) => ({ autoRefresh: !s.autoRefresh })),
        setMessageFilter: (filter) =>
          set((s) => ({ messageFilter: { ...s.messageFilter, ...filter } })),
        clearMessageFilter: () => set({ messageFilter: {} }),
        setTimelineExpanded: (expanded) => set({ timelineExpanded: expanded }),
      }),
      { name: 'ccw-team-store' }
    ),
    { name: 'TeamStore' }
  )
);
