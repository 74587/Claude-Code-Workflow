// ========================================
// App Store
// ========================================
// Manages UI state: theme, sidebar, view, loading, error

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type { AppStore, Theme, ViewMode, SessionFilter, LiteTaskType } from '../types/store';

// Helper to resolve system theme
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Helper to resolve theme based on preference
const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
};

// Initial state
const initialState = {
  // Theme
  theme: 'system' as Theme,
  resolvedTheme: 'light' as 'light' | 'dark',

  // Sidebar
  sidebarOpen: true,
  sidebarCollapsed: false,

  // View state
  currentView: 'sessions' as ViewMode,
  currentFilter: 'all' as SessionFilter,
  currentLiteType: null as LiteTaskType,
  currentSessionDetailKey: null as string | null,

  // Loading and error states
  isLoading: false,
  loadingMessage: null as string | null,
  error: null as string | null,
};

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ========== Theme Actions ==========

        setTheme: (theme: Theme) => {
          const resolved = resolveTheme(theme);
          set({ theme, resolvedTheme: resolved }, false, 'setTheme');

          // Apply theme to document
          if (typeof document !== 'undefined') {
            document.documentElement.classList.remove('light', 'dark');
            document.documentElement.classList.add(resolved);
            document.documentElement.setAttribute('data-theme', resolved);
          }
        },

        toggleTheme: () => {
          const { theme } = get();
          const newTheme: Theme = theme === 'dark' ? 'light' : theme === 'light' ? 'dark' : 'dark';
          get().setTheme(newTheme);
        },

        // ========== Sidebar Actions ==========

        setSidebarOpen: (open: boolean) => {
          set({ sidebarOpen: open }, false, 'setSidebarOpen');
        },

        toggleSidebar: () => {
          set((state) => ({ sidebarOpen: !state.sidebarOpen }), false, 'toggleSidebar');
        },

        setSidebarCollapsed: (collapsed: boolean) => {
          set({ sidebarCollapsed: collapsed }, false, 'setSidebarCollapsed');
        },

        // ========== View Actions ==========

        setCurrentView: (view: ViewMode) => {
          set({ currentView: view }, false, 'setCurrentView');
        },

        setCurrentFilter: (filter: SessionFilter) => {
          set({ currentFilter: filter }, false, 'setCurrentFilter');
        },

        setCurrentLiteType: (type: LiteTaskType) => {
          set({ currentLiteType: type }, false, 'setCurrentLiteType');
        },

        setCurrentSessionDetailKey: (key: string | null) => {
          set({ currentSessionDetailKey: key }, false, 'setCurrentSessionDetailKey');
        },

        // ========== Loading/Error Actions ==========

        setLoading: (loading: boolean, message: string | null = null) => {
          set({ isLoading: loading, loadingMessage: message }, false, 'setLoading');
        },

        setError: (error: string | null) => {
          set({ error }, false, 'setError');
        },

        clearError: () => {
          set({ error: null }, false, 'clearError');
        },
      }),
      {
        name: 'ccw-app-store',
        // Only persist theme preference
        partialize: (state) => ({
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
        }),
        onRehydrateStorage: () => (state) => {
          // Apply theme on rehydration
          if (state) {
            const resolved = resolveTheme(state.theme);
            state.resolvedTheme = resolved;
            if (typeof document !== 'undefined') {
              document.documentElement.classList.remove('light', 'dark');
              document.documentElement.classList.add(resolved);
              document.documentElement.setAttribute('data-theme', resolved);
            }
          }
        },
      }
    ),
    { name: 'AppStore' }
  )
);

// Setup system theme listener
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const state = useAppStore.getState();
    if (state.theme === 'system') {
      const resolved = getSystemTheme();
      useAppStore.setState({ resolvedTheme: resolved });
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    }
  });
}

// Selectors for common access patterns
export const selectTheme = (state: AppStore) => state.theme;
export const selectResolvedTheme = (state: AppStore) => state.resolvedTheme;
export const selectSidebarOpen = (state: AppStore) => state.sidebarOpen;
export const selectCurrentView = (state: AppStore) => state.currentView;
export const selectIsLoading = (state: AppStore) => state.isLoading;
export const selectError = (state: AppStore) => state.error;
