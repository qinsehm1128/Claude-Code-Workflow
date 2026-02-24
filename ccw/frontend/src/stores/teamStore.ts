// ========================================
// Team Store
// ========================================
// UI state for team execution visualization

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { TeamMessageFilter } from '@/types/team';

export type TeamDetailTab = 'artifacts' | 'messages';

interface TeamStore {
  selectedTeam: string | null;
  autoRefresh: boolean;
  messageFilter: TeamMessageFilter;
  timelineExpanded: boolean;
  viewMode: 'list' | 'detail';
  locationFilter: 'active' | 'archived' | 'all';
  searchQuery: string;
  detailTab: TeamDetailTab;
  setSelectedTeam: (name: string | null) => void;
  toggleAutoRefresh: () => void;
  setMessageFilter: (filter: Partial<TeamMessageFilter>) => void;
  clearMessageFilter: () => void;
  setTimelineExpanded: (expanded: boolean) => void;
  setViewMode: (mode: 'list' | 'detail') => void;
  setLocationFilter: (filter: 'active' | 'archived' | 'all') => void;
  setSearchQuery: (query: string) => void;
  setDetailTab: (tab: TeamDetailTab) => void;
  selectTeamAndShowDetail: (name: string) => void;
  backToList: () => void;
}

export const useTeamStore = create<TeamStore>()(
  devtools(
    persist(
      (set) => ({
        selectedTeam: null,
        autoRefresh: true,
        messageFilter: {},
        timelineExpanded: true,
        viewMode: 'list',
        locationFilter: 'active',
        searchQuery: '',
        detailTab: 'artifacts',
        setSelectedTeam: (name) => set({ selectedTeam: name }),
        toggleAutoRefresh: () => set((s) => ({ autoRefresh: !s.autoRefresh })),
        setMessageFilter: (filter) =>
          set((s) => ({ messageFilter: { ...s.messageFilter, ...filter } })),
        clearMessageFilter: () => set({ messageFilter: {} }),
        setTimelineExpanded: (expanded) => set({ timelineExpanded: expanded }),
        setViewMode: (mode) => set({ viewMode: mode }),
        setLocationFilter: (filter) => set({ locationFilter: filter }),
        setSearchQuery: (query) => set({ searchQuery: query }),
        setDetailTab: (tab) => set({ detailTab: tab }),
        selectTeamAndShowDetail: (name) => set({ selectedTeam: name, viewMode: 'detail', detailTab: 'artifacts' }),
        backToList: () => set({ viewMode: 'list', detailTab: 'artifacts' }),
      }),
      { name: 'ccw-team-store' }
    ),
    { name: 'TeamStore' }
  )
);
